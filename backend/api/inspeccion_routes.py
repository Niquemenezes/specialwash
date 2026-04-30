from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt, decode_token
from functools import wraps
import cloudinary
import cloudinary.uploader
import json
import os
import uuid
from pathlib import Path
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError
import unicodedata

from sqlalchemy import or_

from models import db
from models.inspeccion_recepcion import InspeccionRecepcion
from models.acta_entrega import ActaEntrega
from models.user import User
from models.coche import Coche
from models.cliente import Cliente
from models.parte_trabajo import ParteTrabajo, EstadoParte
from models.gasto_empresa import GastoEmpresa
from models.servicio_catalogo import ServicioCatalogo
from models.base import now_madrid
from utils.auth_utils import normalize_role
from services.whatsapp_service import enviar_notificacion_inspeccion, enviar_notificacion_entrega_cliente
from models.notificacion import Notificacion
from services.openai_service import get_openai_service

inspeccion_bp = Blueprint('inspeccion', __name__, url_prefix='/api')


# ============ HELPERS ESTADO DEL COCHE ============

_PRIORIDAD_ESTADO_PARTE = {"en_proceso": 0, "en_pausa": 1, "pendiente": 2, "finalizado": 3}
_COBRO_METODOS_VALIDOS = {"efectivo", "bizum", "tarjeta", "transferencia"}


def _parte_recency_key(parte):
    """Clave de recencia para desempatar entre partes del mismo estado."""
    ref = parte.fecha_fin or parte.fecha_inicio
    if ref is None:
        return (0.0, int(parte.id or 0))
    return (ref.timestamp(), int(parte.id or 0))


def _parte_es_de_inspeccion_actual(parte, inspeccion):
    if not parte or not inspeccion:
        return False
    if getattr(parte, "inspeccion_id", None) != getattr(inspeccion, "id", None):
        return False
    if getattr(parte, "coche_id", None) != getattr(inspeccion, "coche_id", None):
        return False

    fecha_ref = getattr(inspeccion, "fecha_inspeccion", None) or getattr(inspeccion, "created_at", None)
    if fecha_ref is None:
        return True

    fecha_parte = getattr(parte, "fecha_fin", None) or getattr(parte, "fecha_inicio", None)
    if fecha_parte is None:
        return True
    return fecha_parte >= fecha_ref


def _filter_partes_info_por_inspeccion(partes_info, inspeccion):
    if not isinstance(partes_info, dict):
        return {
            "parte": None,
            "partes_activas_count": 0,
            "partes_activas_ids": [],
            "partes_activas_empleados": [],
            "partes_activas_detalle": [],
            "partes_roles_todos": [],
            "partes_finalizados_detalle": [],
        }

    inspeccion_id = getattr(inspeccion, "id", None)
    fecha_ref = getattr(inspeccion, "fecha_inspeccion", None) or getattr(inspeccion, "created_at", None)

    def _parse_dt(value):
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except Exception:
            return None

    def _parte_match(parte):
        if not parte or parte.get("inspeccion_id") != inspeccion_id:
            return False
        if fecha_ref is None:
            return True
        fecha_inicio = _parse_dt(parte.get("fecha_inicio"))
        fecha_fin = _parse_dt(parte.get("fecha_fin"))
        fecha_parte = fecha_fin or fecha_inicio
        if fecha_parte is None:
            return True
        try:
            fp = fecha_parte.replace(tzinfo=None) if getattr(fecha_parte, "tzinfo", None) else fecha_parte
            fr = fecha_ref.replace(tzinfo=None) if getattr(fecha_ref, "tzinfo", None) else fecha_ref
            return fp >= fr
        except (TypeError, AttributeError):
            return True

    activas = [
        parte for parte in (partes_info.get("partes_activas_detalle") or [])
        if _parte_match(parte)
    ]
    finalizadas = [
        parte for parte in (partes_info.get("partes_finalizados_detalle") or [])
        if _parte_match(parte)
    ]

    parte_principal = partes_info.get("parte")
    if getattr(parte_principal, "inspeccion_id", None) != inspeccion_id:
        parte_principal = None
    elif fecha_ref is not None:
        fecha_principal = getattr(parte_principal, "fecha_fin", None) or getattr(parte_principal, "fecha_inicio", None)
        if fecha_principal is not None:
            try:
                # Normalizar a naive para comparar (fecha_inspeccion puede ser timezone-aware
                # mientras que ParteTrabajo.fecha_fin/inicio es naive)
                fp = fecha_principal.replace(tzinfo=None) if getattr(fecha_principal, "tzinfo", None) else fecha_principal
                fr = fecha_ref.replace(tzinfo=None) if getattr(fecha_ref, "tzinfo", None) else fecha_ref
                if fp < fr:
                    parte_principal = None
            except (TypeError, AttributeError):
                pass

    if parte_principal is None:
        partes_candidatas = []
        for parte in activas + finalizadas:
            estado = str(parte.get("estado") or "finalizado")
            prioridad = _PRIORIDAD_ESTADO_PARTE.get(estado, 99)
            fecha_ref_parte = _parse_dt(parte.get("fecha_fin")) or _parse_dt(parte.get("fecha_inicio"))
            timestamp = fecha_ref_parte.timestamp() if fecha_ref_parte else 0.0
            partes_candidatas.append((prioridad, timestamp, int(parte.get("id") or 0), parte))

        if partes_candidatas:
            partes_candidatas.sort(key=lambda item: (item[0], -item[1], -item[2]))
            parte_principal = SimpleNamespace(**partes_candidatas[0][3])

    return {
        "parte": parte_principal,
        "partes_activas_count": len(activas),
        "partes_activas_ids": [int(parte["id"]) for parte in activas if parte.get("id") is not None],
        "partes_activas_empleados": list(dict.fromkeys(
            [parte.get("empleado_nombre") for parte in activas if parte.get("empleado_nombre")]
        )),
        "partes_activas_detalle": activas,
        "partes_roles_todos": list(dict.fromkeys(
            [parte.get("tipo_tarea") for parte in activas if parte.get("tipo_tarea")]
        )),
        "partes_finalizados_detalle": finalizadas,
    }


