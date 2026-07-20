from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import json
import logging

from sqlalchemy import or_

from models import db
from models.inspeccion_recepcion import InspeccionRecepcion
from models.acta_entrega import ActaEntrega
from models.user import User
from models.coche import Coche
from models.cliente import Cliente
from models.notificacion import Notificacion
from models.base import now_madrid
from utils.auth_utils import normalize_role
from services.whatsapp_service import enviar_notificacion_inspeccion
from utils.inspeccion_helpers import (
    role_required, _jwt_user_id, _get_partes_por_coche, _serialize_inspeccion_con_estado,
    _normalize_servicios_aplicados, _auto_crear_partes_desde_inspeccion,
    _sync_partes_pendientes_desde_servicios, _eliminar_partes_huerfanos_pendientes,
    _is_inspeccion_role, _can_view_all_inspecciones, _safe_servicios_aplicados,
    _cliente_payload_matches, _telefono_digits,
)

inspeccion_bp = Blueprint('inspeccion', __name__, url_prefix='/api')


@inspeccion_bp.route("/inspeccion-recepcion/clientes/<int:cliente_id>/historial-resumen", methods=["GET"])
@role_required("administrador", "calidad", "detailing")
def historial_resumen_cliente(cliente_id):
    """Resumen rápido de trabajos anteriores de un cliente para alerta en recepción."""
    cliente = Cliente.query.get(cliente_id)
    if not cliente:
        return jsonify({"msg": "Cliente no encontrado"}), 404

    inspecciones = (
        InspeccionRecepcion.query
        .filter(InspeccionRecepcion.cliente_id == cliente_id)
        .order_by(InspeccionRecepcion.fecha_inspeccion.desc(), InspeccionRecepcion.id.desc())
        .all()
    )

    def _trabajo_label(inspeccion):
        texto = (inspeccion.trabajos_realizados or "").strip()
        if texto:
            return texto
        try:
            servicios = json.loads(inspeccion.servicios_aplicados or "[]")
        except Exception:
            servicios = []
        nombres = []
        if isinstance(servicios, list):
            for item in servicios:
                if isinstance(item, dict):
                    nombre = str(item.get("nombre") or "").strip()
                    if nombre:
                        nombres.append(nombre)
        if nombres:
            return ", ".join(nombres)
        return "Trabajo registrado"

    ultimos = []
    for insp in inspecciones[:3]:
        ultimos.append({
            "inspeccion_id": insp.id,
            "fecha_inspeccion": insp.fecha_inspeccion.isoformat() if insp.fecha_inspeccion else None,
            "fecha_entrega": insp.fecha_entrega.isoformat() if insp.fecha_entrega else None,
            "matricula": insp.matricula,
            "coche_descripcion": insp.coche_descripcion,
            "trabajo": _trabajo_label(insp),
            "entregado": bool(insp.entregado),
        })

    return jsonify({
        "cliente_id": cliente_id,
        "total_trabajos": len(inspecciones),
        "ultimo_trabajo": ultimos[0] if ultimos else None,
        "ultimos_trabajos": ultimos,
    }), 200


