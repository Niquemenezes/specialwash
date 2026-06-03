from flask import Blueprint, request, jsonify
from sqlalchemy import or_

from models import db
from models.inspeccion_recepcion import InspeccionRecepcion
from models.gasto_empresa import GastoEmpresa
from models.user import User
from models.base import now_madrid
from utils.auth_utils import normalize_role
from utils.inspeccion_helpers import (
    role_required, _jwt_user_id, _aplicar_cobro_inspeccion,
    _get_partes_por_coche, _serialize_inspeccion_con_estado,
    _build_cobro_info, _importe_total_inspeccion, _COBRO_METODOS_VALIDOS,
)

cobro_bp = Blueprint('cobro', __name__, url_prefix='/api')


@cobro_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/cobro", methods=["POST"])
@role_required("administrador", "calidad")
def registrar_cobro_inspeccion(inspeccion_id):
    """Registrar cobro parcial o total y reflejarlo en caja (finanzas).
    Calidad solo puede cobrar particulares. Admin puede cobrar ambos."""
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    # Validar permisos: Calidad solo particulares, Admin todo
    user_id = _jwt_user_id()
    user = User.query.get(user_id) if user_id else None
    user_role = normalize_role(getattr(user, "rol", "")) if user else ""

    if user_role == "calidad" and inspeccion.es_concesionario:
        return jsonify({"msg": "Calidad solo puede cobrar clientes particulares"}), 403

    data = request.get_json(silent=True) or {}

    try:
        _aplicar_cobro_inspeccion(inspeccion, data)

        db.session.commit()

        partes = _get_partes_por_coche([inspeccion.coche_id] if inspeccion.coche_id else [])
        return jsonify(_serialize_inspeccion_con_estado(inspeccion, partes)), 200
    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al registrar cobro: {str(e)}"}), 500


@cobro_bp.route("/inspeccion-recepcion/cobros/profesionales", methods=["GET"])
@role_required("administrador")
def listar_cobros_profesionales():
    """Listado agrupado por cliente profesional para seguimiento de deuda/cobro."""
    solo_pendientes = str(request.args.get("solo_pendientes", "1")).strip().lower() not in {"0", "false", "no"}

    try:
        query = (
            InspeccionRecepcion.query
            .filter(InspeccionRecepcion.es_concesionario.is_(True))
            .filter(InspeccionRecepcion.entregado.is_(True))
            .order_by(InspeccionRecepcion.fecha_entrega.desc(), InspeccionRecepcion.id.desc())
        )
        items = query.all()

        if solo_pendientes:
            items = [i for i in items if _build_cobro_info(i)["importe_pendiente"] > 0.009]

        coche_ids = [i.coche_id for i in items if i.coche_id]
        partes_por_coche = _get_partes_por_coche(coche_ids)

        grouped = {}
        for insp in items:
            key = insp.cliente_id or f"nombre:{(insp.cliente_nombre or '').strip().lower()}"
            if key not in grouped:
                grouped[key] = {
                    "cliente_id": insp.cliente_id,
                    "cliente_nombre": insp.cliente_nombre or "Cliente profesional",
                    "total_facturado": 0.0,
                    "total_pagado": 0.0,
                    "total_pendiente": 0.0,
                    "inspecciones": [],
                }

            data = _serialize_inspeccion_con_estado(insp, partes_por_coche)
            cobro = data.get("cobro") or {}
            grouped[key]["total_facturado"] += float(cobro.get("importe_total") or 0)
            grouped[key]["total_pagado"] += float(cobro.get("importe_pagado") or 0)
            grouped[key]["total_pendiente"] += float(cobro.get("importe_pendiente") or 0)
            grouped[key]["inspecciones"].append(data)

        resp = []
        for _, cliente_data in grouped.items():
            cliente_data["total_facturado"] = round(cliente_data["total_facturado"], 2)
            cliente_data["total_pagado"] = round(cliente_data["total_pagado"], 2)
            cliente_data["total_pendiente"] = round(cliente_data["total_pendiente"], 2)
            resp.append(cliente_data)

        resp.sort(key=lambda x: x["total_pendiente"], reverse=True)
        return jsonify(resp), 200
    except Exception as e:
        return jsonify({"msg": f"Error al listar cobros profesionales: {str(e)}"}), 500