def _get_partes_por_coche(coche_ids):
    """Retorna dict coche_id con parte principal y resumen de partes activos.
    También indexa por inspeccion_id para inspecciones con parte propio."""
    if not coche_ids:
        return {}
    partes = ParteTrabajo.query.filter(ParteTrabajo.coche_id.in_(coche_ids)).all()
    por_coche = {}
    por_inspeccion = {}  # inspeccion_id -> (prioridad, recency, parte)
    resumen_activos = {}
    for parte in partes:
        cid = parte.coche_id
        iid = parte.inspeccion_id
        st = parte.estado.value if parte.estado else "finalizado"
        prioridad = _PRIORIDAD_ESTADO_PARTE.get(st, 99)
        recency = _parte_recency_key(parte)

        # Los partes fantasma (auto-creados, pendiente sin empleado/fecha/fase) tienen
        # prioridad menor que cualquier parte real, incluidos los finalizados.
        _es_fantasma = (
            st == "pendiente"
            and not parte.empleado_id
            and not parte.fecha_inicio
            and not parte.fase
        )
        prioridad_efectiva = 10 if _es_fantasma else prioridad

        # Índice por inspeccion_id (para inspecciones que tienen parte propio)
        if iid is not None:
            if iid not in por_inspeccion:
                por_inspeccion[iid] = (prioridad_efectiva, recency, parte)
            else:
                cur_p, cur_r, _ = por_inspeccion[iid]
                if prioridad_efectiva < cur_p or (prioridad_efectiva == cur_p and recency > cur_r):
                    por_inspeccion[iid] = (prioridad_efectiva, recency, parte)

        # Partes activos del coche (sin finalizados) para mostrar carga real.
        if st in {"pendiente", "en_proceso", "en_pausa"}:
            bucket = resumen_activos.setdefault(
                cid,
                {
                    "partes_ids": [],
                    "empleados": [],
                    "partes_detalle": [],
                    "roles_todos": [],
                    "partes_finalizados": [],
                },
            )
            bucket["partes_ids"].append(int(parte.id))
            empleado_nombre = (getattr(getattr(parte, "empleado", None), "nombre", "") or "").strip()
            if empleado_nombre and empleado_nombre not in bucket["empleados"]:
                bucket["empleados"].append(empleado_nombre)
            tipo_tarea = (getattr(parte, "tipo_tarea", "") or "").strip() or None
            if tipo_tarea and tipo_tarea not in bucket["roles_todos"]:
                bucket["roles_todos"].append(tipo_tarea)
            fecha_inicio_iso = parte.fecha_inicio.isoformat() if getattr(parte, "fecha_inicio", None) else None
            duracion_min = getattr(parte, "duracion_minutos", None)
            bucket["partes_detalle"].append({
                "id": int(parte.id),
                "inspeccion_id": int(parte.inspeccion_id) if getattr(parte, "inspeccion_id", None) else None,
                "empleado_id": int(parte.empleado_id) if getattr(parte, "empleado_id", None) else None,
                "empleado_nombre": empleado_nombre or None,
                "tipo_tarea": tipo_tarea,
                "fase": (getattr(parte, "fase", "") or "").strip() or None,
                "observaciones": (getattr(parte, "observaciones", "") or "").strip() or None,
                "estado": st,
                "prioridad": int(getattr(parte, "prioridad", 0) or 0),
                "fecha_inicio": fecha_inicio_iso,
                "fecha_fin": parte.fecha_fin.isoformat() if getattr(parte, "fecha_fin", None) else None,
                "duracion_minutos": int(duracion_min) if duracion_min is not None else None,
            })
        elif st == "finalizado":
            # Partes finalizados: para mostrar qué trabajos se completaron en repaso
            fin_bucket = resumen_activos.setdefault(
                cid,
                {
                    "partes_ids": [],
                    "empleados": [],
                    "partes_detalle": [],
                    "roles_todos": [],
                    "partes_finalizados": [],
                },
            )
            empleado_nombre_fin = (getattr(getattr(parte, "empleado", None), "nombre", "") or "").strip()
            tipo_tarea_fin = (getattr(parte, "tipo_tarea", "") or "").strip() or None
            fecha_fin = parte.fecha_fin.isoformat() if getattr(parte, "fecha_fin", None) else None
            fin_bucket["partes_finalizados"].append({
                "id": int(parte.id),
                "inspeccion_id": int(parte.inspeccion_id) if getattr(parte, "inspeccion_id", None) else None,
                "empleado_id": int(parte.empleado_id) if getattr(parte, "empleado_id", None) else None,
                "empleado_nombre": empleado_nombre_fin or None,
                "tipo_tarea": tipo_tarea_fin,
                "fase": (getattr(parte, "fase", "") or "").strip() or None,
                "observaciones": (getattr(parte, "observaciones", "") or "").strip() or None,
                "fecha_inicio": parte.fecha_inicio.isoformat() if getattr(parte, "fecha_inicio", None) else None,
                "fecha_fin": fecha_fin,
            })

        if cid not in por_coche:
            por_coche[cid] = (prioridad_efectiva, recency, parte)
        else:
            current_prioridad, current_recency, _ = por_coche[cid]
            if prioridad_efectiva < current_prioridad:
                por_coche[cid] = (prioridad_efectiva, recency, parte)
            elif prioridad_efectiva == current_prioridad and recency > current_recency:
                por_coche[cid] = (prioridad_efectiva, recency, parte)

    # Post-proceso: eliminar partes "fantasma" — pendiente sin empleado ni fecha_inicio
    # cuando ya hay partes finalizados del mismo tipo_tarea para ese coche.
    # Esto ocurre con partes base de pintura (uno por servicio contratado) que nunca
    # se asignaron individualmente porque el flujo arrancó por el primer parte.
    for bucket in resumen_activos.values():
        tipos_finalizados = {
            p.get("tipo_tarea")
            for p in bucket.get("partes_finalizados", [])
            if p.get("tipo_tarea")
        }
        if not tipos_finalizados:
            continue
        partes_filtrados = [
            p for p in bucket.get("partes_detalle", [])
            if not (
                p.get("estado") == "pendiente"
                and not p.get("empleado_id")
                and not p.get("fecha_inicio")
                and p.get("tipo_tarea") in tipos_finalizados
                and not p.get("fase")  # solo partes base sin fase explícita
            )
        ]
        if len(partes_filtrados) != len(bucket.get("partes_detalle", [])):
            ids_restantes = {p["id"] for p in partes_filtrados}
            bucket["partes_detalle"] = partes_filtrados
            bucket["partes_ids"] = [pid for pid in bucket["partes_ids"] if pid in ids_restantes]

    out = {}
    all_coche_ids = set(coche_ids)
    for cid in all_coche_ids:
        parte = por_coche.get(cid, (None, None, None))[2]
        _empty = {"partes_ids": [], "empleados": [], "partes_detalle": [], "roles_todos": [], "partes_finalizados": []}
        activos = resumen_activos.get(cid, _empty)
        out[cid] = {
            "parte": parte,
            "partes_activas_count": len(activos["partes_ids"]),
            "partes_activas_ids": activos["partes_ids"],
            "partes_activas_empleados": activos["empleados"],
            "partes_activas_detalle": activos["partes_detalle"],
            "partes_roles_todos": activos["roles_todos"],
            "partes_finalizados_detalle": activos["partes_finalizados"],
        }
    # Adjuntar índice por inspección al dict resultado para uso en serialización
    out["__por_inspeccion__"] = {
        iid: {
            "parte": data[2],
            "partes_activas_count": len(resumen_activos.get(data[2].coche_id, {}).get("partes_ids", [])),
            "partes_activas_ids": resumen_activos.get(data[2].coche_id, {}).get("partes_ids", []),
            "partes_activas_empleados": resumen_activos.get(data[2].coche_id, {}).get("empleados", []),
            "partes_activas_detalle": resumen_activos.get(data[2].coche_id, {}).get("partes_detalle", []),
            "partes_roles_todos": resumen_activos.get(data[2].coche_id, {}).get("roles_todos", []),
            "partes_finalizados_detalle": resumen_activos.get(data[2].coche_id, {}).get("partes_finalizados", []),
        }
        for iid, data in por_inspeccion.items()
    }
    return out


