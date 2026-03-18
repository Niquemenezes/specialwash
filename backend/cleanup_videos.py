"""
cleanup_videos.py — Limpieza automática de videos y fotos locales de inspección caducados.

Borra del disco y de la BD los videos/fotos locales con expires_at < ahora (60 días).
Las fotos en Cloudinary las borra el propio Cloudinary via expires_at en el upload.

Uso manual:
    /root/specialwash/backend/venv/bin/python /root/specialwash/backend/cleanup_videos.py

Cron diario (4 AM UTC):
    0 4 * * * /root/specialwash/backend/venv/bin/python /root/specialwash/backend/cleanup_videos.py >> /root/specialwash/backend/cleanup_videos.log 2>&1
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(os.path.abspath(os.path.dirname(__file__)))
VIDEOS_DIR = BASE_DIR / "media" / "videos"
FOTOS_DIR = BASE_DIR / "media" / "fotos"

sys.path.insert(0, str(BASE_DIR))


def _cleanup_expired_files(inspeccion_id, entries, media_dir, entry_key="filename"):
    """
    Dado un dict {entry_key: nombre_archivo, expires_at: iso}, borra del disco
    los que han caducado. Devuelve (entradas_validas, borrados, errores).
    """
    now = datetime.now(timezone.utc)
    valid = []
    borrados = 0
    errores = 0
    for entry in entries:
        expires_raw = entry.get("expires_at")
        filename = entry.get(entry_key)
        # Sin filename local → es Cloudinary o legado sin archivo, conservar
        if not filename or not expires_raw:
            valid.append(entry)
            continue
        try:
            expires_at = datetime.fromisoformat(expires_raw)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
        except ValueError:
            valid.append(entry)
            continue
        if expires_at > now:
            valid.append(entry)
            continue
        # Caducado → borrar del disco
        safe_name = os.path.basename(filename)
        path = media_dir / str(inspeccion_id) / safe_name
        try:
            if path.exists():
                path.unlink()
                print(f"[OK]   Borrado: {path}")
                borrados += 1
            else:
                print(f"[WARN] No hallado en disco: {path}")
        except OSError as e:
            print(f"[ERR]  No se pudo borrar {path}: {e}")
            errores += 1
            valid.append(entry)  # conservar en BD si falla el borrado
    return valid, borrados, errores


def cleanup_expired_videos():
    os.environ.setdefault("ENABLE_DB_BOOTSTRAP", "0")

    from app import create_app
    from extensions import db  # noqa: E402
    from models.inspeccion_recepcion import InspeccionRecepcion

    app = create_app()

    with app.app_context():
        now = datetime.now(timezone.utc)
        inspecciones = InspeccionRecepcion.query.all()

        total_borrados = 0
        total_errores = 0

        for inspeccion in inspecciones:
            # --- Limpiar videos locales ---
            try:
                videos = json.loads(inspeccion.videos_cloudinary or "[]")
            except (ValueError, TypeError):
                videos = []
            videos_validos, borrados_v, errores_v = _cleanup_expired_files(
                inspeccion.id, videos, VIDEOS_DIR
            )
            if len(videos_validos) != len(videos):
                inspeccion.videos_cloudinary = json.dumps(videos_validos)
            total_borrados += borrados_v
            total_errores += errores_v

            # --- Limpiar fotos locales (fallback IONOS cuando Cloudinary no está configurado) ---
            # Las fotos en Cloudinary las borra el propio Cloudinary via expires_at.
            try:
                fotos = json.loads(inspeccion.fotos_cloudinary or "[]")
            except (ValueError, TypeError):
                fotos = []
            fotos_validas, borrados_f, errores_f = _cleanup_expired_files(
                inspeccion.id, fotos, FOTOS_DIR
            )
            if len(fotos_validas) != len(fotos):
                inspeccion.fotos_cloudinary = json.dumps(fotos_validas)
            total_borrados += borrados_f
            total_errores += errores_f

        db.session.commit()
        print(
            f"[DONE] {now.strftime('%Y-%m-%d %H:%M:%S UTC')} — "
            f"Borrados: {total_borrados}, Errores: {total_errores}"
        )


if __name__ == "__main__":
    cleanup_expired_videos()
