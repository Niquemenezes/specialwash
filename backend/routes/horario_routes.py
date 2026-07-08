import os
import uuid
import json
import calendar
from datetime import date, timedelta, datetime
from io import BytesIO
from pathlib import Path

from flask import Blueprint, jsonify, request, send_from_directory, send_file
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
import requests

import cloudinary
import cloudinary.uploader
from cloudinary.utils import cloudinary_url

from sqlalchemy import inspect, text

from models import User, db, AusenciaPersonal
from models.registro_horario import RegistroHorario
from models.base import now_madrid
from utils.auth_utils import role_required

horario_bp = Blueprint("horario_routes", __name__)

_MEDIA_BASE = Path(os.path.dirname(os.path.abspath(__file__))).parent / "media" / "horarios"

TIPOS_VALIDOS = {"entrada", "inicio_comida", "fin_comida", "salida", "inicio_descanso", "fin_descanso"}
TIPOS_AUSENCIA = {"vacaciones", "falta", "permiso", "baja_temporal", "baja_permanente"}
ESTADOS_AUSENCIA = {"pendiente", "aprobado", "rechazado"}
RETENCION_FOTOS_DIAS = 60
_CLOUDINARY_READY = None
_HORARIO_SCHEMA_READY = False
_MAX_DESCANSO_MINUTOS = 60


def _ensure_registro_horario_schema() -> None:
    global _HORARIO_SCHEMA_READY
    if _HORARIO_SCHEMA_READY:
        return
    inspector = inspect(db.engine)
    columnas = {col.get("name") for col in inspector.get_columns("registro_horario")}
    if "pausas" not in columnas:
        db.session.execute(text("ALTER TABLE registro_horario ADD COLUMN pausas TEXT"))
        db.session.commit()
    _HORARIO_SCHEMA_READY = True


def _get_pausas(registro: RegistroHorario):
    try:
        raw = json.loads(registro.pausas or "[]")
        if isinstance(raw, list):
            return [p for p in raw if isinstance(p, list) and len(p) >= 1 and p[0]]
    except Exception:
        pass
    return []


def _total_descanso_minutos(pausas) -> int:
    total = 0
    ahora = now_madrid()
    for pausa in pausas or []:
        try:
            inicio = datetime.fromisoformat(str(pausa[0]).replace("Z", "+00:00"))
            fin_iso = pausa[1] if len(pausa) > 1 else None
            fin = datetime.fromisoformat(str(fin_iso).replace("Z", "+00:00")) if fin_iso else ahora
            delta = max((fin - inicio).total_seconds(), 0)
            total += int(round(delta / 60))
        except Exception:
            continue
    return total


def _auto_pausar_partes_activos(empleado_id: int, momento_salida) -> None:
    """Al fichar salida, pausa todos los partes en_proceso del empleado."""
    from models.parte_trabajo import ParteTrabajo, EstadoParte
    from models.parte_trabajo_colaborador import ParteTrabajoColaborador

    momento_iso = momento_salida.isoformat()

    # Partes directos en_proceso
    partes_activos = ParteTrabajo.query.filter_by(
        empleado_id=empleado_id,
        estado=EstadoParte.en_proceso,
    ).all()
    for parte in partes_activos:
        pausas = json.loads(parte.pausas) if parte.pausas else []
        pausas.append([momento_iso, None])
        parte.pausas = json.dumps(pausas)
        parte.estado = EstadoParte.en_pausa

    # Colaboraciones activas en partes de pintura compartidos
    colabs_activos = ParteTrabajoColaborador.query.filter_by(
        empleado_id=empleado_id,
        estado=EstadoParte.en_proceso,
    ).all()
    for colab in colabs_activos:
        pausas = json.loads(colab.pausas) if colab.pausas else []
        pausas.append([momento_iso, None])
        colab.pausas = json.dumps(pausas)
        colab.estado = EstadoParte.en_pausa
        # Sincronizar estado del parte padre si ya no queda nadie activo
        parte = ParteTrabajo.query.get(colab.parte_id)
        if parte and parte.estado == EstadoParte.en_proceso:
            otros_activos = ParteTrabajoColaborador.query.filter(
                ParteTrabajoColaborador.parte_id == colab.parte_id,
                ParteTrabajoColaborador.id != colab.id,
                ParteTrabajoColaborador.estado == EstadoParte.en_proceso,
            ).count()
            if otros_activos == 0:
                parte.estado = EstadoParte.en_pausa