def _compute_estado_coche(
    inspeccion,
    parte,
    partes_activas_count=0,
    partes_activas_ids=None,
    partes_activas_empleados=None,
    partes_finalizados_count=0,
):
    """Calcula el estado visual actual del coche en el proceso de taller."""
    partes_activas_ids = partes_activas_ids or []
    partes_activas_empleados = partes_activas_empleados or []

    if inspeccion.entregado:
        return {
            "estado": "entregado",
            "label": "✅ Entregado",
            "color": "#198754",
            "parte_id": None,
            "parte_obs": None,
            "parte_empleado_id": None,
            "parte_empleado_nombre": None,
            "parte_tipo_tarea": None,
            "partes_activas_count": 0,
            "partes_activas_ids": [],
            "partes_activas_empleados": [],
        }

    if inspeccion.repaso_completado:
        return {
            "estado": "listo_entrega",
            "label": "🟢 Listo para entrega",
            "color": "#20c997",
            "parte_id": None,
            "parte_obs": None,
            "parte_empleado_id": None,
            "parte_empleado_nombre": None,
            "parte_tipo_tarea": None,
            "partes_activas_count": 0,
            "partes_activas_ids": [],
            "partes_activas_empleados": [],
        }

    if parte is None:
        if int(partes_finalizados_count or 0) > 0:
            return {
                "estado": "en_repaso",
                "label": "🧽 En repaso",
                "color": "#0d6efd",
                "parte_id": None,
                "parte_obs": None,
                "parte_empleado_id": None,
                "parte_empleado_nombre": None,
                "parte_tipo_tarea": None,
                "partes_activas_count": int(partes_activas_count or 0),
                "partes_activas_ids": partes_activas_ids,
                "partes_activas_empleados": partes_activas_empleados,
            }
        return {
            "estado": "esperando_parte",
            "label": "⏳ Esperando parte de trabajo",
            "color": "#adb5bd",
            "parte_id": None,
            "parte_obs": None,
            "parte_empleado_id": None,
            "parte_empleado_nombre": None,
            "parte_tipo_tarea": None,
            "partes_activas_count": 0,
            "partes_activas_ids": [],
            "partes_activas_empleados": [],
        }

    st = parte.estado.value if parte.estado else "desconocido"
    obs = (parte.observaciones or "").strip()
    short_obs = obs[:60] if obs else None
    empleado_nombre = (getattr(getattr(parte, "empleado", None), "nombre", "") or "").strip() or None
    empleado_id = int(parte.empleado_id) if getattr(parte, "empleado_id", None) else None
    tipo_tarea = normalize_role(getattr(parte, "tipo_tarea", "") or "") or None

    if st == "en_proceso":
        return {
            "estado": "en_proceso",
            "label": "🔧 En trabajo",
            "color": "#fd7e14",
            "parte_id": parte.id,
            "parte_obs": short_obs,
            "parte_empleado_id": empleado_id,
            "parte_empleado_nombre": empleado_nombre,
            "parte_tipo_tarea": tipo_tarea,
            "partes_activas_count": int(partes_activas_count or 0),
            "partes_activas_ids": partes_activas_ids,
            "partes_activas_empleados": partes_activas_empleados,
        }
    if st == "en_pausa":
        return {
            "estado": "en_pausa",
            "label": "⏸️ En pausa",
            "color": "#ffc107",
            "parte_id": parte.id,
            "parte_obs": short_obs,
            "parte_empleado_id": empleado_id,
            "parte_empleado_nombre": empleado_nombre,
            "parte_tipo_tarea": tipo_tarea,
            "partes_activas_count": int(partes_activas_count or 0),
            "partes_activas_ids": partes_activas_ids,
            "partes_activas_empleados": partes_activas_empleados,
        }
    if st == "pendiente":
        # Parte fantasma: creado automáticamente, sin empleado ni fecha de inicio ni fase explícita.
        # Si ya hay partes finalizados de este coche, ignorar el fantasma y mostrar en_repaso.
        es_fantasma = (
            not getattr(parte, "empleado_id", None)
            and not getattr(parte, "fecha_inicio", None)
            and not getattr(parte, "fase", None)
        )
        if es_fantasma and int(partes_finalizados_count or 0) > 0:
            return {
                "estado": "en_repaso",
                "label": "🧽 En repaso",
                "color": "#0d6efd",
                "parte_id": None,
                "parte_obs": None,
                "parte_empleado_id": None,
                "parte_empleado_nombre": None,
                "parte_tipo_tarea": None,
                "partes_activas_count": int(partes_activas_count or 0),
                "partes_activas_ids": partes_activas_ids,
                "partes_activas_empleados": partes_activas_empleados,
            }
        return {
            "estado": "parte_pendiente",
            "label": "📋 Parte asignado",
            "color": "#6f42c1",
            "parte_id": parte.id,
            "parte_obs": short_obs,
            "parte_empleado_id": empleado_id,
            "parte_empleado_nombre": empleado_nombre,
            "parte_tipo_tarea": tipo_tarea,
            "partes_activas_count": int(partes_activas_count or 0),
            "partes_activas_ids": partes_activas_ids,
            "partes_activas_empleados": partes_activas_empleados,
        }
    if st == "finalizado":
        return {
            "estado": "en_repaso",
            "label": "🧽 En repaso",
            "color": "#0d6efd",
            "parte_id": parte.id,
            "parte_obs": short_obs,
            "parte_empleado_id": empleado_id,
            "parte_empleado_nombre": empleado_nombre,
            "parte_tipo_tarea": tipo_tarea,
            "partes_activas_count": int(partes_activas_count or 0),
            "partes_activas_ids": partes_activas_ids,
            "partes_activas_empleados": partes_activas_empleados,
        }

    return {
        "estado": "desconocido",
        "label": "❓ Desconocido",
        "color": "#6c757d",
        "parte_id": None,
        "parte_obs": None,
        "parte_empleado_id": None,
        "parte_empleado_nombre": None,
        "parte_tipo_tarea": None,
        "partes_activas_count": int(partes_activas_count or 0),
        "partes_activas_ids": partes_activas_ids,
        "partes_activas_empleados": partes_activas_empleados,
    }


def _serialize_inspeccion_con_estado(inspeccion, partes_por_coche):
    data = inspeccion.to_dict()
    por_inspeccion = partes_por_coche.get("__por_inspeccion__", {}) if isinstance(partes_por_coche, dict) else {}
    partes_info_insp = por_inspeccion.get(inspeccion.id) if inspeccion.id in por_inspeccion else None
    partes_info_coche = partes_por_coche.get(inspeccion.coche_id, {}) if isinstance(partes_por_coche, dict) else {}

    # Elegir la fuente con el estado de mayor prioridad (en_proceso > en_pausa > pendiente).
    # Esto cubre el caso en que otro trabajador se suma al coche sin inspeccion_id propio
    # (su parte queda fuera del índice por_inspeccion pero sí está en por_coche).
    def _prioridad_info(info):
        p = info.get("parte") if isinstance(info, dict) else None
        if p is None:
            return 99
        st = p.estado.value if p.estado else "finalizado"
        return _PRIORIDAD_ESTADO_PARTE.get(st, 99)

    if partes_info_insp is not None and isinstance(partes_info_coche, dict) and partes_info_coche:
        partes_info = partes_info_insp if _prioridad_info(partes_info_insp) <= _prioridad_info(partes_info_coche) else partes_info_coche
    elif partes_info_insp is not None:
        partes_info = partes_info_insp
    else:
        partes_info = partes_info_coche

    partes_info_filtradas = _filter_partes_info_por_inspeccion(partes_info, inspeccion)

    parte = partes_info_filtradas.get("parte")
    data["estado_coche"] = _compute_estado_coche(
        inspeccion,
        parte,
        partes_activas_count=partes_info_filtradas.get("partes_activas_count", 0),
        partes_activas_ids=partes_info_filtradas.get("partes_activas_ids", []),
        partes_activas_empleados=partes_info_filtradas.get("partes_activas_empleados", []),
        partes_finalizados_count=len(partes_info_filtradas.get("partes_finalizados_detalle", [])),
    )
    if isinstance(data.get("estado_coche"), dict):
        data["estado_coche"]["partes_activas_detalle"] = partes_info_filtradas.get("partes_activas_detalle", [])
        data["estado_coche"]["partes_roles_todos"] = partes_info_filtradas.get("partes_roles_todos", [])
        data["estado_coche"]["partes_finalizados_detalle"] = partes_info_filtradas.get("partes_finalizados_detalle", [])
    data["cobro"] = _build_cobro_info(inspeccion)
    partes_activas_detalle = data.get("estado_coche", {}).get("partes_activas_detalle", []) if isinstance(data.get("estado_coche"), dict) else []
    data["urgente"] = any(int(p.get("prioridad", 0) or 0) > 0 for p in partes_activas_detalle)
    return data