@inspeccion_bp.route("/inspeccion-recepcion/historial-coche/<string:matricula>/resumen", methods=["GET"])
@role_required("administrador", "calidad", "detailing")
def historial_resumen_coche_por_matricula(matricula):
    """Resumen de trabajos previos del mismo coche (solo particulares)."""
    matricula_norm = (matricula or "").strip().upper()
    if not matricula_norm:
        return jsonify({"msg": "Matrícula requerida"}), 400

    excluir_id = request.args.get("excluir_inspeccion_id")
    excluir_inspeccion_id = None
    if excluir_id not in (None, ""):
        try:
            excluir_inspeccion_id = int(excluir_id)
        except (TypeError, ValueError):
            return jsonify({"msg": "excluir_inspeccion_id inválido"}), 400

    query = (
        InspeccionRecepcion.query
        .filter(InspeccionRecepcion.matricula == matricula_norm)
        .filter(InspeccionRecepcion.es_concesionario.is_(False))
    )

    if excluir_inspeccion_id:
        query = query.filter(InspeccionRecepcion.id != excluir_inspeccion_id)

    inspecciones = query.order_by(
        InspeccionRecepcion.fecha_inspeccion.desc(),
        InspeccionRecepcion.id.desc(),
    ).all()

    def _trabajo_label(inspeccion):
        texto = (inspeccion.trabajos_realizados or "").strip()
        if texto:
            return texto
        try:
            servicios = json.loads(inspeccion.servicios_aplicados or "[]")
        except Exception:
            servicios = []
        nombres = []
        if isinstance(servicios, list):
            for item in servicios:
                if isinstance(item, dict):
                    nombre = str(item.get("nombre") or "").strip()
                    if nombre:
                        nombres.append(nombre)
        if nombres:
            return ", ".join(nombres)
        return "Trabajo registrado"

    ultimos = []
    for insp in inspecciones[:3]:
        ultimos.append({
            "inspeccion_id": insp.id,
            "fecha_inspeccion": insp.fecha_inspeccion.isoformat() if insp.fecha_inspeccion else None,
            "fecha_entrega": insp.fecha_entrega.isoformat() if insp.fecha_entrega else None,
            "cliente_id": insp.cliente_id,
            "cliente_nombre": insp.cliente_nombre,
            "matricula": insp.matricula,
            "coche_descripcion": insp.coche_descripcion,
            "trabajo": _trabajo_label(insp),
            "entregado": bool(insp.entregado),
        })

    return jsonify({
        "matricula": matricula_norm,
        "solo_particulares": True,
        "total_trabajos": len(inspecciones),
        "ultimo_trabajo": ultimos[0] if ultimos else None,
        "ultimos_trabajos": ultimos,
    }), 200