# ============ PAGOS DE PROFESIONALES (COCHES CONCESIONARIO ENTREGADOS) ============
@cobro_bp.route("/inspeccion-recepcion/profesionales/pagos-pendientes", methods=["GET"])
@role_required("administrador")
def listar_pagos_profesionales_pendientes_detalle():
    """
    Lista coches de profesionales entregados pendientes de pago.
    Importante: No incluye coches ya con cobro registrado.
    """
    try:
        inspecciones = (
            InspeccionRecepcion.query
            .filter(
                InspeccionRecepcion.es_concesionario == True,
                InspeccionRecepcion.entregado == True,
                or_(
                    InspeccionRecepcion.cobro_importe_pagado.is_(None),
                    InspeccionRecepcion.cobro_importe_pagado <= 0,
                ),
            )
            .order_by(InspeccionRecepcion.fecha_entrega.desc())
            .all()
        )

        result = []
        for inspeccion in inspecciones:
            importe_total = _importe_total_inspeccion(inspeccion)
            result.append({
                "id": inspeccion.id,
                "cliente_nombre": inspeccion.cliente_nombre,
                "coche_descripcion": inspeccion.coche_descripcion,
                "matricula": inspeccion.matricula,
                "fecha_entrega": inspeccion.fecha_entrega.isoformat() if inspeccion.fecha_entrega else None,
                "importe_total": importe_total,
                "cobro_importe_pagado": inspeccion.cobro_importe_pagado or 0.0,
                "cobro_metodo": inspeccion.cobro_metodo,
                "cobro_referencia": inspeccion.cobro_referencia,
            })

        return jsonify(result), 200
    except Exception as e:
        return jsonify({"msg": f"Error al listar pagos: {str(e)}"}), 500


@cobro_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/registrar-pago-profesional", methods=["POST"])
@role_required("administrador")
def registrar_pago_profesional_detalle(inspeccion_id):
    """
    Registra el pago de un profesional y genera ingreso en finanzas.
    """
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    if not inspeccion.es_concesionario:
        return jsonify({"msg": "Esta inspección no es de un profesional"}), 400

    if not inspeccion.entregado:
        return jsonify({"msg": "El coche aún no ha sido entregado"}), 400

    try:
        data = request.get_json() or {}
        importe = float(data.get("importe", 0))
        metodo = (data.get("metodo") or "").strip().lower()
        referencia = (data.get("referencia") or "").strip()
        observaciones = (data.get("observaciones") or "").strip()

        if importe <= 0:
            return jsonify({"msg": "El importe debe ser mayor que 0"}), 400

        if metodo not in _COBRO_METODOS_VALIDOS:
            return jsonify({"msg": f"Método de pago no válido: {metodo}"}), 400

        # Registrar pago en inspección
        inspeccion.cobro_importe_pagado = round(max(importe, 0.0), 2)
        inspeccion.cobro_metodo = metodo
        inspeccion.cobro_referencia = referencia
        inspeccion.cobro_observaciones = observaciones

        # Crear ingreso en finanzas
        try:
            matricula = inspeccion.matricula or f"coche #{inspeccion.coche_id}"
            cliente = inspeccion.cliente_nombre or "Profesional"
            concepto = f"Cobro profesional {cliente} - {matricula}"

            gasto = GastoEmpresa(
                fecha=now_madrid(),
                concepto=concepto,
                categoria="ingreso_cobro_profesional",
                importe=importe,
                responsable_id=_jwt_user_id(),
                observaciones=observaciones if observaciones else f"Ref: {referencia}" if referencia else None,
            )
            db.session.add(gasto)
        except Exception as e:
            # No bloquear si falla finanzas
            pass

        db.session.commit()

        partes = _get_partes_por_coche([inspeccion.coche_id] if inspeccion.coche_id else [])
        resultado = _serialize_inspeccion_con_estado(inspeccion, partes)
        resultado["cobro_entrega_registrado"] = True

        return jsonify(resultado), 200

    except ValueError:
        return jsonify({"msg": "Importe inválido"}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al registrar pago: {str(e)}"}), 500