def _telefono_digits(value):
    return "".join(ch for ch in (value or "") if ch.isdigit())


def _normalize_client_name(value):
    texto = str(value or "").strip().lower()
    if not texto:
        return ""
    normalizado = unicodedata.normalize("NFD", texto)
    return "".join(ch for ch in normalizado if unicodedata.category(ch) != "Mn")


def _cliente_payload_matches(cliente, cliente_nombre="", cliente_telefono=""):
    if not cliente:
        return False
    nombre_payload = _normalize_client_name(cliente_nombre)
    nombre_cliente = _normalize_client_name(getattr(cliente, "nombre", ""))
    telefono_payload = _telefono_digits(cliente_telefono)
    telefono_cliente = _telefono_digits(getattr(cliente, "telefono", ""))

    nombre_ok = not nombre_payload or not nombre_cliente or nombre_payload == nombre_cliente
    telefono_ok = not telefono_payload or not telefono_cliente or telefono_payload == telefono_cliente
    return nombre_ok and telefono_ok


def _jwt_user_id():
    try:
        return int(get_jwt_identity())
    except (TypeError, ValueError):
        return None


INSPECCION_ALLOWED_ROLES = {"administrador", "calidad"}
INSPECCION_MANAGER_ROLES = {"administrador", "calidad"}


def _is_inspeccion_role(user):
    if not user:
        return False
    return normalize_role(getattr(user, "rol", "")) in INSPECCION_ALLOWED_ROLES


def _can_view_all_inspecciones(user):
    if not user:
        return False
    return normalize_role(getattr(user, "rol", "")) in INSPECCION_MANAGER_ROLES


# ============ AUTO-CREAR PARTES DE TRABAJO DESDE INSPECCIÓN ============

def _auto_crear_partes_desde_inspeccion(inspeccion):
    """
    Crea automáticamente un ParteTrabajo pendiente por cada servicio de la inspección
    que aún no tenga parte asociado. Se llama tras crear o actualizar la inspección.
    No lanza excepciones para no bloquear el flujo principal.
    """
    try:
        from uuid import uuid4
        if not inspeccion.coche_id:
            return  # Inspección sin coche vinculado, no se pueden crear partes
        servicios = json.loads(inspeccion.servicios_aplicados or "[]")
        if not isinstance(servicios, list) or not servicios:
            return

        # lote_uid compartido por todos los partes de esta inspección
        lote_uid = str(uuid4())

        for svc in servicios:
            if not isinstance(svc, dict):
                continue

            servicio_catalogo_id = (
                svc.get("servicio_catalogo_id")
                if svc.get("servicio_catalogo_id") is not None
                else svc.get("servicio_id", svc.get("catalogo_id"))
            )
            try:
                servicio_catalogo_id = int(servicio_catalogo_id) if servicio_catalogo_id is not None else None
            except (TypeError, ValueError):
                servicio_catalogo_id = None

            # Compatibilidad con datos legacy: algunos servicios antiguos guardaban
            # el rol en `rol` o `rol_responsable` en vez de `tipo_tarea`.
            tipo_tarea = normalize_role(
                svc.get("tipo_tarea")
                or svc.get("rol")
                or svc.get("rol_responsable")
                or ""
            )
            catalogo = None
            if servicio_catalogo_id:
                catalogo = ServicioCatalogo.query.get(servicio_catalogo_id)
                if not tipo_tarea and catalogo:
                    tipo_tarea = normalize_role(catalogo.rol_responsable or "")

            nombre = str(
                svc.get("nombre")
                or svc.get("descripcion")
                or getattr(catalogo, "nombre", "")
                or ""
            ).strip()
            if not nombre and tipo_tarea:
                nombre = {
                    "detailing": "Servicio detailing",
                    "pintura": "Servicio pintura",
                    "tapicero": "Servicio tapicería",
                    "calidad": "Control de calidad",
                    "otro": "Trabajo general",
                }.get(tipo_tarea, "Trabajo asignado")

            if not nombre or not tipo_tarea:
                continue  # Sin nombre o sin rol no podemos generar el parte

            # Evitar duplicados solo dentro de la inspección/coche actual.
            with db.session.no_autoflush:
                if servicio_catalogo_id:
                    candidatos = ParteTrabajo.query.filter_by(
                        inspeccion_id=inspeccion.id,
                        coche_id=inspeccion.coche_id,
                        servicio_catalogo_id=servicio_catalogo_id,
                    ).all()
                else:
                    candidatos = ParteTrabajo.query.filter_by(
                        inspeccion_id=inspeccion.id,
                        coche_id=inspeccion.coche_id,
                        observaciones=nombre,
                    ).all()

            existe = next((parte for parte in candidatos if _parte_es_de_inspeccion_actual(parte, inspeccion)), None)
            if existe:
                continue

            # Para servicios manuales: si no hay parte con el nombre exacto,
            # buscar un parte "huérfano" del mismo rol cuya descripción ya no
            # coincide con ningún servicio activo — actualizar en vez de duplicar.
            if not servicio_catalogo_id:
                nombres_actuales = {
                    str(s.get("nombre") or s.get("descripcion") or "").strip()
                    for s in servicios
                    if isinstance(s, dict) and not s.get("servicio_catalogo_id")
                }
                with db.session.no_autoflush:
                    huerfanos = ParteTrabajo.query.filter(
                        ParteTrabajo.inspeccion_id == inspeccion.id,
                        ParteTrabajo.coche_id == inspeccion.coche_id,
                        ParteTrabajo.servicio_catalogo_id == None,
                        ParteTrabajo.tipo_tarea == tipo_tarea,
                        ParteTrabajo.estado.in_([
                            EstadoParte.pendiente,
                            EstadoParte.en_proceso,
                            EstadoParte.en_pausa,
                        ]),
                    ).all()
                huerfano = next(
                    (p for p in huerfanos
                     if _parte_es_de_inspeccion_actual(p, inspeccion)
                     and (p.observaciones or "").strip() not in nombres_actuales),
                    None
                )
                if huerfano:
                    huerfano.observaciones = nombre
                    continue

            tiempo = int(svc.get("tiempo_estimado_minutos") or 0)
            if tiempo <= 0 and servicio_catalogo_id:
                catalogo = ServicioCatalogo.query.get(servicio_catalogo_id)
                if catalogo:
                    tiempo = int(catalogo.tiempo_estimado_minutos or 0)

            parte = ParteTrabajo(
                coche_id=inspeccion.coche_id,
                inspeccion_id=inspeccion.id,
                servicio_catalogo_id=servicio_catalogo_id,
                empleado_id=None,
                estado=EstadoParte.pendiente,
                observaciones=nombre,
                tiempo_estimado_minutos=tiempo,
                lote_uid=lote_uid,
                tipo_tarea=tipo_tarea,
                es_tarea_interna=False,
            )
            db.session.add(parte)

        db.session.commit()

    except Exception as e:
        import traceback, logging
        logging.error(f"[auto_crear_partes] Error: {e}\n{traceback.format_exc()}")
        db.session.rollback()