# ============ CREAR INSPECCIÓN ============
@inspeccion_bp.route("/inspeccion-recepcion", methods=["POST"])
@role_required("administrador", "calidad", "detailing")
def crear_inspeccion():
    """
    Crear una nueva inspección de recepción.
    Campos requeridos:
    - cliente_id (int, opcional)
    - cliente_nombre (str)
    - cliente_telefono (str)
    - coche_descripcion (str)
    - matricula (str)
    - kilometros (int)
    - firma_cliente_recepcion (base64) solo en flujo normal
    - averias_notas (str, opcional)
    """
    data = request.get_json(silent=True) or {}
    user_id = _jwt_user_id()
    if not user_id:
        return jsonify({"msg": "Usuario no válido en el token"}), 401

    try:
        es_concesionario = bool(data.get("es_concesionario", False))
        requiere_hoja_intervencion = bool(data.get("requiere_hoja_intervencion", False))

        cliente_id_raw = data.get("cliente_id")
        cliente_id = None
        if cliente_id_raw not in (None, ""):
            try:
                cliente_id = int(cliente_id_raw)
            except (TypeError, ValueError):
                return jsonify({"msg": "cliente_id inválido"}), 400

        cliente_nombre = (data.get("cliente_nombre") or "").strip()
        cliente_telefono = (data.get("cliente_telefono") or "").strip()
        matricula = (data.get("matricula") or "").upper().strip()
        kilometros = data.get("kilometros")
        consentimiento_datos_recepcion = bool(data.get("consentimiento_datos_recepcion", False))

        # Validar campos requeridos
        required_fields = [
            "coche_descripcion",
            "matricula",
            "kilometros",
        ]
        for field in required_fields:
            if not data.get(field):
                return jsonify({"msg": f"Campo requerido: {field}"}), 400

        if not es_concesionario and not data.get("firma_cliente_recepcion"):
            return jsonify({"msg": "Campo requerido: firma_cliente_recepcion"}), 400

        if not consentimiento_datos_recepcion:
            return jsonify({"msg": "Debe aceptarse la proteccion de datos en recepcion"}), 400

        try:
            kilometros = int(kilometros)
            if kilometros < 0:
                return jsonify({"msg": "El campo kilometros debe ser mayor o igual a 0"}), 400
        except (TypeError, ValueError):
            return jsonify({"msg": "El campo kilometros debe ser un numero entero"}), 400

        servicios_aplicados = _normalize_servicios_aplicados(data.get("servicios_aplicados"))
        if not servicios_aplicados:
            return jsonify({"msg": "Debes añadir al menos un servicio para crear los partes de trabajo automáticos"}), 400

        if not cliente_nombre:
            return jsonify({"msg": "Campo requerido: cliente_nombre"}), 400
        if not cliente_telefono:
            return jsonify({"msg": "Campo requerido: cliente_telefono"}), 400

        # 0) Prioridad por matrícula para identificar cliente solo por coche.
        coche_existente = Coche.query.filter_by(matricula=matricula).first()
        cliente_por_matricula = None
        if coche_existente and coche_existente.cliente_id:
            cliente_por_matricula = Cliente.query.get(coche_existente.cliente_id)
            if not cliente_por_matricula:
                return jsonify({"msg": "Inconsistencia: el coche existe pero su cliente no está disponible"}), 400

        # 1) Resolver cliente sin búsquedas por nombre/teléfono.
        #    Solo se acepta: cliente_id explícito o cliente del coche por matrícula.
        cliente = None
        if cliente_id:
            cliente = Cliente.query.get(cliente_id)
            if not cliente:
                return jsonify({"msg": "Cliente no encontrado para cliente_id proporcionado"}), 400
            if cliente_por_matricula and cliente.id != cliente_por_matricula.id:
                return jsonify({"msg": "La matrícula ya está vinculada a otro cliente"}), 400
        elif cliente_por_matricula:
            cliente = cliente_por_matricula
        else:
            # Si no hay cliente explícito ni matrícula conocida, crear nuevo cliente.
            cliente = Cliente(
                nombre=cliente_nombre,
                telefono=cliente_telefono,
                email=None,
                cif=None,
                direccion=None
            )
            db.session.add(cliente)
            db.session.flush()  # Obtener el ID sin commit aún

        # 2. Buscar o crear coche
        coche = coche_existente or Coche.query.filter_by(matricula=matricula).first()
        if not coche:
            # Crear coche automáticamente
            coche_desc = data.get("coche_descripcion", "").split()
            marca = coche_desc[0] if len(coche_desc) > 0 else None
            modelo = " ".join(coche_desc[1:]) if len(coche_desc) > 1 else None

            coche = Coche(
                matricula=matricula,
                marca=marca,
                modelo=modelo,
                cliente_id=cliente.id,
                notas="Registrado automáticamente en inspección de recepción"
            )
            db.session.add(coche)
            db.session.flush()
        elif not coche.cliente_id and cliente:
            coche.cliente_id = cliente.id

        # 3. Crear inspección vinculada
        inspeccion = InspeccionRecepcion(
            usuario_id=user_id,
            cliente_id=cliente.id,
            coche_id=coche.id,
            cliente_nombre=cliente_nombre,
            cliente_telefono=cliente_telefono,
            coche_descripcion=data.get("coche_descripcion"),
            matricula=matricula,
            kilometros=kilometros,
            es_concesionario=es_concesionario,
            requiere_hoja_intervencion=requiere_hoja_intervencion,
            firma_cliente_recepcion=None if es_concesionario else data.get("firma_cliente_recepcion"),
            # Firma de empleado no se usa en recepción.
            firma_empleado_recepcion=None,
            consentimiento_datos_recepcion=consentimiento_datos_recepcion,
            averias_notas=data.get("averias_notas", ""),
            observaciones_tecnicas_adicionales=(data.get("observaciones_tecnicas_adicionales") or "").strip() or None,
            servicios_aplicados=json.dumps(servicios_aplicados),
            fotos_cloudinary="[]",
            videos_cloudinary="[]",
            confirmado=False
        )

        db.session.add(inspeccion)

        # Notificación interna en sistema
        try:
            from models.base import now_madrid as _now
            hora_str = _now().strftime("%d/%m/%Y %H:%M")
            notif = Notificacion(
                tipo="inspeccion",
                titulo=f"Nueva recepción: {matricula}",
                cuerpo=f"Cliente: {cliente_nombre} · Tel: {cliente_telefono} · {hora_str}",
                ref_id=None,  # se actualiza tras commit
            )
            db.session.add(notif)
        except Exception:
            pass

        db.session.commit()

        # Actualizar ref_id con el id real de la inspección
        try:
            notif.ref_id = inspeccion.id
            db.session.commit()
        except Exception:
            pass

        # Notificación WhatsApp al administrador (no bloquea la respuesta si falla)
        try:
            from models.base import now_madrid as _now
            hora_str = _now().strftime("%d/%m/%Y %H:%M")
            enviar_notificacion_inspeccion(
                cliente_nombre=cliente_nombre,
                matricula=matricula,
                cliente_telefono=cliente_telefono,
                fecha_hora=hora_str,
            )
        except Exception:
            pass

        # Crear partes de trabajo automáticamente según el rol de cada servicio
        _auto_crear_partes_desde_inspeccion(inspeccion)

        # Registrar en Google Sheets (no bloquea si falla)
        try:
            from services.google_sheets_service import registrar_inspeccion as _sheets_registrar
            ok = _sheets_registrar(inspeccion, servicios_aplicados_raw=inspeccion.servicios_aplicados)
            if not ok:
                logging.error(
                    "[Google Sheets] No se pudo registrar inspección id=%s matricula=%s",
                    inspeccion.id,
                    inspeccion.matricula,
                )
        except Exception as _e:
            import logging as _log
            _log.warning(f"[Google Sheets] Error al registrar inspección: {_e}")

        return jsonify(inspeccion.to_dict()), 201

    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al crear inspección: {str(e)}"}), 500


