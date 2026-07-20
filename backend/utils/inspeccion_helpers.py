from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
import json
import logging
import unicodedata
from datetime import datetime
from types import SimpleNamespace

from models import db
from models.user import User
from models.parte_trabajo import ParteTrabajo, EstadoParte
from models.gasto_empresa import GastoEmpresa
from models.servicio_catalogo import ServicioCatalogo
from models.base import now_madrid
from utils.auth_utils import normalize_role


# ============ HELPERS ESTADO DEL COCHE ============

_PRIORIDAD_ESTADO_PARTE = {"en_proceso": 0, "en_pausa": 1, "pendiente": 2, "finalizado": 3}

def _estado_str(estado, default="finalizado"):
    if not estado:
        return default
    return estado.value if hasattr(estado, "value") else str(estado)
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
        st = _estado_str(parte.estado, "finalizado")
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

    st = _estado_str(parte.estado, "desconocido")
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
        st = _estado_str(p.estado, "finalizado")
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


INSPECCION_ALLOWED_ROLES = {"administrador", "calidad", "detailing"}
INSPECCION_MANAGER_ROLES = {"administrador", "calidad", "detailing"}


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


def _servicios_label(raw):
    """Convierte servicios_aplicados JSON a string legible."""
    try:
        items = json.loads(raw) if isinstance(raw, str) else (raw or [])
        nombres = [
            (i.get("nombre") or i.get("descripcion") or "").strip()
            for i in items if isinstance(i, dict)
        ]
        return " + ".join(n for n in nombres if n)
    except Exception:
        return ""


def _fmt_fecha(dt):
    if not dt:
        return ""
    try:
        return dt.strftime("%d/%m/%Y")
    except Exception:
        return str(dt)[:10]