def _foto_dir(empleado_id: int) -> Path:
    d = _MEDIA_BASE / str(empleado_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _get_o_crear_registro(empleado_id: int, hoy: date) -> RegistroHorario:
    _ensure_registro_horario_schema()
    registro = RegistroHorario.query.filter_by(empleado_id=empleado_id, fecha=hoy).first()
    if not registro:
        registro = RegistroHorario(empleado_id=empleado_id, fecha=hoy)
        db.session.add(registro)
        db.session.flush()
    return registro


def _cloudinary_ready() -> bool:
    global _CLOUDINARY_READY
    if _CLOUDINARY_READY is not None:
        return _CLOUDINARY_READY

    cloudinary_url_env = os.getenv("CLOUDINARY_URL", "").strip()
    if cloudinary_url_env:
        cloudinary.config(cloudinary_url=cloudinary_url_env, secure=True)
        _CLOUDINARY_READY = True
        return True

    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
    api_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
    api_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()
    if cloud_name and api_key and api_secret:
        cloudinary.config(cloud_name=cloud_name, api_key=api_key, api_secret=api_secret, secure=True)
        _CLOUDINARY_READY = True
        return True

    _CLOUDINARY_READY = False
    return False


def _is_cloudinary_ref(value: str) -> bool:
    return bool(value) and str(value).startswith("cld:")


def _extract_public_id(value: str) -> str:
    if not _is_cloudinary_ref(value):
        return ""
    return str(value)[4:]


def _purgar_fotos_antiguas() -> None:
    """Elimina fotos y referencias de fichajes con más de 60 días."""
    _ensure_registro_horario_schema()
    limite = now_madrid().date() - timedelta(days=RETENCION_FOTOS_DIAS)
    viejos = RegistroHorario.query.filter(RegistroHorario.fecha < limite).all()
    if not viejos:
        return

    hubo_cambios = False
    campos_foto = ("foto_entrada", "foto_inicio_comida", "foto_fin_comida", "foto_salida")
    for reg in viejos:
        for campo in campos_foto:
            nombre = getattr(reg, campo)
            if not nombre:
                continue
            if _is_cloudinary_ref(nombre):
                public_id = _extract_public_id(nombre)
                if public_id and _cloudinary_ready():
                    try:
                        cloudinary.uploader.destroy(public_id, resource_type="image", invalidate=True)
                    except Exception:
                        pass
            else:
                ruta = _foto_dir(reg.empleado_id) / os.path.basename(nombre)
                if ruta.exists():
                    try:
                        ruta.unlink()
                    except Exception:
                        pass
            setattr(reg, campo, None)
            hubo_cambios = True

    if hubo_cambios:
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()


# ─── POST /api/horario/fichar ────────────────────────────────────────────────
@horario_bp.route("/horario/fichar", methods=["POST"])
@jwt_required()
def fichar():
    empleado_id = int(get_jwt_identity())
    tipo = (request.form.get("tipo") or "").strip().lower()
    tipo = {"inicio_descanso": "inicio_comida", "fin_descanso": "fin_comida"}.get(tipo, tipo)

    if tipo not in {"entrada", "inicio_comida", "fin_comida", "salida"}:
        return jsonify({"msg": "Tipo inválido. Usa: entrada, inicio_descanso, fin_descanso o salida"}), 400

    TIPOS_CON_FOTO = {"entrada", "salida"}
    foto_file = request.files.get("foto")
    requiere_foto = tipo in TIPOS_CON_FOTO
    if requiere_foto and (not foto_file or not foto_file.filename):
        return jsonify({"msg": "La foto es obligatoria para fichar entrada y salida"}), 400

    _purgar_fotos_antiguas()
    hoy = now_madrid().date()

    registro = _get_o_crear_registro(empleado_id, hoy)

    # Validar orden lógico y descansos múltiples
    pausas = _get_pausas(registro)
    descanso_activo = any((len(p) < 2 or p[1] in (None, "")) for p in pausas)
    descanso_total_min = _total_descanso_minutos(pausas)

    if tipo in {"entrada", "salida"} and getattr(registro, tipo) is not None:
        return jsonify({"msg": f"Ya fichaste '{tipo}' hoy"}), 409

    if tipo == "entrada":
        pass
    elif tipo == "inicio_comida":
        if registro.entrada is None:
            return jsonify({"msg": "Debes fichar entrada antes de iniciar el descanso"}), 409
        if registro.salida is not None:
            return jsonify({"msg": "La jornada ya está cerrada con salida"}), 409
        if descanso_activo:
            return jsonify({"msg": "Ya tienes un descanso iniciado. Ficha su fin antes de abrir otro."}), 409
        if descanso_total_min >= _MAX_DESCANSO_MINUTOS:
            return jsonify({"msg": "Ya alcanzaste el máximo diario de 1 hora de descanso."}), 409
    elif tipo == "fin_comida":
        if registro.entrada is None:
            return jsonify({"msg": "Debes fichar entrada antes de cerrar el descanso"}), 409
        if not descanso_activo:
            return jsonify({"msg": "No tienes ningún descanso iniciado ahora mismo."}), 409
    elif tipo == "salida":
        if registro.entrada is None:
            return jsonify({"msg": "Debes fichar entrada antes de fichar la salida"}), 409
        if descanso_activo:
            return jsonify({"msg": "Tienes pendiente fichar el fin del descanso antes de la salida"}), 409

    # Guardar foto solo si viene (obligatoria para entrada/salida, opcional para el resto)
    foto_path = None
    if foto_file and foto_file.filename:
        ext = os.path.splitext(foto_file.filename)[1].lower() or ".jpg"
        nombre = f"{tipo}_{hoy.isoformat()}_{uuid.uuid4().hex[:8]}{ext}"

        if _cloudinary_ready():
            try:
                uploaded = cloudinary.uploader.upload(
                    foto_file,
                    folder=f"specialwash/horarios/{empleado_id}/{hoy.isoformat()}",
                    public_id=nombre.rsplit(".", 1)[0],
                    resource_type="image",
                    overwrite=False,
                )
                foto_path = f"cld:{uploaded.get('public_id', '')}" if uploaded.get("public_id") else None
            except Exception:
                foto_path = None

        if not foto_path:
            foto_dir = _foto_dir(empleado_id)
            foto_file.save(str(foto_dir / nombre))
            foto_path = nombre

    # Asignar timestamp y foto
    momento = now_madrid()
    if tipo == "inicio_comida":
        if registro.inicio_comida is None:
            registro.inicio_comida = momento
        pausas.append([momento.isoformat(), None])
        registro.pausas = json.dumps(pausas)
    elif tipo == "fin_comida":
        for pausa in reversed(pausas):
            if len(pausa) < 2 or pausa[1] in (None, ""):
                if len(pausa) < 2:
                    pausa.append(momento.isoformat())
                else:
                    pausa[1] = momento.isoformat()
                break
        registro.fin_comida = momento
        registro.pausas = json.dumps(pausas)
    else:
        setattr(registro, tipo, momento)

    campo_foto = f"foto_{tipo}"
    if foto_path:
        setattr(registro, campo_foto, foto_path)

    # Al fichar salida, pausar automáticamente todos los partes en curso
    partes_pausados = 0
    if tipo == "salida":
        try:
            _auto_pausar_partes_activos(empleado_id, momento)
            # Contar cuántos se pausaron para informar al trabajador
            from models.parte_trabajo import ParteTrabajo, EstadoParte
            partes_pausados = ParteTrabajo.query.filter_by(
                empleado_id=empleado_id,
                estado=EstadoParte.en_pausa,
            ).count()
        except Exception:
            pass  # No bloquear el fichaje si falla el autopauso

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al guardar en base de datos"}), 500

    if tipo == "entrada":
        try:
            from services.google_sheets_service import marcar_asistencia as _sheets_marcar_asistencia
            empleado = User.query.get(empleado_id)
            if empleado:
                _sheets_marcar_asistencia(empleado.nombre, hoy, "P")
        except Exception as e:
            import logging as _log
            _log.warning(f"[Google Sheets] Error al marcar asistencia: {e}")

    resp = {"msg": "Fichaje registrado", "registro": registro.to_dict()}
    if tipo == "salida" and partes_pausados > 0:
        resp["aviso_partes_pausados"] = partes_pausados
    return jsonify(resp), 200


# ─── GET /api/horario/hoy ────────────────────────────────────────────────────
@horario_bp.route("/horario/hoy", methods=["GET"])
@jwt_required()
def horario_hoy():
    _ensure_registro_horario_schema()
    empleado_id = int(get_jwt_identity())
    hoy = now_madrid().date()
    registro = RegistroHorario.query.filter_by(empleado_id=empleado_id, fecha=hoy).first()
    if not registro:
        return jsonify(None), 200
    return jsonify(registro.to_dict()), 200


# ─── GET /api/horario/mensual ─────────────────────────────────────────────────
@horario_bp.route("/horario/mensual", methods=["GET"])
@role_required("administrador", "encargado")
def horario_mensual():
    _ensure_registro_horario_schema()
    hoy = now_madrid().date()
    anio = request.args.get("anio", type=int, default=hoy.year)
    mes = request.args.get("mes", type=int, default=hoy.month)
    dia = request.args.get("dia", type=int, default=hoy.day)
    semana = request.args.get("semana", type=int)
    periodo = (request.args.get("periodo") or "mes").strip().lower()
    fecha_str = request.args.get("fecha")
    empleado_id = request.args.get("empleado_id", type=int)

    if fecha_str:
        try:
            fecha_ref = date.fromisoformat(fecha_str)
        except ValueError:
            return jsonify({"msg": "Formato de fecha inválido. Usa YYYY-MM-DD"}), 400
    else:
        try:
            fecha_ref = date(anio, mes, dia)
        except ValueError:
            return jsonify({"msg": "Fecha inválida"}), 400

    if periodo == "dia":
        fecha_inicio = fecha_ref
        fecha_fin = fecha_ref
    elif periodo == "semana":
        if semana:
            try:
                fecha_inicio = date.fromisocalendar(anio, semana, 1)
            except ValueError:
                return jsonify({"msg": "Semana inválida"}), 400
        else:
            fecha_inicio = fecha_ref - timedelta(days=fecha_ref.weekday())
        fecha_fin = fecha_inicio + timedelta(days=6)
    elif periodo == "anio":
        fecha_inicio = date(anio, 1, 1)
        fecha_fin = date(anio, 12, 31)
    else:
        ultimo_dia = calendar.monthrange(anio, mes)[1]
        fecha_inicio = date(anio, mes, 1)
        fecha_fin = date(anio, mes, ultimo_dia)

    query = RegistroHorario.query.filter(
        RegistroHorario.fecha >= fecha_inicio,
        RegistroHorario.fecha <= fecha_fin,
    )
    if empleado_id:
        query = query.filter_by(empleado_id=empleado_id)

    registros = query.order_by(RegistroHorario.fecha, RegistroHorario.empleado_id).all()
    return jsonify([r.to_dict() for r in registros]), 200


# ─── PUT /api/horario/<id> ───────────────────────────────────────────────────
@horario_bp.route("/horario/<int:registro_id>", methods=["PUT"])
@role_required("administrador", "encargado")
def editar_registro(registro_id):
    """Permite a admin/encargado corregir o añadir horas de un registro."""
    _ensure_registro_horario_schema()
    from zoneinfo import ZoneInfo
    from datetime import datetime

    registro = RegistroHorario.query.get(registro_id)
    if not registro:
        return jsonify({"msg": "Registro no encontrado"}), 404

    data = request.get_json() or {}
    TZ = ZoneInfo("Europe/Madrid")

    for campo in ("entrada", "inicio_comida", "fin_comida", "salida"):
        if campo in data:
            valor = data[campo]
            if valor is None or valor == "":
                setattr(registro, campo, None)
            else:
                try:
                    # Acepta HH:MM o HH:MM:SS; combina con la fecha del registro
                    hora_str = str(valor).strip()
                    if len(hora_str) == 5:
                        hora_str += ":00"
                    dt = datetime.combine(registro.fecha, datetime.strptime(hora_str, "%H:%M:%S").time(), tzinfo=TZ)
                    setattr(registro, campo, dt)
                except (ValueError, TypeError):
                    return jsonify({"msg": f"Formato de hora inválido para '{campo}'. Usa HH:MM"}), 400

    if any(campo in data for campo in ("inicio_comida", "fin_comida")):
        if registro.inicio_comida:
            registro.pausas = json.dumps([[registro.inicio_comida.isoformat(), registro.fin_comida.isoformat() if registro.fin_comida else None]])
        else:
            registro.pausas = None

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al guardar en base de datos"}), 500
    return jsonify({"msg": "Registro actualizado", "registro": registro.to_dict()}), 200


# ─── DELETE /api/horario/<id> ────────────────────────────────────────────────
@horario_bp.route("/horario/<int:registro_id>", methods=["DELETE"])
@role_required("administrador")
def eliminar_registro(registro_id):
    _ensure_registro_horario_schema()
    registro = RegistroHorario.query.get(registro_id)
    if not registro:
        return jsonify({"msg": "Registro no encontrado"}), 404
    try:
        db.session.delete(registro)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al eliminar"}), 500
    return jsonify({"msg": "Registro eliminado"}), 200


# ─── POST /api/horario/admin/crear ───────────────────────────────────────────
@horario_bp.route("/horario/admin/crear", methods=["POST"])
@role_required("administrador")
def admin_crear_registro():
    """Crea o actualiza el registro de hoy para cualquier empleado."""
    _ensure_registro_horario_schema()
    from zoneinfo import ZoneInfo
    from datetime import datetime

    data = request.get_json() or {}
    empleado_id = data.get("empleado_id")
    fecha_str = data.get("fecha")
    if not empleado_id:
        return jsonify({"msg": "empleado_id requerido"}), 400

    TZ = ZoneInfo("Europe/Madrid")
    try:
        fecha = date.fromisoformat(fecha_str) if fecha_str else now_madrid().date()
    except ValueError:
        return jsonify({"msg": "Formato de fecha inválido. Usa YYYY-MM-DD"}), 400

    registro = _get_o_crear_registro(int(empleado_id), fecha)

    for campo in ("entrada", "inicio_comida", "fin_comida", "salida"):
        if campo in data:
            valor = data[campo]
            if valor is None or valor == "":
                setattr(registro, campo, None)
            else:
                try:
                    hora_str = str(valor).strip()
                    if len(hora_str) == 5:
                        hora_str += ":00"
                    dt = datetime.combine(fecha, datetime.strptime(hora_str, "%H:%M:%S").time(), tzinfo=TZ)
                    setattr(registro, campo, dt)
                except (ValueError, TypeError):
                    return jsonify({"msg": f"Formato de hora inválido para '{campo}'. Usa HH:MM"}), 400

    if any(campo in data for campo in ("inicio_comida", "fin_comida")):
        if registro.inicio_comida:
            registro.pausas = json.dumps([[registro.inicio_comida.isoformat(), registro.fin_comida.isoformat() if registro.fin_comida else None]])
        else:
            registro.pausas = None

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al guardar en base de datos"}), 500
    return jsonify({"msg": "Registro guardado", "registro": registro.to_dict()}), 200


# ─── GET /api/horario/hoy-todos ──────────────────────────────────────────────
@horario_bp.route("/horario/hoy-todos", methods=["GET"])
@role_required("administrador")
def horario_hoy_todos():
    """Devuelve los registros de HOY para todos los empleados activos."""
    _ensure_registro_horario_schema()
    hoy = now_madrid().date()
    registros = (
        RegistroHorario.query
        .filter_by(fecha=hoy)
        .order_by(RegistroHorario.empleado_id)
        .all()
    )
    empleados = User.query.filter_by(activo=True).order_by(User.nombre).all()
    registros_por_empleado = {r.empleado_id: r for r in registros}
    result = []
    for emp in empleados:
        r = registros_por_empleado.get(emp.id)
        if r:
            d = r.to_dict()
        else:
            d = {"id": None, "empleado_id": emp.id, "fecha": hoy.isoformat(),
                 "entrada": None, "inicio_comida": None, "fin_comida": None, "salida": None}
        d["empleado_nombre"] = emp.nombre
        result.append(d)
    return jsonify(result), 200


def _build_periodo_fechas(args):
    hoy = now_madrid().date()
    anio = args.get("anio", type=int, default=hoy.year)
    mes = args.get("mes", type=int, default=hoy.month)
    dia = args.get("dia", type=int, default=hoy.day)
    periodo = (args.get("periodo") or "mes").strip().lower()
    fecha_str = args.get("fecha")

    if fecha_str:
        try:
            fecha_ref = date.fromisoformat(fecha_str)
        except ValueError:
            return None, jsonify({"msg": "Formato de fecha inválido. Usa YYYY-MM-DD"}), 400
    else:
        try:
            fecha_ref = date(anio, mes, dia)
        except ValueError:
            return None, jsonify({"msg": "Fecha inválida"}), 400

    if periodo == "dia":
        fecha_inicio = fecha_ref
        fecha_fin = fecha_ref
    elif periodo == "semana":
        semana = args.get("semana", type=int)
        if semana:
            try:
                fecha_inicio = date.fromisocalendar(anio, semana, 1)
            except ValueError:
                return None, jsonify({"msg": "Semana inválida"}), 400
        else:
            fecha_inicio = fecha_ref - timedelta(days=fecha_ref.weekday())
        fecha_fin = fecha_inicio + timedelta(days=6)
    elif periodo == "anio":
        fecha_inicio = date(anio, 1, 1)
        fecha_fin = date(anio, 12, 31)
    else:
        ultimo_dia = calendar.monthrange(anio, mes)[1]
        fecha_inicio = date(anio, mes, 1)
        fecha_fin = date(anio, mes, ultimo_dia)

    return (fecha_inicio, fecha_fin), None, None


# ─── GET /api/horario/ausencias ─────────────────────────────────────────────
@horario_bp.route("/horario/ausencias", methods=["GET"])
@role_required("administrador", "encargado")
def obtener_ausencias():
    periodo, error, status = _build_periodo_fechas(request.args)
    if error:
        return error, status

    fecha_inicio, fecha_fin = periodo
    empleado_id = request.args.get("empleado_id", type=int)

    query = AusenciaPersonal.query.filter(
        AusenciaPersonal.fecha_inicio <= fecha_fin,
        AusenciaPersonal.fecha_fin >= fecha_inicio,
    )
    if empleado_id:
        query = query.filter_by(empleado_id=empleado_id)

    ausencias = query.order_by(AusenciaPersonal.fecha_inicio, AusenciaPersonal.empleado_id).all()
    return jsonify([a.to_dict() for a in ausencias]), 200


def _parse_ausencia_date(value, field_name, required=False):
    if value in (None, ""):
        if required:
            raise ValueError(f"'{field_name}' es obligatorio")
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError(f"Formato inválido para '{field_name}', usa YYYY-MM-DD")


def _validar_tipo_estado(tipo, estado):
    tipo = (tipo or "").strip().lower()
    estado = (estado or "").strip().lower()
    if tipo not in TIPOS_AUSENCIA:
        raise ValueError(f"Tipo inválido. Usa: {', '.join(sorted(TIPOS_AUSENCIA))}")
    if estado and estado not in ESTADOS_AUSENCIA:
        raise ValueError(f"Estado inválido. Usa: {', '.join(sorted(ESTADOS_AUSENCIA))}")
    return tipo, estado or "pendiente"


def _crear_o_actualizar_ausencia(ausencia, data):
    empleado_id = data.get("empleado_id")
    if not empleado_id:
        raise ValueError("empleado_id es obligatorio")

    tipo, estado = _validar_tipo_estado(data.get("tipo"), data.get("estado"))
    fecha_inicio = _parse_ausencia_date(data.get("fecha_inicio"), "fecha_inicio", required=True)
    fecha_fin = _parse_ausencia_date(data.get("fecha_fin"), "fecha_fin", required=True)
    if fecha_fin < fecha_inicio:
        raise ValueError("fecha_fin no puede ser anterior a fecha_inicio")

    dias = max(1, (fecha_fin - fecha_inicio).days + 1)
    ausencia.empleado_id = int(empleado_id)
    ausencia.tipo = tipo
    ausencia.estado = estado
    ausencia.fecha_inicio = fecha_inicio
    ausencia.fecha_fin = fecha_fin
    ausencia.dias = dias
    ausencia.motivo = (data.get("motivo") or "").strip() or None


# ─── POST /api/horario/ausencias ────────────────────────────────────────────
@horario_bp.route("/horario/ausencias", methods=["POST"])
@role_required("administrador")
def crear_ausencia():
    data = request.get_json() or {}
    ausencia = AusenciaPersonal()
    try:
        _crear_o_actualizar_ausencia(ausencia, data)
        db.session.add(ausencia)
        db.session.commit()
    except ValueError as exc:
        return jsonify({"msg": str(exc)}), 400
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al guardar la ausencia"}), 500

    if ausencia.estado == "aprobado":
        try:
            from services.google_sheets_service import marcar_ausencia_sheets as _sheets_marcar_ausencia
            empleado = User.query.get(ausencia.empleado_id)
            if empleado:
                _sheets_marcar_ausencia(empleado.nombre, ausencia.tipo, ausencia.fecha_inicio, ausencia.fecha_fin)
        except Exception as e:
            import logging as _log
            _log.warning(f"[Google Sheets] Error al marcar ausencia: {e}")

    return jsonify({"msg": "Ausencia creada", "ausencia": ausencia.to_dict()}), 200


# ─── PUT /api/horario/ausencias/<id> ─────────────────────────────────────────
@horario_bp.route("/horario/ausencias/<int:ausencia_id>", methods=["PUT"])
@role_required("administrador")
def editar_ausencia(ausencia_id):
    ausencia = AusenciaPersonal.query.get(ausencia_id)
    if not ausencia:
        return jsonify({"msg": "Ausencia no encontrada"}), 404

    estado_previo = ausencia.estado
    tipo_previo = ausencia.tipo
    fecha_inicio_previa = ausencia.fecha_inicio
    fecha_fin_previa = ausencia.fecha_fin
    empleado_id_previo = ausencia.empleado_id

    data = request.get_json() or {}
    try:
        _crear_o_actualizar_ausencia(ausencia, data)
        db.session.commit()
    except ValueError as exc:
        return jsonify({"msg": str(exc)}), 400
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al actualizar la ausencia"}), 500

    try:
        from services.google_sheets_service import marcar_ausencia_sheets as _sheets_marcar, revertir_ausencia_sheets as _sheets_revertir
        empleado_previo = User.query.get(empleado_id_previo)
        if estado_previo == "aprobado" and empleado_previo:
            _sheets_revertir(empleado_previo.nombre, tipo_previo, fecha_inicio_previa, fecha_fin_previa)
        if ausencia.estado == "aprobado":
            empleado = User.query.get(ausencia.empleado_id)
            if empleado:
                _sheets_marcar(empleado.nombre, ausencia.tipo, ausencia.fecha_inicio, ausencia.fecha_fin)
    except Exception as e:
        import logging as _log
        _log.warning(f"[Google Sheets] Error al sincronizar ausencia editada: {e}")

    return jsonify({"msg": "Ausencia actualizada", "ausencia": ausencia.to_dict()}), 200


# ─── DELETE /api/horario/ausencias/<id> ───────────────────────────────────────
@horario_bp.route("/horario/ausencias/<int:ausencia_id>", methods=["DELETE"])
@role_required("administrador")
def eliminar_ausencia(ausencia_id):
    ausencia = AusenciaPersonal.query.get(ausencia_id)
    if not ausencia:
        return jsonify({"msg": "Ausencia no encontrada"}), 404

    estado_previo = ausencia.estado
    tipo_previo = ausencia.tipo
    fecha_inicio_previa = ausencia.fecha_inicio
    fecha_fin_previa = ausencia.fecha_fin
    empleado_id_previo = ausencia.empleado_id

    try:
        db.session.delete(ausencia)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al eliminar la ausencia"}), 500

    if estado_previo == "aprobado":
        try:
            from services.google_sheets_service import revertir_ausencia_sheets as _sheets_revertir
            empleado = User.query.get(empleado_id_previo)
            if empleado:
                _sheets_revertir(empleado.nombre, tipo_previo, fecha_inicio_previa, fecha_fin_previa)
        except Exception as e:
            import logging as _log
            _log.warning(f"[Google Sheets] Error al revertir ausencia eliminada: {e}")

    return jsonify({"msg": "Ausencia eliminada"}), 200


# ─── POST /api/horario/asistencia/sincronizar ────────────────────────────────
@horario_bp.route("/horario/asistencia/sincronizar", methods=["POST"])
@role_required("administrador")
def sincronizar_asistencia():
    """Recalcula y sobrescribe el mes indicado en el Google Sheet de asistencia
    a partir de los fichajes y ausencias aprobadas ya guardados en la BD."""
    data = request.get_json() or {}
    hoy = now_madrid()
    anio = int(data.get("anio") or hoy.year)
    mes = int(data.get("mes") or hoy.month)

    ultimo_dia = calendar.monthrange(anio, mes)[1]
    fecha_inicio = date(anio, mes, 1)
    fecha_fin = date(anio, mes, ultimo_dia)

    empleados = User.query.filter_by(activo=True).order_by(User.nombre).all()
    empleados_por_id = {e.id: e.nombre for e in empleados}
    empleados_nombres = [e.nombre for e in empleados]

    from services.google_sheets_service import CODIGO_AUSENCIA, sincronizar_asistencia_mes

    datos = {nombre: {} for nombre in empleados_nombres}

    # Ausencias aprobadas primero; un fichaje real del mismo día las sobrescribe después
    ausencias = AusenciaPersonal.query.filter(
        AusenciaPersonal.estado == "aprobado",
        AusenciaPersonal.fecha_inicio <= fecha_fin,
        AusenciaPersonal.fecha_fin >= fecha_inicio,
    ).all()
    for a in ausencias:
        nombre = empleados_por_id.get(a.empleado_id)
        if not nombre:
            continue
        codigo = CODIGO_AUSENCIA.get(a.tipo, "A")
        d = max(a.fecha_inicio, fecha_inicio)
        fin = min(a.fecha_fin, fecha_fin)
        while d <= fin:
            datos[nombre][d.day] = codigo
            d += timedelta(days=1)

    registros = RegistroHorario.query.filter(
        RegistroHorario.fecha >= fecha_inicio,
        RegistroHorario.fecha <= fecha_fin,
        RegistroHorario.entrada.isnot(None),
    ).all()
    for r in registros:
        nombre = empleados_por_id.get(r.empleado_id)
        if nombre:
            datos[nombre][r.fecha.day] = "P"

    ok = sincronizar_asistencia_mes(mes, anio, datos, empleados_nombres)
    if not ok:
        return jsonify({"msg": "Error al sincronizar con Google Sheets"}), 500
    return jsonify({"msg": "Asistencia sincronizada", "mes": mes, "anio": anio, "empleados": len(empleados_nombres)}), 200


# ─── GET /api/horario/empleados-activos ──────────────────────────────────────
@horario_bp.route("/horario/empleados-activos", methods=["GET"])
@role_required("administrador", "encargado")
def empleados_activos():
    usuarios = User.query.filter_by(activo=True).order_by(User.nombre).all()
    return jsonify([{"id": u.id, "nombre": u.nombre, "rol": u.rol} for u in usuarios]), 200


# ─── GET /api/horario/selfie/<id>/<tipo> ─────────────────────────────────────
@horario_bp.route("/horario/selfie/<int:empleado_id>/<tipo>", methods=["GET"])
@role_required("administrador")
def servir_selfie(empleado_id, tipo):
    if tipo not in TIPOS_VALIDOS:
        return jsonify({"msg": "Tipo inválido"}), 400

    fecha_str = request.args.get("fecha")
    if not fecha_str:
        return jsonify({"msg": "Parámetro 'fecha' requerido (YYYY-MM-DD)"}), 400

    try:
        fecha = date.fromisoformat(fecha_str)
    except ValueError:
        return jsonify({"msg": "Formato de fecha inválido"}), 400

    registro = RegistroHorario.query.filter_by(empleado_id=empleado_id, fecha=fecha).first()
    if not registro:
        return jsonify({"msg": "Registro no encontrado"}), 404

    nombre_archivo = getattr(registro, f"foto_{tipo}")
    if not nombre_archivo:
        return jsonify({"msg": "No hay foto para este fichaje"}), 404

    if _is_cloudinary_ref(nombre_archivo):
        public_id = _extract_public_id(nombre_archivo)
        if not public_id:
            return jsonify({"msg": "Referencia de foto inválida"}), 404
        if not _cloudinary_ready():
            return jsonify({"msg": "Cloudinary no configurado"}), 500

        url, _ = cloudinary_url(public_id, secure=True, resource_type="image")
        try:
            resp = requests.get(url, timeout=15)
        except Exception:
            return jsonify({"msg": "No se pudo cargar la foto"}), 502
        if resp.status_code >= 400:
            return jsonify({"msg": "No se pudo cargar la foto"}), 404

        content_type = resp.headers.get("Content-Type") or "image/jpeg"
        return send_file(BytesIO(resp.content), mimetype=content_type)

    foto_dir = _foto_dir(empleado_id)
    safe_name = os.path.basename(nombre_archivo)
    foto_path = foto_dir / safe_name
    if not foto_path.exists():
        return jsonify({"msg": "Archivo no encontrado"}), 404

    return send_from_directory(str(foto_dir), safe_name)