def _normalize_servicios_aplicados(raw):
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError("servicios_aplicados debe ser una lista")

    normalized = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        nombre = str(item.get("nombre") or item.get("descripcion") or "").strip()

        origen = str(item.get("origen") or "manual").strip().lower()
        if origen not in {"catalogo", "manual"}:
            origen = "manual"

        precio_raw = item.get("precio", 0)
        try:
            precio = round(float(precio_raw or 0), 2)
        except (TypeError, ValueError):
            precio = 0.0
        if precio < 0:
            precio = 0.0

        tiempo_raw = item.get("tiempo_estimado_minutos", 0)
        try:
            tiempo_estimado_minutos = int(tiempo_raw or 0)
        except (TypeError, ValueError):
            tiempo_estimado_minutos = 0
        if tiempo_estimado_minutos < 0:
            tiempo_estimado_minutos = 0

        tipo_tarea = normalize_role(item.get("tipo_tarea") or item.get("rol") or item.get("rol_responsable") or "")

        servicio_catalogo_id = item.get("servicio_catalogo_id")
        try:
            servicio_catalogo_id = int(servicio_catalogo_id) if servicio_catalogo_id is not None else None
        except (TypeError, ValueError):
            servicio_catalogo_id = None

        catalogo = None
        if servicio_catalogo_id:
            catalogo = ServicioCatalogo.query.get(servicio_catalogo_id)
            if catalogo:
                if not tipo_tarea:
                    tipo_tarea = normalize_role(getattr(catalogo, "rol_responsable", "") or "")
                if not nombre:
                    nombre = str(getattr(catalogo, "nombre", "") or "").strip()

        if not nombre and tipo_tarea:
            nombre = {
                "detailing": "Servicio detailing",
                "pintura": "Servicio pintura",
                "tapicero": "Servicio tapicería",
                "calidad": "Control de calidad",
                "otro": "Trabajo general",
            }.get(tipo_tarea, "Trabajo asignado")

        if not nombre:
            continue
        if origen == "manual" and not tipo_tarea:
            raise ValueError("En servicio manual debes indicar el rol/área (tipo_tarea)")
        if origen == "catalogo" and not tipo_tarea:
            raise ValueError(f"El servicio de catálogo '{nombre}' no tiene un rol válido asignado")

        normalized.append({
            "origen": origen,
            "servicio_catalogo_id": servicio_catalogo_id,
            "nombre": nombre,
            "precio": precio,
            "tiempo_estimado_minutos": tiempo_estimado_minutos,
            "tipo_tarea": tipo_tarea or None,
        })

    return normalized


def _servicio_sync_key(servicio):
    if not isinstance(servicio, dict):
        return None

    servicio_catalogo_id = servicio.get("servicio_catalogo_id")
    try:
        servicio_catalogo_id = int(servicio_catalogo_id) if servicio_catalogo_id is not None else None
    except (TypeError, ValueError):
        servicio_catalogo_id = None

    if servicio_catalogo_id:
        return ("catalogo", servicio_catalogo_id)

    nombre = str(servicio.get("nombre") or servicio.get("descripcion") or "").strip()
    if nombre:
        return ("manual", nombre.casefold())
    return None


def _eliminar_partes_huerfanos_pendientes(inspeccion, servicios):
    """
    Elimina partes en estado 'pendiente' cuyo servicio ya no existe en la
    inspección. Se usa al actualizar los servicios de una inspección para
    evitar que queden partes obsoletos cuando se quita o reemplaza un servicio.
    Solo toca partes 'pendiente' — no cancela trabajos ya iniciados.
    """
    if not inspeccion or not inspeccion.id or not inspeccion.coche_id:
        return
    if not isinstance(servicios, list):
        return

    # Construir conjuntos de claves de los servicios actuales
    ids_catalogo_actuales = set()
    nombres_manuales_actuales = set()
    for svc in servicios:
        if not isinstance(svc, dict):
            continue
        sid = svc.get("servicio_catalogo_id")
        try:
            sid = int(sid) if sid is not None else None
        except (TypeError, ValueError):
            sid = None
        if sid:
            ids_catalogo_actuales.add(sid)
        else:
            nombre = str(svc.get("nombre") or svc.get("descripcion") or "").strip()
            if nombre:
                nombres_manuales_actuales.add(nombre)

    partes_pendientes = ParteTrabajo.query.filter(
        ParteTrabajo.inspeccion_id == inspeccion.id,
        ParteTrabajo.coche_id == inspeccion.coche_id,
        ParteTrabajo.estado == EstadoParte.pendiente,
    ).all()

    for parte in partes_pendientes:
        if parte.servicio_catalogo_id:
            if parte.servicio_catalogo_id not in ids_catalogo_actuales:
                db.session.delete(parte)
        else:
            obs = (parte.observaciones or "").strip()
            if obs and obs not in nombres_manuales_actuales:
                db.session.delete(parte)


def _sync_partes_pendientes_desde_servicios(inspeccion, servicios):
    """
    Sincroniza el área (`tipo_tarea`) de partes de la inspección cuando
    un servicio cambia de rol. Actualiza pendiente, en_proceso y en_pausa
    (no toca finalizados para no alterar el historial).
    """
    if not inspeccion or not inspeccion.id or not inspeccion.coche_id:
        return
    if not isinstance(servicios, list) or not servicios:
        return

    roles_por_clave = {}
    for servicio in servicios:
        clave = _servicio_sync_key(servicio)
        if not clave:
            continue
        tipo_tarea = normalize_role(servicio.get("tipo_tarea") or servicio.get("rol") or servicio.get("rol_responsable") or "")
        if not tipo_tarea:
            continue
        roles_por_clave[clave] = tipo_tarea

    if not roles_por_clave:
        return

    partes_activos = (
        ParteTrabajo.query
        .filter(
            ParteTrabajo.inspeccion_id == inspeccion.id,
            ParteTrabajo.coche_id == inspeccion.coche_id,
            ParteTrabajo.estado.in_([
                EstadoParte.pendiente,
                EstadoParte.en_proceso,
                EstadoParte.en_pausa,
            ]),
        )
        .all()
    )

    for parte in partes_activos:
        clave = None
        if parte.servicio_catalogo_id:
            clave = ("catalogo", int(parte.servicio_catalogo_id))
        else:
            observaciones = (parte.observaciones or "").strip()
            if observaciones:
                clave = ("manual", observaciones.casefold())

        if not clave:
            continue

        nuevo_tipo = roles_por_clave.get(clave)
        if not nuevo_tipo:
            continue

        if normalize_role(getattr(parte, "tipo_tarea", "") or "") != nuevo_tipo:
            parte.tipo_tarea = nuevo_tipo


def _safe_servicios_aplicados(inspeccion):
    try:
        raw = json.loads(inspeccion.servicios_aplicados or "[]")
        return raw if isinstance(raw, list) else []
    except Exception:
        return []


def _build_trabajos_realizados_desde_partes(inspeccion):
    if not inspeccion or not inspeccion.coche_id:
        return ""

    partes = (
        ParteTrabajo.query
        .filter(
            ParteTrabajo.coche_id == inspeccion.coche_id,
            ParteTrabajo.estado == EstadoParte.finalizado,
        )
        .order_by(ParteTrabajo.fecha_fin.asc(), ParteTrabajo.id.asc())
        .all()
    )

    lineas = []
    seen = set()

    for parte in partes:
        detalle = (getattr(parte, "observaciones", "") or "").strip()
        if not detalle:
            continue

        fase = (getattr(parte, "fase", "") or "").strip().lower()
        if fase == "preparacion":
            prefijo = "Preparación"
        elif fase == "pintura":
            prefijo = "Pintura"
        else:
            tipo = normalize_role(getattr(parte, "tipo_tarea", "") or "") or ""
            prefijo = (tipo[:1].upper() + tipo[1:]) if tipo else "Trabajo"

        clave = (prefijo.lower(), detalle.lower())
        if clave in seen:
            continue
        seen.add(clave)
        lineas.append(f"{prefijo}: {detalle}")

    return "\n".join(lineas).strip()