# ============ LISTAR MIS INSPECCIONES (EMPLEADO) O TODAS (ADMIN) ============
@inspeccion_bp.route("/inspeccion-recepcion", methods=["GET"])
@jwt_required()
def listar_inspecciones():
    """
    Listar inspecciones.
    - Admin: ve todas
    - Empleado: ve solo las suyas
    """
    user_id = _jwt_user_id()
    if user_id is None:
        return jsonify({"msg": "Token inválido"}), 401
    user = User.query.get(user_id)
    if not _is_inspeccion_role(user):
        return jsonify({"msg": "No tienes permiso para esta acción"}), 403

    try:
        if _can_view_all_inspecciones(user):
            # Administrador y calidad ven todas
            inspecciones = InspeccionRecepcion.query.order_by(
                InspeccionRecepcion.fecha_inspeccion.desc()
            ).all()
        else:
            # Roles operativos ven solo sus propias inspecciones
            inspecciones = InspeccionRecepcion.query.filter(
                InspeccionRecepcion.usuario_id == user_id
            ).order_by(
                InspeccionRecepcion.fecha_inspeccion.desc()
            ).all()

        for inspeccion in inspecciones:
            if _safe_servicios_aplicados(inspeccion):
                _auto_crear_partes_desde_inspeccion(inspeccion)

        coche_ids = [i.coche_id for i in inspecciones if i.coche_id]
        partes_por_coche = _get_partes_por_coche(coche_ids)
        return jsonify([_serialize_inspeccion_con_estado(i, partes_por_coche) for i in inspecciones]), 200

    except Exception as e:
        return jsonify({"msg": f"Error al listar inspecciones: {str(e)}"}), 500


# ============ LISTAR PENDIENTES DE ENTREGA (OPERATIVO) ============
@inspeccion_bp.route("/inspeccion-recepcion/pendientes-entrega", methods=["GET"])
@role_required("administrador", "calidad", "detailing")
def listar_pendientes_entrega():
    """
    Lista operativa para firma de entrega.
    Puede verla admin, encargado y empleado.
    """
    try:
        inspecciones = (
            InspeccionRecepcion.query
            .filter(
                or_(
                    InspeccionRecepcion.entregado.is_(False),
                    InspeccionRecepcion.entregado.is_(None),
                )
            )
            .order_by(InspeccionRecepcion.fecha_inspeccion.desc())
            .all()
        )

        # Auto-recuperar inspecciones antiguas o editadas que ya tienen servicios
        # pero se quedaron sin crear el parte automático.
        for inspeccion in inspecciones:
            if _safe_servicios_aplicados(inspeccion):
                _auto_crear_partes_desde_inspeccion(inspeccion)

        coche_ids = [i.coche_id for i in inspecciones if i.coche_id]
        partes_por_coche = _get_partes_por_coche(coche_ids)
        return jsonify([_serialize_inspeccion_con_estado(i, partes_por_coche) for i in inspecciones]), 200
    except Exception as e:
        return jsonify({"msg": f"Error al listar pendientes de entrega: {str(e)}"}), 500


