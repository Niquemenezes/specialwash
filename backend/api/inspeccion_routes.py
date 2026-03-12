from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
import cloudinary
import cloudinary.uploader
import json
import os
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from sqlalchemy import or_

from models import db
from models.inspeccion_recepcion import InspeccionRecepcion
from models.acta_entrega import ActaEntrega
from models.user import User
from models.coche import Coche
from models.cliente import Cliente
from models.base import now_madrid
from utils.auth_utils import normalize_role
from services.whatsapp_service import enviar_notificacion_inspeccion
from models.notificacion import Notificacion
from services.openai_service import get_openai_service

inspeccion_bp = Blueprint('inspeccion', __name__, url_prefix='/api')


def _telefono_digits(value):
    return "".join(ch for ch in (value or "") if ch.isdigit())


def _jwt_user_id():
    try:
        return int(get_jwt_identity())
    except (TypeError, ValueError):
        return None

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "").strip()
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "").strip()


def _cloudinary_configured():
    return bool(CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET)


# Configurar Cloudinary solo si existen variables de entorno seguras.
if _cloudinary_configured():
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
    )

# Decorador para validar rol
def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            current_user_id = _jwt_user_id()
            user = User.query.get(current_user_id)
            allowed_roles = {normalize_role(r) for r in roles}
            user_role = normalize_role(getattr(user, "rol", "")) if user else ""
            if not user or user_role not in allowed_roles:
                return jsonify({"msg": "No tienes permiso para esta acción"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ============ CREAR INSPECCIÓN ============
@inspeccion_bp.route("/inspeccion-recepcion", methods=["POST"])
@role_required("administrador", "empleado", "encargado")
def crear_inspeccion():
    """
    Crear una nueva inspección de recepción.
    Campos requeridos:
    - cliente_nombre (str)
    - cliente_telefono (str)
    - coche_descripcion (str)
    - matricula (str)
    - kilometros (int)
    - firma_cliente_recepcion (base64)
    - firma_empleado_recepcion (base64)
    - averias_notas (str, opcional)
    """
    data = request.get_json(silent=True) or {}
    user_id = get_jwt_identity()
    
    try:
        # Validar campos requeridos
        required_fields = [
            "cliente_nombre",
            "cliente_telefono",
            "coche_descripcion",
            "matricula",
            "kilometros",
            "firma_cliente_recepcion",
            "firma_empleado_recepcion",
        ]
        for field in required_fields:
            if not data.get(field):
                return jsonify({"msg": f"Campo requerido: {field}"}), 400
        
        cliente_nombre = data.get("cliente_nombre").strip()
        cliente_telefono = data.get("cliente_telefono").strip()
        matricula = data.get("matricula").upper().strip()
        kilometros = data.get("kilometros")
        consentimiento_datos_recepcion = bool(data.get("consentimiento_datos_recepcion", False))

        if not consentimiento_datos_recepcion:
            return jsonify({"msg": "Debe aceptarse la proteccion de datos en recepcion"}), 400

        try:
            kilometros = int(kilometros)
            if kilometros < 0:
                return jsonify({"msg": "El campo kilometros debe ser mayor o igual a 0"}), 400
        except (TypeError, ValueError):
            return jsonify({"msg": "El campo kilometros debe ser un numero entero"}), 400
        
        # 1. Buscar o crear cliente (prioridad por telefono para evitar duplicados)
        cliente = Cliente.query.filter_by(telefono=cliente_telefono).first()

        if not cliente:
            telefono_digits = _telefono_digits(cliente_telefono)
            if telefono_digits:
                candidatos = Cliente.query.filter(Cliente.telefono.isnot(None)).all()
                for candidato in candidatos:
                    if _telefono_digits(candidato.telefono) == telefono_digits:
                        cliente = candidato
                        break

        if not cliente:
            cliente = Cliente.query.filter_by(nombre=cliente_nombre, telefono=cliente_telefono).first()

        if not cliente:
            # Crear cliente automáticamente
            cliente = Cliente(
                nombre=cliente_nombre,
                telefono=cliente_telefono,
                email=None,
                cif=None,
                direccion=None
            )
            db.session.add(cliente)
            db.session.flush()  # Obtener el ID sin commit aún
        else:
            # Si existe el cliente pero viene sin nombre, se completa con el de inspeccion.
            if not (cliente.nombre or "").strip() and cliente_nombre:
                cliente.nombre = cliente_nombre
        
        # 2. Buscar o crear coche
        coche = Coche.query.filter_by(matricula=matricula).first()
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
            firma_cliente_recepcion=data.get("firma_cliente_recepcion"),
            firma_empleado_recepcion=data.get("firma_empleado_recepcion"),
            consentimiento_datos_recepcion=consentimiento_datos_recepcion,
            averias_notas=data.get("averias_notas", ""),
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

        return jsonify(inspeccion.to_dict()), 201
    
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
    
    try:
        if user.rol == "administrador":
            # Admin ve todas
            inspecciones = InspeccionRecepcion.query.order_by(
                InspeccionRecepcion.fecha_inspeccion.desc()
            ).all()
        else:
            # Empleado ve solo sus propias inspecciones
            inspecciones = InspeccionRecepcion.query.filter(
                InspeccionRecepcion.usuario_id == user_id
            ).order_by(
                InspeccionRecepcion.fecha_inspeccion.desc()
            ).all()
        
        return jsonify([i.to_dict() for i in inspecciones]), 200
    
    except Exception as e:
        return jsonify({"msg": f"Error al listar inspecciones: {str(e)}"}), 500


# ============ LISTAR PENDIENTES DE ENTREGA (OPERATIVO) ============
@inspeccion_bp.route("/inspeccion-recepcion/pendientes-entrega", methods=["GET"])
@role_required("administrador", "empleado", "encargado")
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
        return jsonify([i.to_dict() for i in inspecciones]), 200
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
    
    # Validar permisos por rol y operativa de entrega.
    if user.rol == "administrador":
        return jsonify(inspeccion.to_dict()), 200

    if user.rol in ("empleado", "encargado"):
        if inspeccion.entregado:
            return jsonify({"msg": "No tienes permiso para ver esta inspección"}), 403
        return jsonify(inspeccion.to_dict()), 200

    if inspeccion.usuario_id != user_id:
        return jsonify({"msg": "No tienes permiso para ver esta inspección"}), 403
    
    return jsonify(inspeccion.to_dict()), 200


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
    
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    # Validar permisos
    if user.rol != "administrador" and inspeccion.usuario_id != user_id:
        return jsonify({"msg": "No tienes permiso para actualizar esta inspección"}), 403
    
    data = request.get_json()
    
    try:
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

        if "firma_cliente_recepcion" in data:
            inspeccion.firma_cliente_recepcion = data["firma_cliente_recepcion"]

        if "firma_empleado_recepcion" in data:
            inspeccion.firma_empleado_recepcion = data["firma_empleado_recepcion"]

        if "consentimiento_datos_recepcion" in data:
            inspeccion.consentimiento_datos_recepcion = bool(data["consentimiento_datos_recepcion"])
        
        if "averias_notas" in data:
            inspeccion.averias_notas = data["averias_notas"]
        
        # Solo admin puede confirmar
        if "confirmado" in data and user.rol == "administrador":
            inspeccion.confirmado = data["confirmado"]
        
        db.session.commit()
        return jsonify(inspeccion.to_dict()), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al actualizar inspección: {str(e)}"}), 500


# ============ REGISTRAR ENTREGA ==========
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/acta", methods=["POST"])
@role_required("administrador", "empleado", "encargado")
def guardar_acta_entrega(inspeccion_id):
    """
    Guardar/actualizar el acta de entrega como documento en estado pendiente.
    No marca el vehiculo como entregado.
    Campos requeridos:
    - trabajos_realizados (str)
    Campos opcionales:
    - entrega_observaciones (str)
    """
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    data = request.get_json() or {}
    if not (data.get("trabajos_realizados") or "").strip():
        return jsonify({"msg": "Campo requerido: trabajos_realizados"}), 400

    try:
        inspeccion.trabajos_realizados = data.get("trabajos_realizados", "").strip()
        inspeccion.entrega_observaciones = data.get("entrega_observaciones", "").strip()

        db.session.commit()
        return jsonify(inspeccion.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al guardar acta: {str(e)}"}), 500


@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/entrega", methods=["POST"])
@role_required("administrador", "empleado", "encargado")
def registrar_entrega(inspeccion_id):
    """
    Registrar entrega del vehiculo con acta tecnica.
    Campos requeridos:
    - trabajos_realizados (str)
    Campos opcionales:
    - entrega_observaciones (str)
    - firma_cliente_entrega (base64)
    - firma_empleado_entrega (base64)
    - consentimiento_datos_entrega (bool)
    - conformidad_revision_entrega (bool)
    """
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    data = request.get_json() or {}
    required_fields = ["trabajos_realizados"]
    for field in required_fields:
        if not data.get(field):
            return jsonify({"msg": f"Campo requerido: {field}"}), 400

    if not (data.get("firma_cliente_entrega") or "").strip():
        return jsonify({"msg": "Campo requerido: firma_cliente_entrega"}), 400

    consentimiento_datos_entrega = bool(data.get("consentimiento_datos_entrega", False))
    if not consentimiento_datos_entrega:
        return jsonify({"msg": "Debe aceptarse la proteccion de datos en entrega"}), 400

    conformidad_revision_entrega = bool(data.get("conformidad_revision_entrega", False))

    try:
        inspeccion.trabajos_realizados = data.get("trabajos_realizados", "").strip()
        inspeccion.entrega_observaciones = data.get("entrega_observaciones", "").strip()
        inspeccion.firma_cliente_entrega = data.get("firma_cliente_entrega")
        inspeccion.firma_empleado_entrega = data.get("firma_empleado_entrega")
        inspeccion.consentimiento_datos_entrega = consentimiento_datos_entrega
        inspeccion.conformidad_revision_entrega = conformidad_revision_entrega
        inspeccion.entregado = True
        inspeccion.fecha_entrega = now_madrid()

        # Notificación interna al admin/encargado
        try:
            from models.base import now_madrid as _now
            hora_str = _now().strftime("%d/%m/%Y %H:%M")
            notif_entrega = Notificacion(
                tipo="entrega",
                titulo=f"Coche entregado: {inspeccion.matricula}",
                cuerpo=f"Cliente: {inspeccion.cliente_nombre} · {hora_str}",
                ref_id=inspeccion.id,
            )
            db.session.add(notif_entrega)
        except Exception:
            pass

        # Crear/actualizar snapshot de acta final entregada con firmas.
        acta = ActaEntrega.query.filter_by(inspeccion_id=inspeccion.id).first()
        if not acta:
            acta = ActaEntrega(inspeccion_id=inspeccion.id)
            db.session.add(acta)

        acta.cliente_nombre = inspeccion.cliente_nombre or "-"
        acta.coche_descripcion = inspeccion.coche_descripcion or "-"
        acta.matricula = inspeccion.matricula or "-"
        acta.trabajos_realizados = inspeccion.trabajos_realizados or ""
        acta.entrega_observaciones = inspeccion.entrega_observaciones
        acta.firma_cliente_entrega = inspeccion.firma_cliente_entrega
        acta.firma_empleado_entrega = inspeccion.firma_empleado_entrega
        acta.consentimiento_datos_entrega = consentimiento_datos_entrega
        acta.conformidad_revision_entrega = conformidad_revision_entrega
        acta.fecha_entrega = inspeccion.fecha_entrega or now_madrid()

        db.session.commit()
        return jsonify(inspeccion.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al registrar entrega: {str(e)}"}), 500


@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/acta-final", methods=["GET"])
@jwt_required()
def ver_acta_final(inspeccion_id):
    """Ver acta final entregada (snapshot con firmas) de una inspeccion."""
    acta = ActaEntrega.query.filter_by(inspeccion_id=inspeccion_id).first()
    if not acta:
        return jsonify({"msg": "Acta final no encontrada"}), 404

    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Empleado solo puede ver actas de sus inspecciones.
    if user and user.rol != "administrador":
        inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
        if not inspeccion or inspeccion.usuario_id != user_id:
            return jsonify({"msg": "No tienes permiso para ver esta acta"}), 403

    return jsonify(acta.to_dict()), 200


@inspeccion_bp.route("/actas-entregadas", methods=["GET"])
@role_required("administrador", "encargado")
def listar_actas_entregadas():
    """Listar actas finales de coches entregados."""
    items = ActaEntrega.query.order_by(ActaEntrega.fecha_entrega.desc()).all()
    return jsonify([i.to_dict() for i in items]), 200


# ============ SUGERIR ACTA PREMIUM CON GPT ==========
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/sugerir-acta", methods=["POST"])
@role_required("administrador", "empleado", "encargado")
def sugerir_acta_premium(inspeccion_id):
    """Genera un texto formal de acta de entrega con GPT usando OpenAI API."""
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    try:
        openai_service = get_openai_service()
        if not openai_service.is_configured():
            return jsonify({"msg": "Falta configurar OPENAI_API_KEY en el backend"}), 500

        data = request.get_json() or {}
        borrador = (data.get("borrador") or "").strip()
        averias = (data.get("averias_notas") or inspeccion.averias_notas or "").strip()

        result = openai_service.generate_acta_completa(
            cliente_nombre=inspeccion.cliente_nombre or "-",
            coche_descripcion=inspeccion.coche_descripcion or "-",
            matricula=inspeccion.matricula or "-",
            kilometros=inspeccion.kilometros or "-",
            averias=averias,
            borrador=borrador,
        )
        return jsonify(result), 200

    except ValueError as e:
        return jsonify({"msg": str(e)}), 502
    except Exception as e:
        return jsonify({"msg": f"Error al generar acta: {str(e)}"}), 500


# ============ CHATBOT OPENAI PARA ACTA ==========
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/chat-acta", methods=["POST"])
@role_required("administrador", "empleado", "encargado")
def chat_acta_premium(inspeccion_id):
    """Chat conversacional para redactar acta de entrega con contexto de la inspeccion."""
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return jsonify({"msg": "Falta configurar OPENAI_API_KEY en el backend"}), 500

    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    data = request.get_json() or {}
    messages = data.get("messages") or []
    if not isinstance(messages, list) or len(messages) == 0:
        return jsonify({"msg": "Debes enviar una lista de mensajes"}), 400

    contexto = (
        f"Cliente: {inspeccion.cliente_nombre}\\n"
        f"Vehiculo: {inspeccion.coche_descripcion}\\n"
        f"Matricula: {inspeccion.matricula}\\n"
        f"Kilometros: {inspeccion.kilometros or '-'}\\n"
        f"Observaciones recepcion: {inspeccion.averias_notas or 'Sin observaciones'}"
    )

    safe_messages = []
    for m in messages[-12:]:
        role = m.get("role")
        content = (m.get("content") or "").strip()
        if role in {"user", "assistant"} and content:
            safe_messages.append({"role": role, "content": content})

    if not safe_messages:
        return jsonify({"msg": "No hay mensajes validos para procesar"}), 400

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Eres un asistente de taller automotriz en espanol de Espana. "
                    "Ayudas a redactar textos premium para actas de entrega. "
                    "No inventes datos tecnicos no proporcionados."
                ),
            },
            {
                "role": "system",
                "content": f"Contexto fijo de la inspeccion:\\n{contexto}",
            },
            *safe_messages,
        ],
        "temperature": 0.5,
    }

    req = urlrequest.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urlrequest.urlopen(req, timeout=45) as response:
            body = json.loads(response.read().decode("utf-8"))
        reply = (
            body.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )
        if not reply:
            return jsonify({"msg": "OpenAI no devolvio respuesta"}), 502
        return jsonify({"reply": reply, "model": model}), 200
    except HTTPError as e:
        try:
            error_body = e.read().decode("utf-8")
        except Exception:
            error_body = str(e)
        return jsonify({"msg": f"Error OpenAI: {error_body}"}), 502
    except URLError as e:
        return jsonify({"msg": f"No se pudo conectar con OpenAI: {str(e)}"}), 502
    except Exception as e:
        return jsonify({"msg": f"Error en chatbot OpenAI: {str(e)}"}), 500