def _importe_total_inspeccion(inspeccion):
    total = 0.0
    for item in _safe_servicios_aplicados(inspeccion):
        if not isinstance(item, dict):
            continue
        try:
            precio = float(item.get("precio") or 0)
        except (TypeError, ValueError):
            precio = 0.0
        if precio > 0:
            total += precio
    return round(total, 2)


def _build_cobro_info(inspeccion):
    total = _importe_total_inspeccion(inspeccion)
    pagado_raw = float(inspeccion.cobro_importe_pagado or 0)
    pagado = round(max(pagado_raw, 0.0), 2)
    pendiente = round(max(total - pagado, 0.0), 2)

    if inspeccion.es_concesionario and pagado <= 0:
        estado = "facturar_despues"
        label = "Facturar después"
        color = "#6f42c1"
    elif pagado <= 0:
        estado = "pendiente"
        label = "Pendiente de cobro"
        color = "#dc3545"
    elif pendiente <= 0.009:
        estado = "pagado_total"
        label = "Pagado"
        color = "#198754"
        pendiente = 0.0
    else:
        estado = "pagado_parcial"
        label = "Pago parcial"
        color = "#fd7e14"

    return {
        "estado": estado,
        "label": label,
        "color": color,
        "es_concesionario": bool(inspeccion.es_concesionario),
        "importe_total": total,
        "importe_pagado": pagado,
        "importe_pendiente": pendiente,
        "fecha_ultimo_pago": inspeccion.cobro_fecha_ultimo_pago.isoformat() if inspeccion.cobro_fecha_ultimo_pago else None,
        "metodo": inspeccion.cobro_metodo,
        "referencia": inspeccion.cobro_referencia,
        "observaciones": inspeccion.cobro_observaciones,
    }


def _to_bool(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).strip().lower() in {"1", "true", "si", "sí", "yes", "on"}


def _aplicar_cobro_inspeccion(inspeccion, payload):
    """Aplica un cobro parcial/total sobre la inspección y registra ingreso en finanzas."""
    data = payload or {}
    accion = str(data.get("accion") or "abono").strip().lower()

    total = _importe_total_inspeccion(inspeccion)
    pagado_actual = float(inspeccion.cobro_importe_pagado or 0)

    if accion == "marcar_pagado_total":
        importe = max(total - pagado_actual, 0.0)
    else:
        try:
            importe = float(data.get("importe"))
        except (TypeError, ValueError):
            raise ValueError("Debes indicar un importe válido")

    if importe < 0:
        raise ValueError("El importe no puede ser negativo")

    metodo_raw = (data.get("metodo") or "").strip().lower()
    metodo = metodo_raw or None
    if metodo and metodo not in _COBRO_METODOS_VALIDOS:
        raise ValueError("Metodo de cobro invalido. Usa: efectivo, bizum, tarjeta o transferencia")

    referencia = (data.get("referencia") or "").strip() or None
    observaciones = (data.get("observaciones") or "").strip() or None

    nuevo_pagado = round(max(pagado_actual + importe, 0.0), 2)
    if total > 0:
        nuevo_pagado = min(nuevo_pagado, total)

    inspeccion.cobro_importe_pagado = nuevo_pagado
    inspeccion.cobro_fecha_ultimo_pago = now_madrid() if importe > 0 else inspeccion.cobro_fecha_ultimo_pago
    inspeccion.cobro_metodo = metodo
    inspeccion.cobro_referencia = referencia
    inspeccion.cobro_observaciones = observaciones

    cobro = _build_cobro_info(inspeccion)
    inspeccion.cobro_estado = cobro["estado"]

    if importe > 0:
        ingreso = GastoEmpresa(
            fecha=now_madrid(),
            concepto=f"Cobro inspección #{inspeccion.id} · {inspeccion.matricula or '-'}",
            categoria="ingreso_cobro_inspeccion",
            importe=round(float(importe), 2),
            proveedor=inspeccion.cliente_nombre,
            observaciones=(
                f"metodo={metodo or '-'} | referencia={referencia or '-'} | "
                f"tipo={'profesional' if inspeccion.es_concesionario else 'particular'}"
            ),
        )
        db.session.add(ingreso)

    return {
        "accion": accion,
        "importe": round(float(importe), 2),
        "metodo": metodo,
        "referencia": referencia,
        "observaciones": observaciones,
    }

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "").strip()
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "").strip()

# Directorios de media local (IONOS), a dos niveles por encima del paquete api/
_MEDIA_BASE = Path(os.path.dirname(os.path.abspath(__file__))).parent / "media"

VIDEOS_DIR = _MEDIA_BASE / "videos"
VIDEO_EXPIRY_DAYS = 60
VIDEO_ALLOWED_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".3gp", ".flv"}

FOTOS_DIR = _MEDIA_BASE / "fotos"
FOTO_EXPIRY_DAYS = 60
FOTO_ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".bmp", ".tiff", ".tif"}