# ============ VER INSPECCIÓN ============
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>", methods=["GET"])
@jwt_required()
def ver_inspeccion(inspeccion_id):
    """
    Ver una inspección específica.
    - Admin: puede ver cualquiera.
    - Encargado/Empleado: puede ver inspecciones no entregadas para operativa de firma.
    - Otros roles: solo su propia inspección.
    """
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)

    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    user_id = _jwt_user_id()
    if user_id is None:
        return jsonify({"msg": "Token inválido"}), 401
    user = User.query.get(user_id)
    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 401
    if not _is_inspeccion_role(user):
        return jsonify({"msg": "No tienes permiso para esta acción"}), 403

    # Validar permisos por rol y operativa de entrega.
    def _to_dict_con_estado():
        if _safe_servicios_aplicados(inspeccion):
            _auto_crear_partes_desde_inspeccion(inspeccion)
        partes = _get_partes_por_coche([inspeccion.coche_id] if inspeccion.coche_id else [])
        return _serialize_inspeccion_con_estado(inspeccion, partes)

    if user.rol == "administrador":
        return jsonify(_to_dict_con_estado()), 200

    if normalize_role(user.rol) in {"detailing", "calidad"}:
        if inspeccion.entregado:
            return jsonify({"msg": "No tienes permiso para ver esta inspección"}), 403
        return jsonify(_to_dict_con_estado()), 200

    if inspeccion.usuario_id != user_id:
        return jsonify({"msg": "No tienes permiso para ver esta inspección"}), 403

    return jsonify(_to_dict_con_estado()), 200


# ============ ACTUALIZAR INSPECCIÓN ============
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>", methods=["PUT"])
@jwt_required()
def actualizar_inspeccion(inspeccion_id):
    """
    Actualizar una inspección.
    - Admin: puede actualizar cualquiera
    - Empleado: solo puede actualizar la suya (si no está confirmada)
    """
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)

    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    user_id = _jwt_user_id()
    if not user_id:
        return jsonify({"msg": "Usuario no válido en el token"}), 401
    user = User.query.get(user_id)
    if not _is_inspeccion_role(user):
        return jsonify({"msg": "No tienes permiso para esta acción"}), 403

    # Validar permisos: admin y calidad pueden actualizar cualquier inspección
    # para reflejar cambios posteriores solicitados por el cliente.
    if not _can_view_all_inspecciones(user) and inspeccion.usuario_id != user_id:
        return jsonify({"msg": "No tienes permiso para actualizar esta inspección"}), 403

    data = request.get_json()

    try:
        if "cliente_id" in data:
            cliente_id_raw = data.get("cliente_id")
            if cliente_id_raw in (None, ""):
                inspeccion.cliente_id = None
            else:
                try:
                    cliente_id = int(cliente_id_raw)
                except (TypeError, ValueError):
                    return jsonify({"msg": "cliente_id inválido"}), 400
                cliente = Cliente.query.get(cliente_id)
                if not cliente:
                    return jsonify({"msg": "Cliente no encontrado"}), 404

                cliente_nombre_payload = (data.get("cliente_nombre") or "").strip()
                cliente_telefono_payload = (data.get("cliente_telefono") or "").strip()
                if _cliente_payload_matches(cliente, cliente_nombre_payload, cliente_telefono_payload):
                    inspeccion.cliente_id = cliente.id
                    if not cliente_nombre_payload:
                        inspeccion.cliente_nombre = (cliente.nombre or "").strip()
                    if not cliente_telefono_payload:
                        inspeccion.cliente_telefono = (cliente.telefono or "").strip()
                else:
                    inspeccion.cliente_id = None

        # Permitir actualizar solo ciertos campos
        if "cliente_nombre" in data:
            inspeccion.cliente_nombre = data["cliente_nombre"]

        if "cliente_telefono" in data:
            inspeccion.cliente_telefono = data["cliente_telefono"]

        if "coche_descripcion" in data:
            inspeccion.coche_descripcion = data["coche_descripcion"]

        if "matricula" in data:
            inspeccion.matricula = data["matricula"]

        if "kilometros" in data:
            try:
                kilometros = int(data["kilometros"])
                if kilometros < 0:
                    return jsonify({"msg": "El campo kilometros debe ser mayor o igual a 0"}), 400
                inspeccion.kilometros = kilometros
            except (TypeError, ValueError):
                return jsonify({"msg": "El campo kilometros debe ser un numero entero"}), 400

        if "requiere_hoja_intervencion" in data:
            inspeccion.requiere_hoja_intervencion = bool(data["requiere_hoja_intervencion"])

        if "es_concesionario" in data:
            inspeccion.es_concesionario = bool(data["es_concesionario"])
            if inspeccion.es_concesionario:
                inspeccion.firma_cliente_recepcion = None

        if "firma_cliente_recepcion" in data:
            if inspeccion.es_concesionario:
                inspeccion.firma_cliente_recepcion = None
            else:
                inspeccion.firma_cliente_recepcion = data["firma_cliente_recepcion"]

        if "firma_empleado_recepcion" in data:
            # Se ignora por decisión de negocio: no pedir ni guardar firma de empleado.
            inspeccion.firma_empleado_recepcion = None

        servicios_actualizados = False

        if "consentimiento_datos_recepcion" in data:
            inspeccion.consentimiento_datos_recepcion = bool(data["consentimiento_datos_recepcion"])

        if "averias_notas" in data:
            inspeccion.averias_notas = data["averias_notas"]

        if "observaciones_tecnicas_adicionales" in data:
            inspeccion.observaciones_tecnicas_adicionales = (
                (data.get("observaciones_tecnicas_adicionales") or "").strip() or None
            )

        if "servicios_aplicados" in data:
            servicios_aplicados = _normalize_servicios_aplicados(data.get("servicios_aplicados"))
            inspeccion.servicios_aplicados = json.dumps(servicios_aplicados)
            servicios_actualizados = True

        # Solo admin puede confirmar
        if "confirmado" in data and user.rol == "administrador":
            inspeccion.confirmado = data["confirmado"]

        if servicios_actualizados:
            _eliminar_partes_huerfanos_pendientes(inspeccion, servicios_aplicados)
            _sync_partes_pendientes_desde_servicios(inspeccion, servicios_aplicados)
            _auto_crear_partes_desde_inspeccion(inspeccion)

        db.session.commit()

        # Sincronizar con Google Sheets
        try:
            from services.google_sheets_service import actualizar_inspeccion as _sheets_actualizar
            _sheets_actualizar(inspeccion)
        except Exception as e:
            logging.warning(f"[Google Sheets] Error al sincronizar actualización: {e}")

        partes = _get_partes_por_coche([inspeccion.coche_id] if inspeccion.coche_id else [])
        return jsonify(_serialize_inspeccion_con_estado(inspeccion, partes)), 200

    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al actualizar inspección: {str(e)}"}), 500