# ============ SUBIR FOTO A CLOUDINARY ============
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/upload-foto", methods=["POST"])
@jwt_required()
def upload_foto(inspeccion_id):
    """
    Subir una foto a Cloudinary y vincularla a la inspección.
    """
    if not _cloudinary_configured():
        return jsonify({"msg": "Cloudinary no está configurado en el servidor"}), 503

    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404
    
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    # Validar que sea el creador o admin
    if user.rol != "administrador" and inspeccion.usuario_id != user_id:
        return jsonify({"msg": "No tienes permiso para subir fotos a esta inspección"}), 403
    
    if "file" not in request.files:
        return jsonify({"msg": "No se proporciono archivo"}), 400
    
    file = request.files["file"]
    
    if file.filename == "":
        return jsonify({"msg": "No se seleccionó archivo"}), 400
    
    try:
        # Subir foto a Cloudinary
        result = cloudinary.uploader.upload(
            file,
            folder=f"specialwash/inspecciones/{inspeccion_id}",
            resource_type="auto"
        )
        
        # Agregar URL a la lista de fotos
        fotos = json.loads(inspeccion.fotos_cloudinary or "[]")
        fotos.append({
            "url": result["secure_url"],
            "public_id": result["public_id"],
            "uploaded_at": result["created_at"]
        })
        inspeccion.fotos_cloudinary = json.dumps(fotos)
        
        db.session.commit()
        
        return jsonify({
            "msg": "Foto subida correctamente",
            "url": result["secure_url"],
            "total_fotos": len(fotos)
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al subir foto: {str(e)}"}), 500


# ============ SUBIR VIDEO A CLOUDINARY ============
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/upload-video", methods=["POST"])
@jwt_required()
def upload_video(inspeccion_id):
    """
    Subir un video a Cloudinary y vincularlo a la inspección.
    """
    if not _cloudinary_configured():
        return jsonify({"msg": "Cloudinary no está configurado en el servidor"}), 503

    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404
    
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    # Validar que sea el creador o admin
    if user.rol != "administrador" and inspeccion.usuario_id != user_id:
        return jsonify({"msg": "No tienes permiso para subir videos a esta inspección"}), 403
    
    if "file" not in request.files:
        return jsonify({"msg": "No se proporciono archivo"}), 400
    
    file = request.files["file"]
    
    if file.filename == "":
        return jsonify({"msg": "No se seleccionó archivo"}), 400
    
    try:
        # Subir video a Cloudinary (máximo 100MB en plan gratuito)
        result = cloudinary.uploader.upload(
            file,
            folder=f"specialwash/inspecciones/{inspeccion_id}",
            resource_type="video"
        )
        
        # Agregar URL a la lista de videos
        videos = json.loads(inspeccion.videos_cloudinary or "[]")
        videos.append({
            "url": result["secure_url"],
            "public_id": result["public_id"],
            "uploaded_at": result["created_at"]
        })
        inspeccion.videos_cloudinary = json.dumps(videos)
        
        db.session.commit()
        
        return jsonify({
            "msg": "Video subido correctamente",
            "url": result["secure_url"],
            "total_videos": len(videos)
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al subir video: {str(e)}"}), 500


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

    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 401

    if user.rol != "administrador":
        if inspeccion.usuario_id != user_id:
            return jsonify({"msg": "No tienes permiso para eliminar esta inspección"}), 403
        if inspeccion.entregado:
            return jsonify({"msg": "No se puede eliminar una inspección ya entregada"}), 400
    
    try:
        db.session.delete(inspeccion)
        db.session.commit()
        
        return jsonify({"msg": "Inspección eliminada correctamente"}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al eliminar inspección: {str(e)}"}), 500


# ============ ELIMINAR FOTO ============
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/foto/<int:foto_index>", methods=["DELETE"])
@jwt_required()
def eliminar_foto(inspeccion_id, foto_index):
    """
    Eliminar una foto de una inspección.
    """
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404
    
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    # Validar permisos
    if user.rol != "administrador" and inspeccion.usuario_id != user_id:
        return jsonify({"msg": "No tienes permiso para eliminar fotos de esta inspección"}), 403
    
    try:
        fotos = json.loads(inspeccion.fotos_cloudinary or "[]")
        
        if foto_index < 0 or foto_index >= len(fotos):
            return jsonify({"msg": "Índice de foto inválido"}), 400
        
        # Eliminar foto de Cloudinary
        foto_data = fotos[foto_index]
        if "public_id" in foto_data:
            cloudinary.uploader.destroy(foto_data["public_id"])
        
        fotos.pop(foto_index)
        inspeccion.fotos_cloudinary = json.dumps(fotos)
        
        db.session.commit()
        
        return jsonify({
            "msg": "Foto eliminada correctamente",
            "total_fotos": len(fotos)
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al eliminar foto: {str(e)}"}), 500


# ============ ELIMINAR VIDEO ============
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/video/<int:video_index>", methods=["DELETE"])
@jwt_required()
def eliminar_video(inspeccion_id, video_index):
    """
    Eliminar un video de una inspección.
    """
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404
    
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    # Validar permisos
    if user.rol != "administrador" and inspeccion.usuario_id != user_id:
        return jsonify({"msg": "No tienes permiso para eliminar videos de esta inspección"}), 403
    
    try:
        videos = json.loads(inspeccion.videos_cloudinary or "[]")
        
        if video_index < 0 or video_index >= len(videos):
            return jsonify({"msg": "Índice de video inválido"}), 400
        
        # Eliminar video de Cloudinary
        video_data = videos[video_index]
        if "public_id" in video_data:
            cloudinary.uploader.destroy(video_data["public_id"], resource_type="video")
        
        videos.pop(video_index)
        inspeccion.videos_cloudinary = json.dumps(videos)
        
        db.session.commit()
        
        return jsonify({
            "msg": "Video eliminado correctamente",
            "total_videos": len(videos)
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al eliminar video: {str(e)}"}), 500
