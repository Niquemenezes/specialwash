import os
import sys
from datetime import timedelta


def _require_env(key: str, default_dev: str) -> str:
    """
    En producción (FLASK_ENV=production) exige que la variable exista
    y no sea el valor por defecto de desarrollo. Falla en arranque si no.
    """
    value = os.getenv(key, "").strip()
    is_production = os.getenv("FLASK_ENV", "development").strip().lower() == "production"

    if is_production:
        if not value:
            print(f"[ERROR] Variable de entorno '{key}' no está definida en producción.", file=sys.stderr)
            sys.exit(1)
        if value == default_dev:
            print(f"[ERROR] '{key}' tiene el valor por defecto inseguro. Cámbialo antes de arrancar en producción.", file=sys.stderr)
            sys.exit(1)
        return value

    # Desarrollo: usa el valor de entorno si existe, si no el default
    return value or default_dev


class Config:
    # Claves: en producción DEBEN venir de variables de entorno reales
    SECRET_KEY = _require_env("SECRET_KEY", "dev_secret_key")
    JWT_SECRET_KEY = _require_env("JWT_SECRET_KEY", "jwt_secret_key")

    # Duración del token JWT (2 horas)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=2)

    # Base de datos
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(BASE_DIR, 'instance', 'specialwash.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # CORS - Lista separada por comas. En producción solo debe estar tu dominio real.
    # Ejemplo: FRONTEND_URLS=https://tudominio.com,https://www.tudominio.com
    # Fallback de seguridad para este despliegue: permite el dominio productivo
    # aunque FRONTEND_URLS no esté configurado todavía en el servidor.
    CORS_ORIGINS = (
        os.getenv("FRONTEND_URLS")
        or os.getenv(
            "FRONTEND_URL",
            "https://specialwash.studio,https://www.specialwash.studio,http://localhost:3000",
        )
    )

    # Subida de archivos - 20 MB máximo (suficiente para OCR de imágenes)
    MAX_CONTENT_LENGTH = 20 * 1024 * 1024  # 20 MB

    # OpenAI (asistente de redaccion premium de actas)
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    # WhatsApp Cloud API (notificaciones internas al administrador)
    # Configurar en producción vía variables de entorno del servidor.
    WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", "")
    WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    WHATSAPP_RECIPIENT = os.getenv("WHATSAPP_RECIPIENT", "34645811313")
    WHATSAPP_TEMPLATE_NAME = os.getenv("WHATSAPP_TEMPLATE_NAME", "nueva_inspeccion")
    WHATSAPP_TEMPLATE_LANG = os.getenv("WHATSAPP_TEMPLATE_LANG", "es")