def _video_dir(inspeccion_id: int) -> Path:
    """Devuelve la carpeta de videos de la inspección y la crea si no existe."""
    d = VIDEOS_DIR / str(inspeccion_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _foto_dir(inspeccion_id: int) -> Path:
    """Devuelve la carpeta de fotos de la inspección y la crea si no existe."""
    d = FOTOS_DIR / str(inspeccion_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


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
@role_required("administrador", "calidad")
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
        
        # 1. Resolver cliente: prioridad por cliente_id para evitar duplicados.
        cliente = Cliente.query.get(cliente_id) if cliente_id else None

        if cliente_id and not cliente:
            return jsonify({"msg": "Cliente no encontrado para cliente_id proporcionado"}), 400

        if cliente and not _cliente_payload_matches(cliente, cliente_nombre, cliente_telefono):
            cliente = None
            cliente_id = None

        if cliente:
            if not cliente_nombre:
                cliente_nombre = (cliente.nombre or "").strip()
            if not cliente_telefono:
                cliente_telefono = (cliente.telefono or "").strip()
            if not (cliente.nombre or "").strip() and cliente_nombre:
                cliente.nombre = cliente_nombre
            if not (cliente.telefono or "").strip() and cliente_telefono:
                cliente.telefono = cliente_telefono

        # Si no viene cliente_id, intentar localizar por teléfono/nombre para no duplicar.
        if not cliente and cliente_telefono:
            candidato = Cliente.query.filter_by(telefono=cliente_telefono).first()
            if candidato and _cliente_payload_matches(candidato, cliente_nombre, cliente_telefono):
                cliente = candidato

        if not cliente:
            telefono_digits = _telefono_digits(cliente_telefono)
            if telefono_digits:
                candidatos = Cliente.query.filter(Cliente.telefono.isnot(None)).all()
                for candidato in candidatos:
                    if _telefono_digits(candidato.telefono) == telefono_digits and _cliente_payload_matches(candidato, cliente_nombre, cliente_telefono):
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

        if not cliente_nombre:
            cliente_nombre = (cliente.nombre or "").strip()
        if not cliente_telefono:
            cliente_telefono = (cliente.telefono or "").strip()

        if not cliente_nombre:
            return jsonify({"msg": "Campo requerido: cliente_nombre"}), 400
        if not cliente_telefono:
            return jsonify({"msg": "Campo requerido: cliente_telefono"}), 400
        
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
            es_concesionario=es_concesionario,
            requiere_hoja_intervencion=requiere_hoja_intervencion,
            firma_cliente_recepcion=None if es_concesionario else data.get("firma_cliente_recepcion"),
            # Firma de empleado no se usa en recepción.
            firma_empleado_recepcion=None,
            consentimiento_datos_recepcion=consentimiento_datos_recepcion,
            averias_notas=data.get("averias_notas", ""),
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
@role_required("administrador", "calidad")
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
    if normalize_role(getattr(user, "rol", "")) not in {"administrador", "calidad"} and inspeccion.usuario_id != user_id:
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
        partes = _get_partes_por_coche([inspeccion.coche_id] if inspeccion.coche_id else [])
        return jsonify(_serialize_inspeccion_con_estado(inspeccion, partes)), 200
    
    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al actualizar inspección: {str(e)}"}), 500


@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/cobro", methods=["POST"])
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


@inspeccion_bp.route("/inspeccion-recepcion/cobros/profesionales", methods=["GET"])
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


# ============ REGISTRAR ENTREGA ==========
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/acta", methods=["POST"])
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


@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/entrega", methods=["POST"])
@role_required("administrador", "calidad")
def registrar_entrega(inspeccion_id):
    """
    Registrar entrega del vehiculo con acta tecnica.
    Campos requeridos:
    - trabajos_realizados (str)
    Campos opcionales:
    - entrega_observaciones (str)
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

    if not es_concesionario and not trabajos_realizados_final:
        return jsonify({"msg": "Campo requerido: trabajos_realizados"}), 400

    if not es_concesionario and not (data.get("firma_cliente_entrega") or "").strip():
        return jsonify({"msg": "Campo requerido: firma_cliente_entrega"}), 400

    consentimiento_datos_entrega = bool(data.get("consentimiento_datos_entrega", False))
    if not es_concesionario and not consentimiento_datos_entrega:
        return jsonify({"msg": "Debe aceptarse la proteccion de datos en entrega"}), 400

    conformidad_revision_entrega = bool(data.get("conformidad_revision_entrega", False))
    registrar_cobro = _to_bool(data.get("registrar_cobro", False))
    cobro_registrado_en_entrega = False

    try:
        inspeccion.trabajos_realizados = trabajos_realizados_final
        inspeccion.entrega_observaciones = data.get("entrega_observaciones", "").strip()
        inspeccion.firma_cliente_entrega = None if es_concesionario else data.get("firma_cliente_entrega")
        # Firma de empleado no se usa en entrega.
        inspeccion.firma_empleado_entrega = None
        inspeccion.consentimiento_datos_entrega = consentimiento_datos_entrega if not es_concesionario else False
        inspeccion.conformidad_revision_entrega = conformidad_revision_entrega if not es_concesionario else False
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

        payload = inspeccion.to_dict()
        payload["cobro_entrega_registrado"] = cobro_registrado_en_entrega
        return jsonify(payload), 200
    except ValueError as e:
        db.session.rollback()
        return jsonify({"msg": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al registrar entrega: {str(e)}"}), 500


@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/repaso", methods=["POST"])
@role_required("administrador", "calidad")
def guardar_repaso_entrega(inspeccion_id):
    """Guardar checklist de repaso pre-entrega y marcar listo para entrega."""
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    if inspeccion.entregado:
        return jsonify({"msg": "El coche ya fue entregado"}), 400

    data = request.get_json(silent=True) or {}
    checklist = data.get("checklist") or {}
    notas = (data.get("notas") or "").strip()
    marcar_listo = bool(data.get("marcar_listo", False))
    requiere_hoja_intervencion = data.get("requiere_hoja_intervencion")

    if not isinstance(checklist, dict):
        return jsonify({"msg": "checklist debe ser un objeto"}), 400

    try:
        user_id = _jwt_user_id()
        user = User.query.get(user_id) if user_id else None

        inspeccion.repaso_checklist = json.dumps(checklist)
        inspeccion.repaso_notas = notas
        if requiere_hoja_intervencion is not None:
            inspeccion.requiere_hoja_intervencion = bool(requiere_hoja_intervencion)

        if marcar_listo:
            inspeccion.repaso_completado = True
            inspeccion.repaso_completado_por_id = user.id if user else None
            inspeccion.repaso_completado_por_nombre = (user.nombre or "").strip() if user else None
            inspeccion.repaso_completado_at = now_madrid()
        else:
            # Si se guarda sin marcar listo, conservamos marca previa solo si ya existía.
            if not inspeccion.repaso_completado:
                inspeccion.repaso_completado_por_id = None
                inspeccion.repaso_completado_por_nombre = None
                inspeccion.repaso_completado_at = None

        db.session.commit()

        # Notificación al administrador si hay hoja de intervención pendiente
        if marcar_listo and inspeccion.requiere_hoja_intervencion:
            try:
                notif = Notificacion(
                    tipo="hoja_intervencion",
                    titulo=f"Hoja de intervención pendiente: {inspeccion.matricula or 'S/M'}",
                    cuerpo=(
                        f"Cliente: {inspeccion.cliente_nombre} · "
                        f"Repaso completado por: {(user.nombre or '').strip() if user else 'Calidad'}"
                    ),
                    ref_id=inspeccion.id,
                )
                db.session.add(notif)
                db.session.commit()
            except Exception:
                pass

        return jsonify(inspeccion.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al guardar repaso: {str(e)}"}), 500


@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/acta-final", methods=["GET"])
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


@inspeccion_bp.route("/actas-entregadas", methods=["GET"])
@role_required("administrador")
def listar_actas_entregadas():
    """Listar actas finales de coches entregados."""
    items = ActaEntrega.query.order_by(ActaEntrega.fecha_entrega.desc()).all()
    return jsonify([i.to_dict() for i in items]), 200


# ============ SUGERIR ACTA PREMIUM CON GPT ==========
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/sugerir-acta", methods=["POST"])
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
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/chat-acta", methods=["POST"])
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


# ============ SUBIR FOTO (Cloudinary con auto-borrado 60 días; local IONOS como fallback) ============
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/upload-foto", methods=["POST"])
@jwt_required()
def upload_foto(inspeccion_id):
    """
    Subir una foto de inspección.
    Si Cloudinary está configurado: sube con expires_at (auto-borrado 60 días).
    Si no: guarda en local IONOS con caducidad 60 días (limpiado por cleanup_media.py).
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
    if user.rol != "administrador" and inspeccion.usuario_id != user_id:
        return jsonify({"msg": "No tienes permiso para subir fotos a esta inspección"}), 403

    if "file" not in request.files:
        return jsonify({"msg": "No se proporcionó archivo"}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"msg": "No se seleccionó archivo"}), 400

    # Validar extensión (nunca confiar en Content-Type del cliente)
    raw_name = file.filename or ""
    ext = os.path.splitext(raw_name)[1].lower()
    if ext not in FOTO_ALLOWED_EXTS:
        return jsonify({"msg": f"Formato de imagen no admitido: {ext or 'sin extensión'}"}), 400

    try:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=FOTO_EXPIRY_DAYS)

        if _cloudinary_configured():
            # Cloudinary gestiona el borrado automático via expires_at (Unix timestamp)
            result = cloudinary.uploader.upload(
                file,
                folder=f"specialwash/inspecciones/{inspeccion_id}",
                resource_type="auto",
                expires_at=int(expires_at.timestamp()),
            )
            foto_entry = {
                "url": result["secure_url"],
                "public_id": result["public_id"],
                "original_name": raw_name,
                "uploaded_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
            }
        else:
            # Fallback: almacenamiento local IONOS
            unique_name = f"{uuid.uuid4()}{ext}"
            foto_dir = _foto_dir(inspeccion_id)
            file.save(str(foto_dir / unique_name))
            foto_entry = {
                "filename": unique_name,
                "original_name": raw_name,
                "uploaded_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
            }

        fotos = json.loads(inspeccion.fotos_cloudinary or "[]")
        fotos.append(foto_entry)
        inspeccion.fotos_cloudinary = json.dumps(fotos)
        db.session.commit()

        return jsonify({
            "msg": "Foto subida correctamente",
            "expires_at": expires_at.isoformat(),
            "total_fotos": len(fotos),
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al subir foto: {str(e)}"}), 500


# ============ SERVIR FOTO (protegido por JWT) ============
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/foto-file/<path:filename>", methods=["GET"])
def serve_foto(inspeccion_id, filename):
    """
    Devuelve el archivo de foto guardado localmente.
    Acepta el token JWT en la cabecera Authorization o en el query param ?token=
    (necesario porque <img> no puede enviar cabeceras).
    """
    token = ""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.args.get("token", "").strip()
    if not token:
        return jsonify({"msg": "Token requerido"}), 401

    try:
        decoded = decode_token(token)
        user_id = int(decoded["sub"])
    except Exception:
        return jsonify({"msg": "Token inválido o expirado"}), 401

    user = User.query.get(user_id)
    if not user or not _is_inspeccion_role(user):
        return jsonify({"msg": "No tienes permiso"}), 403

    safe_filename = os.path.basename(filename)
    if not safe_filename or safe_filename != filename:
        return jsonify({"msg": "Nombre de archivo inválido"}), 400

    foto_dir = FOTOS_DIR / str(inspeccion_id)
    foto_path = foto_dir / safe_filename
    if not foto_path.exists():
        return jsonify({"msg": "Archivo no encontrado"}), 404

    return send_from_directory(
        str(foto_dir),
        safe_filename,
        conditional=True,
    )


# ============ SUBIR VIDEO (almacenamiento local IONOS, 60 días caducidad) ============
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/upload-video", methods=["POST"])
@jwt_required()
def upload_video(inspeccion_id):
    """
    Subir un video de inspección al servidor local.
    Se guarda con nombre UUID, caducidad de 60 días.
    Máximo 300 MB. Formatos: mp4, mov, avi, mkv, webm, 3gp, flv.
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
    if user.rol != "administrador" and inspeccion.usuario_id != user_id:
        return jsonify({"msg": "No tienes permiso para subir videos a esta inspección"}), 403

    if "file" not in request.files:
        return jsonify({"msg": "No se proporcionó archivo"}), 400

    file = request.files["file"]
    if not file or file.filename == "":
        return jsonify({"msg": "No se seleccionó archivo"}), 400

    # Validar extensión (nunca confiar en Content-Type del cliente)
    raw_name = file.filename or ""
    ext = os.path.splitext(raw_name)[1].lower()
    if ext not in VIDEO_ALLOWED_EXTS:
        return jsonify({"msg": f"Formato de video no admitido: {ext or 'sin extensión'}"}), 400

    try:
        # Nombre único — impide colisiones y path traversal
        unique_name = f"{uuid.uuid4()}{ext}"
        video_dir = _video_dir(inspeccion_id)
        dest_path = video_dir / unique_name
        file.save(str(dest_path))

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=VIDEO_EXPIRY_DAYS)

        videos = json.loads(inspeccion.videos_cloudinary or "[]")
        videos.append({
            "filename": unique_name,
            "original_name": raw_name,
            "uploaded_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
        })
        inspeccion.videos_cloudinary = json.dumps(videos)
        db.session.commit()

        return jsonify({
            "msg": "Video subido correctamente",
            "filename": unique_name,
            "expires_at": expires_at.isoformat(),
            "total_videos": len(videos),
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al subir video: {str(e)}"}), 500


# ============ SERVIR VIDEO (streaming protegido por JWT) ============
@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/video-file/<path:filename>", methods=["GET"])
def serve_video(inspeccion_id, filename):
    """
    Devuelve el archivo de video guardado localmente.
    Acepta el token JWT en la cabecera Authorization o en el query param ?token=
    (necesario porque <video> no puede enviar cabeceras).
    """
    # Obtener token desde header Bearer o query param
    token = ""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.args.get("token", "").strip()
    if not token:
        return jsonify({"msg": "Token requerido"}), 401

    try:
        decoded = decode_token(token)
        user_id = int(decoded["sub"])
    except Exception:
        return jsonify({"msg": "Token inválido o expirado"}), 401

    user = User.query.get(user_id)
    if not user or not _is_inspeccion_role(user):
        return jsonify({"msg": "No tienes permiso"}), 403

    # Prevenir path traversal: solo el basename
    safe_filename = os.path.basename(filename)
    if not safe_filename or safe_filename != filename:
        return jsonify({"msg": "Nombre de archivo inválido"}), 400

    video_dir = VIDEOS_DIR / str(inspeccion_id)
    video_path = video_dir / safe_filename
    if not video_path.exists():
        return jsonify({"msg": "Archivo no encontrado"}), 404

    return send_from_directory(
        str(video_dir),
        safe_filename,
        conditional=True,
    )


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
    Maneja tanto fotos locales (filename) como entradas legado Cloudinary (public_id).
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
    if user.rol != "administrador" and inspeccion.usuario_id != user_id:
        return jsonify({"msg": "No tienes permiso para eliminar fotos de esta inspección"}), 403

    try:
        fotos = json.loads(inspeccion.fotos_cloudinary or "[]")
        if foto_index < 0 or foto_index >= len(fotos):
            return jsonify({"msg": "Índice de foto inválido"}), 400

        foto_data = fotos[foto_index]

        # Prioridad: Cloudinary (fotos nuevas y legado con public_id)
        if foto_data.get("public_id") and _cloudinary_configured():
            try:
                cloudinary.uploader.destroy(foto_data["public_id"])
            except Exception:
                pass
        # Fallback: borrar archivo local IONOS
        elif foto_data.get("filename"):
            safe_name = os.path.basename(foto_data["filename"])
            foto_path = FOTOS_DIR / str(inspeccion_id) / safe_name
            try:
                if foto_path.exists():
                    foto_path.unlink()
            except OSError:
                pass

        fotos.pop(foto_index)
        inspeccion.fotos_cloudinary = json.dumps(fotos)
        db.session.commit()

        return jsonify({
            "msg": "Foto eliminada correctamente",
            "total_fotos": len(fotos),
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
    Maneja tanto videos locales (filename) como entradas legado Cloudinary (public_id).
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
    if user.rol != "administrador" and inspeccion.usuario_id != user_id:
        return jsonify({"msg": "No tienes permiso para eliminar videos de esta inspección"}), 403

    try:
        videos = json.loads(inspeccion.videos_cloudinary or "[]")
        if video_index < 0 or video_index >= len(videos):
            return jsonify({"msg": "Índice de video inválido"}), 400

        video_data = videos[video_index]

        # Borrar archivo local si existe
        filename = video_data.get("filename")
        if filename:
            safe_name = os.path.basename(filename)
            video_path = VIDEOS_DIR / str(inspeccion_id) / safe_name
            try:
                if video_path.exists():
                    video_path.unlink()
            except OSError:
                pass  # No bloquear si falla el borrado del disco
        elif video_data.get("public_id") and _cloudinary_configured():
            # Legado Cloudinary
            try:
                cloudinary.uploader.destroy(video_data["public_id"], resource_type="video")
            except Exception:
                pass

        videos.pop(video_index)
        inspeccion.videos_cloudinary = json.dumps(videos)
        db.session.commit()

        return jsonify({
            "msg": "Video eliminado correctamente",
            "total_videos": len(videos),
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al eliminar video: {str(e)}"}), 500


# ============ PAGOS DE PROFESIONALES (COCHES CONCESIONARIO ENTREGADOS) ============
@inspeccion_bp.route("/inspeccion-recepcion/profesionales/pagos-pendientes", methods=["GET"])
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


@inspeccion_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/registrar-pago-profesional", methods=["POST"])
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
