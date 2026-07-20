from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
import json
import logging
import os
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

from models import db
from models.inspeccion_recepcion import InspeccionRecepcion
from models.acta_entrega import ActaEntrega
from models.parte_trabajo import ParteTrabajo, EstadoParte
from models.notificacion import Notificacion
from models.base import now_madrid
from models.user import User
from services.whatsapp_service import enviar_notificacion_entrega_cliente
from services.openai_service import get_openai_service
from utils.inspeccion_helpers import (
    role_required, _jwt_user_id, _to_bool, _aplicar_cobro_inspeccion,
    _safe_servicios_aplicados, _build_trabajos_realizados_desde_partes,
)

entrega_bp = Blueprint('entrega', __name__, url_prefix='/api')


# ============ REGISTRAR ENTREGA ==========
@entrega_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/acta", methods=["POST"])
@role_required("administrador")
def guardar_acta_entrega(inspeccion_id):
    """Guardar hoja técnica de intervención (solo Admin)."""
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
        inspeccion.observaciones_tecnicas_adicionales = (data.get("observaciones_tecnicas_adicionales") or "").strip() or None

        db.session.commit()
        return jsonify(inspeccion.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al guardar acta: {str(e)}"}), 500


@entrega_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/entrega", methods=["POST"])
@role_required("administrador", "calidad", "detailing")
def registrar_entrega(inspeccion_id):
    """
    Registrar entrega del vehiculo con acta tecnica.
    Campos requeridos:
    - trabajos_realizados (str)
    Campos opcionales:
    - entrega_observaciones (str)
    - kilometros_entrega (int)
    - firma_cliente_entrega (base64)
    - consentimiento_datos_entrega (bool)
    - conformidad_revision_entrega (bool)
    - registrar_cobro (bool)
    - cobro_accion (abono|marcar_pagado_total)
    - cobro_importe (float, cuando accion=abono)
    - cobro_metodo (efectivo|bizum|tarjeta|transferencia)
    - cobro_referencia (str)
    - cobro_observaciones (str)
    """
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    # Bloquear entrega si hay partes de trabajo abiertos (solo para no-administradores)
    claims = get_jwt()
    rol_actual = claims.get("rol", "")
    if rol_actual != "administrador":
        partes_abiertos = ParteTrabajo.query.filter(
            ParteTrabajo.inspeccion_id == inspeccion_id,
            ParteTrabajo.estado.in_([EstadoParte.pendiente, EstadoParte.en_proceso, EstadoParte.en_pausa])
        ).count()
        if partes_abiertos > 0:
            return jsonify({"msg": f"No se puede entregar el vehículo: hay {partes_abiertos} parte(s) de trabajo sin finalizar."}), 400

    # Bloquear entrega si el repaso no está completado
    if not inspeccion.repaso_completado:
        return jsonify({"msg": "No se puede entregar el vehículo: el repaso de calidad no está completado."}), 400

    data = request.get_json() or {}
    es_concesionario = bool(inspeccion.es_concesionario)

    # Determinar trabajos_realizados: del request, luego del registro previo,
    # luego de los partes realmente finalizados y, por último, de servicios contratados.
    _tr = (data.get("trabajos_realizados") or "").strip()
    if not _tr:
        _tr = (inspeccion.trabajos_realizados or "").strip()
    if not _tr:
        _tr = _build_trabajos_realizados_desde_partes(inspeccion)
    if not _tr:
        _svcs = _safe_servicios_aplicados(inspeccion)
        _tr = "\n".join(s["nombre"] for s in _svcs if s.get("nombre"))
    trabajos_realizados_final = _tr

    if not es_concesionario and not (data.get("firma_cliente_entrega") or "").strip():
        return jsonify({"msg": "Campo requerido: firma_cliente_entrega"}), 400

    consentimiento_datos_entrega = bool(data.get("consentimiento_datos_entrega", False))
    if not es_concesionario and not consentimiento_datos_entrega:
        return jsonify({"msg": "Debe aceptarse la proteccion de datos en entrega"}), 400

    conformidad_revision_entrega = bool(data.get("conformidad_revision_entrega", False))
    registrar_cobro = _to_bool(data.get("registrar_cobro", False))
    cobro_registrado_en_entrega = False

    kilometros_entrega = data.get("kilometros_entrega")
    if kilometros_entrega not in (None, ""):
        try:
            kilometros_entrega = int(kilometros_entrega)
            if kilometros_entrega < 0:
                return jsonify({"msg": "El kilometraje de entrega debe ser mayor o igual a 0"}), 400
        except (TypeError, ValueError):
            return jsonify({"msg": "El kilometraje de entrega debe ser un número entero"}), 400

    try:
        inspeccion.trabajos_realizados = trabajos_realizados_final
        inspeccion.entrega_observaciones = data.get("entrega_observaciones", "").strip()
        inspeccion.firma_cliente_entrega = None if es_concesionario else data.get("firma_cliente_entrega")
        # Firma de empleado no se usa en entrega.
        inspeccion.firma_empleado_entrega = None
        inspeccion.consentimiento_datos_entrega = consentimiento_datos_entrega if not es_concesionario else False
        inspeccion.conformidad_revision_entrega = conformidad_revision_entrega if not es_concesionario else False
        if kilometros_entrega not in (None, ""):
            inspeccion.kilometros = kilometros_entrega
        inspeccion.entregado = True
        inspeccion.fecha_entrega = now_madrid()

        if registrar_cobro and not es_concesionario:
            _aplicar_cobro_inspeccion(
                inspeccion,
                {
                    "accion": data.get("cobro_accion") or "abono",
                    "importe": data.get("cobro_importe"),
                    "metodo": data.get("cobro_metodo"),
                    "referencia": data.get("cobro_referencia"),
                    "observaciones": data.get("cobro_observaciones"),
                },
            )
            cobro_registrado_en_entrega = True

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

        # Crear/actualizar snapshot de acta final entregada.
        # En profesionales se conserva el acta técnica, pero sin firma de cliente.
        acta = ActaEntrega.query.filter_by(inspeccion_id=inspeccion.id).first()
        if not acta:
            acta = ActaEntrega(inspeccion_id=inspeccion.id)
            db.session.add(acta)

        acta.cliente_nombre = inspeccion.cliente_nombre or "-"
        acta.coche_descripcion = inspeccion.coche_descripcion or "-"
        acta.matricula = inspeccion.matricula or "-"
        acta.trabajos_realizados = inspeccion.trabajos_realizados or ""
        acta.entrega_observaciones = inspeccion.entrega_observaciones
        acta.firma_cliente_entrega = inspeccion.firma_cliente_entrega or ""
        acta.firma_empleado_entrega = inspeccion.firma_empleado_entrega
        acta.consentimiento_datos_entrega = consentimiento_datos_entrega if not es_concesionario else False
        acta.conformidad_revision_entrega = conformidad_revision_entrega if not es_concesionario else False
        acta.fecha_entrega = inspeccion.fecha_entrega or now_madrid()

        db.session.commit()

        # Notificación WhatsApp al cliente
        try:
            hora_entrega = inspeccion.fecha_entrega.strftime("%d/%m/%Y %H:%M") if inspeccion.fecha_entrega else ""
            enviar_notificacion_entrega_cliente(
                cliente_nombre=inspeccion.cliente_nombre,
                matricula=inspeccion.matricula,
                cliente_telefono=inspeccion.cliente_telefono,
                fecha_hora=hora_entrega,
            )
        except Exception:
            pass  # Nunca bloquear la respuesta por el WhatsApp

        # Actualizar Google Sheets con fecha de entrega y forma de pago
        try:
            from services.google_sheets_service import registrar_entrega_sheets as _sheets_entrega
            _sheets_entrega(inspeccion)
        except Exception as _e:
            import logging as _log
            _log.warning(f"[Google Sheets] Error al registrar entrega: {_e}")

        payload = inspeccion.to_dict()
        payload["cobro_entrega_registrado"] = cobro_registrado_en_entrega
        return jsonify(payload), 200
    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al registrar entrega: {str(e)}"}), 500


@entrega_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/acta-final", methods=["GET"])
@jwt_required()
def ver_acta_final(inspeccion_id):
    """Ver acta final entregada (snapshot con firmas) de una inspeccion."""
    acta = ActaEntrega.query.filter_by(inspeccion_id=inspeccion_id).first()
    if not acta:
        return jsonify({"msg": "Acta final no encontrada"}), 404

    user_id = _jwt_user_id()
    if not user_id:
        return jsonify({"msg": "Usuario no válido en el token"}), 401
    user = User.query.get(user_id)

    # Empleado solo puede ver actas de sus inspecciones.
    if user and user.rol != "administrador":
        inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
        if not inspeccion or inspeccion.usuario_id != user_id:
            return jsonify({"msg": "No tienes permiso para ver esta acta"}), 403

    return jsonify(acta.to_dict()), 200


@entrega_bp.route("/actas-entregadas", methods=["GET"])
@role_required("administrador")
def listar_actas_entregadas():
    """Listar actas finales de coches entregados."""
    items = ActaEntrega.query.order_by(ActaEntrega.fecha_entrega.desc()).all()
    return jsonify([i.to_dict() for i in items]), 200


# ============ SUGERIR ACTA PREMIUM CON GPT ==========
@entrega_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/sugerir-acta", methods=["POST"])
@role_required("administrador")
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

        # Servicios contratados: parse desde servicios_aplicados
        servicios_raw = inspeccion.servicios_aplicados or "[]"
        try:
            servicios_list = json.loads(servicios_raw)
        except Exception:
            servicios_list = []
        servicios_nombres = [s.get("nombre", "") for s in servicios_list if s.get("nombre")]

        # Partes de trabajo finalizados con observaciones del técnico
        partes_insp = ParteTrabajo.query.filter_by(inspeccion_id=inspeccion_id).all()
        partes_info = []
        for p in partes_insp:
            obs = (getattr(p, "observaciones", "") or "").strip()
            nombre_emp = (getattr(getattr(p, "empleado", None), "nombre", "") or "").strip()
            tipo = (getattr(p, "tipo_tarea", "") or "").strip()
            if obs or tipo:
                partes_info.append(f"{tipo or 'trabajo'} ({nombre_emp or 'sin asignar'}): {obs or 'sin observaciones'}")

        result = openai_service.generate_acta_completa(
            cliente_nombre=inspeccion.cliente_nombre or "-",
            coche_descripcion=inspeccion.coche_descripcion or "-",
            matricula=inspeccion.matricula or "-",
            kilometros=inspeccion.kilometros or "-",
            averias=averias,
            borrador=borrador,
            servicios_contratados=servicios_nombres,
            partes_realizados=partes_info,
        )
        return jsonify(result), 200

    except ValueError as e:
        return jsonify({"msg": str(e)}), 502
    except Exception as e:
        return jsonify({"msg": f"Error al generar acta: {str(e)}"}), 500


# ============ CHATBOT OPENAI PARA ACTA ==========
@entrega_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/chat-acta", methods=["POST"])
@role_required("administrador")
def chat_acta_premium(inspeccion_id):
    """Chat conversacional para redactar acta de entrega con contexto de la inspeccion."""
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return jsonify({"msg": "Falta configurar OPENAI_API_KEY en el backend"}), 500

    model = os.getenv("OPENAI_MODEL", "gpt-5-mini")
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
    contexto = contexto[:900]

    safe_messages = []
    for m in messages[-4:]:  # max 4 turnos para reducir tokens de entrada
        role = m.get("role")
        content = (m.get("content") or "").strip()[:700]
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
        "max_tokens": 220,
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


# ============================================================
# REVERTIR ENTREGA (solo admin)
# ============================================================

@entrega_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/revertir-entrega", methods=["POST"])
@jwt_required()
@role_required("administrador")
def revertir_entrega(inspeccion_id):
    """
    Anula la entrega de un vehículo: revierte entregado=False, borra fecha_entrega
    y opcionalmente corrige es_concesionario. Solo administrador.
    """
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    data = request.get_json() or {}

    inspeccion.entregado = False
    inspeccion.fecha_entrega = None
    inspeccion.tabla_estado = None  # limpiar estado manual si lo hubiera

    if "es_concesionario" in data:
        inspeccion.es_concesionario = bool(data["es_concesionario"])

    db.session.commit()

    # Actualizar Google Sheets: limpiar fecha entrega, estado y color
    try:
        from services.google_sheets_service import revertir_entrega_sheets as _sheets_revertir
        _sheets_revertir(inspeccion)
    except Exception as e:
        logging.warning(f"[Google Sheets] Error al revertir entrega: {e}")

    logging.info(f"[Entrega revertida] inspeccion_id={inspeccion_id} matricula={inspeccion.matricula}")
    return jsonify(inspeccion.to_dict()), 200