# ============ ELIMINAR INSPECCIÓN ============
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>", methods=["DELETE"])
@jwt_required()
def eliminar_inspeccion(inspeccion_id):
    """
    Eliminar una inspección.
    - Admin: puede eliminar cualquiera.
    - Empleado: solo puede eliminar la suya y si no esta entregada.
    """
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)

    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    user_id = _jwt_user_id()
    if not user_id:
        return jsonify({"msg": "Usuario no válido en el token"}), 401
    user = User.query.get(user_id)

    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 401
    if not _is_inspeccion_role(user):
        return jsonify({"msg": "No tienes permiso para esta acción"}), 403

    can_delete_any = user.rol in {"administrador", "encargado"}

    if not can_delete_any:
        if inspeccion.usuario_id != user_id:
            return jsonify({"msg": "No tienes permiso para eliminar esta inspección"}), 403
        if inspeccion.entregado:
            return jsonify({"msg": "No se puede eliminar una inspección ya entregada"}), 400

    try:
        # Si existe acta de entrega asociada, eliminarla antes de borrar la inspección
        # para evitar violación de FK NOT NULL en acta_entrega.inspeccion_id.
        acta = ActaEntrega.query.filter_by(inspeccion_id=inspeccion.id).first()
        if acta:
            db.session.delete(acta)
            db.session.flush()

        matricula = inspeccion.matricula
        db.session.delete(inspeccion)
        db.session.commit()

        # Eliminar del Google Sheet
        try:
            from services.google_sheets_service import eliminar_inspeccion as _sheets_eliminar
            _sheets_eliminar(matricula)
        except Exception:
            pass

        return jsonify({"msg": "Inspección eliminada correctamente"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al eliminar inspección: {str(e)}"}), 500
