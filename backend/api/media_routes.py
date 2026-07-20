from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, decode_token
import cloudinary
import cloudinary.uploader
import json
import os
import uuid
from pathlib import Path
from datetime import datetime, timedelta, timezone

from models import db
from models.inspeccion_recepcion import InspeccionRecepcion
from models.user import User
from utils.inspeccion_helpers import _jwt_user_id, _is_inspeccion_role


def _is_admin(user):
    return user and getattr(user, "rol", "") == "administrador"

media_bp = Blueprint('media', __name__, url_prefix='/api')

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


# ============ SUBIR FOTO (almacenamiento local IONOS) ============
@media_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/upload-foto", methods=["POST"])
@jwt_required()
def upload_foto(inspeccion_id):
    """
    Subir una foto de inspección. Se guarda en el servidor local IONOS.
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

    raw_name = file.filename or ""
    ext = os.path.splitext(raw_name)[1].lower()
    if ext not in FOTO_ALLOWED_EXTS:
        return jsonify({"msg": f"Formato de imagen no admitido: {ext or 'sin extensión'}"}), 400

    tipo_foto = (request.form.get("tipo") or "general").strip().lower()
    if tipo_foto not in {"general", "microscopio"}:
        tipo_foto = "general"

    try:
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=FOTO_EXPIRY_DAYS)

        unique_name = f"{uuid.uuid4()}{ext}"
        foto_dir = _foto_dir(inspeccion_id)
        file.save(str(foto_dir / unique_name))
        foto_entry = {
            "filename": unique_name,
            "original_name": raw_name,
            "tipo": tipo_foto,
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
@media_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/foto-file/<path:filename>", methods=["GET"])
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
@media_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/upload-video", methods=["POST"])
@jwt_required()
def upload_video(inspeccion_id):
    """
    Subir un video de inspección al servidor local.
    Se guarda con nombre UUID, caducidad de 60 días.
    Máximo 500 MB. Formatos: mp4, mov, avi, mkv, webm, 3gp, flv.
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
@media_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/video-file/<path:filename>", methods=["GET"])
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


# ============ ELIMINAR FOTO ============
@media_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/foto/<int:foto_index>", methods=["DELETE"])
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
@media_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/video/<int:video_index>", methods=["DELETE"])
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


# ============ DIAGNÓSTICO DE VÍDEOS (solo administrador) ============
@media_bp.route("/admin/inspeccion/<int:inspeccion_id>/videos-status", methods=["GET"])
@jwt_required()
def videos_status(inspeccion_id):
    """
    Devuelve el estado de los vídeos de una inspección:
    - qué hay registrado en la BD
    - si el archivo existe realmente en disco
    - qué archivos hay en disco que quizás no estén en la BD
    Solo accesible para administradores.
    """
    user_id = _jwt_user_id()
    if not user_id:
        return jsonify({"msg": "Usuario no válido en el token"}), 401
    user = User.query.get(user_id)
    if not _is_admin(user):
        return jsonify({"msg": "Solo administradores pueden usar este endpoint"}), 403

    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    # ── Lo que dice la base de datos ──
    videos_bd = json.loads(inspeccion.videos_cloudinary or "[]")
    videos_info = []
    for i, v in enumerate(videos_bd):
        filename = v.get("filename", "")
        en_disco = False
        if filename:
            ruta = VIDEOS_DIR / str(inspeccion_id) / os.path.basename(filename)
            en_disco = ruta.exists()
            tam_bytes = ruta.stat().st_size if en_disco else None
        else:
            tam_bytes = None
        videos_info.append({
            "indice": i,
            "filename": filename,
            "nombre_original": v.get("original_name", ""),
            "subido_en": v.get("uploaded_at", ""),
            "caduca_en": v.get("expires_at", ""),
            "en_disco": en_disco,
            "tamano_bytes": tam_bytes,
        })

    # ── Archivos en disco que quizás no están en la BD ──
    video_dir = VIDEOS_DIR / str(inspeccion_id)
    archivos_disco = []
    if video_dir.exists():
        nombres_en_bd = {os.path.basename(v.get("filename", "")) for v in videos_bd if v.get("filename")}
        for f in sorted(video_dir.iterdir()):
            if f.is_file():
                archivos_disco.append({
                    "filename": f.name,
                    "en_bd": f.name in nombres_en_bd,
                    "tamano_bytes": f.stat().st_size,
                    "modificado": datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).isoformat(),
                })

    return jsonify({
        "inspeccion_id": inspeccion_id,
        "cliente": inspeccion.cliente_nombre,
        "matricula": inspeccion.matricula,
        "fecha_inspeccion": inspeccion.fecha_inspeccion.isoformat() if inspeccion.fecha_inspeccion else None,
        "videos_en_bd": len(videos_bd),
        "videos": videos_info,
        "archivos_en_disco": archivos_disco,
        "directorio_disco": str(video_dir),
    }), 200


# ============ LISTAR TODAS LAS INSPECCIONES CON VÍDEOS (solo administrador) ============
@media_bp.route("/admin/inspecciones/videos-resumen", methods=["GET"])
@jwt_required()
def videos_resumen():
    """
    Lista todas las inspecciones que tienen al menos 1 vídeo en la BD,
    con el conteo de vídeos y si los archivos existen en disco.
    Solo accesible para administradores.
    """
    user_id = _jwt_user_id()
    if not user_id:
        return jsonify({"msg": "Usuario no válido en el token"}), 401
    user = User.query.get(user_id)
    if not _is_admin(user):
        return jsonify({"msg": "Solo administradores pueden usar este endpoint"}), 403

    inspecciones = InspeccionRecepcion.query.order_by(InspeccionRecepcion.id.desc()).all()
    resultado = []
    for insp in inspecciones:
        videos_bd = json.loads(insp.videos_cloudinary or "[]")
        if not videos_bd:
            continue
        en_disco = sum(
            1 for v in videos_bd
            if v.get("filename") and (VIDEOS_DIR / str(insp.id) / os.path.basename(v["filename"])).exists()
        )
        resultado.append({
            "inspeccion_id": insp.id,
            "cliente": insp.cliente_nombre,
            "matricula": insp.matricula,
            "fecha_inspeccion": insp.fecha_inspeccion.isoformat() if insp.fecha_inspeccion else None,
            "videos_en_bd": len(videos_bd),
            "videos_en_disco": en_disco,
            "videos_faltantes_disco": len(videos_bd) - en_disco,
        })

    return jsonify({
        "total_inspecciones_con_video": len(resultado),
        "inspecciones": resultado,
    }), 200
