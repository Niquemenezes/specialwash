import os
import uuid
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path

from flask import Blueprint, jsonify, request, send_from_directory, send_file
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
import requests

import cloudinary
import cloudinary.uploader
from cloudinary.utils import cloudinary_url

from models import User, db
from models.registro_horario import RegistroHorario
from models.base import now_madrid
from utils.auth_utils import role_required

horario_bp = Blueprint("horario_routes", __name__)

_MEDIA_BASE = Path(os.path.dirname(os.path.abspath(__file__))).parent / "media" / "horarios"

TIPOS_VALIDOS = {"entrada", "inicio_comida", "fin_comida", "salida"}
RETENCION_FOTOS_DIAS = 60
_CLOUDINARY_READY = None


def _foto_dir(empleado_id: int) -> Path:
    d = _MEDIA_BASE / str(empleado_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _get_o_crear_registro(empleado_id: int, hoy: date) -> RegistroHorario:
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
        db.session.commit()


# ─── POST /api/horario/fichar ────────────────────────────────────────────────
@horario_bp.route("/horario/fichar", methods=["POST"])
@jwt_required()
def fichar():
    empleado_id = int(get_jwt_identity())
    tipo = (request.form.get("tipo") or "").strip().lower()

    if tipo not in TIPOS_VALIDOS:
        return jsonify({"msg": "Tipo inválido. Usa: entrada, inicio_comida, fin_comida, salida"}), 400

    foto_file = request.files.get("foto")
    if not foto_file or not foto_file.filename:
        return jsonify({"msg": "La foto es obligatoria para fichar"}), 400

    _purgar_fotos_antiguas()
    hoy = now_madrid().date()

    registro = _get_o_crear_registro(empleado_id, hoy)

    # Validar orden: no permitir fichar si ya existe ese timestamp
    campo_dt = tipo
    if getattr(registro, campo_dt) is not None:
        return jsonify({"msg": f"Ya fichaste '{tipo}' hoy"}), 409

    # Guardar foto si viene
    foto_path = None
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
    setattr(registro, campo_dt, now_madrid())
    campo_foto = f"foto_{tipo}"
    if foto_path:
        setattr(registro, campo_foto, foto_path)

    db.session.commit()
    return jsonify({"msg": "Fichaje registrado", "registro": registro.to_dict()}), 200


# ─── GET /api/horario/hoy ────────────────────────────────────────────────────
@horario_bp.route("/horario/hoy", methods=["GET"])
@jwt_required()
def horario_hoy():
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
    anio = request.args.get("anio", type=int, default=now_madrid().year)
    mes = request.args.get("mes", type=int, default=now_madrid().month)
    empleado_id = request.args.get("empleado_id", type=int)

    query = RegistroHorario.query.filter(
        db.extract("year", RegistroHorario.fecha) == anio,
        db.extract("month", RegistroHorario.fecha) == mes,
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

    db.session.commit()
    return jsonify({"msg": "Registro actualizado", "registro": registro.to_dict()}), 200


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
