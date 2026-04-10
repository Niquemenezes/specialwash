import os
import sys
from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt, jwt_required

# Advertencia en arranque si el bypass de autenticación está activo.
# Esto nunca debe verse en producción.
if str(os.getenv("DEV_AUTH_BYPASS", "0")).strip().lower() in {"1", "true", "yes", "on"}:
    if str(os.getenv("FLASK_ENV", "development")).strip().lower() != "production":
        print(
            "\n[ADVERTENCIA] DEV_AUTH_BYPASS está ACTIVO. "
            "La autenticación de roles puede ser ignorada. "
            "NUNCA activar en producción.\n",
            file=sys.stderr,
        )

ALLOWED_ROLES = {
    "administrador",
    "encargado",
    "detailing",
    "calidad",
    "pintura",
    "tapicero",
}

# Roles operativos del taller.
WORKSHOP_ROLES = {"detailing", "calidad", "pintura", "tapicero"}


def normalize_role(role):
    raw = (role or "").lower().strip()
    if not raw:
        return ""

    r = (
        raw.replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
    )

    if r in ("admin", "administrator"):
        return "administrador"
    if r in ("employee", "staff", "empleado"):
        return "detailing"
    if r in ("quality",) or "calidad" in r:
        return "calidad"
    if r in ("paint", "painter") or "pintur" in r or "pintor" in r:
        return "pintura"
    if r in ("tapiceria", "upholstery", "upholsterer") or "tapicer" in r:
        return "tapicero"
    if r in ("manager", "supervisor", "responsable") or "encarg" in r:
        return "encargado"
    if "detail" in r or "lavado" in r:
        return "detailing"
    if r in ("other", "otro"):
        return "otro"
    return r


def expand_allowed_roles(roles):
    normalized = {normalize_role(r) for r in roles}
    return normalized


def _dev_auth_bypass_enabled():
    raw = str(os.getenv("DEV_AUTH_BYPASS", "0")).strip().lower()
    is_enabled = raw in {"1", "true", "yes", "on"}
    is_production = str(os.getenv("FLASK_ENV", "development")).strip().lower() == "production"
    return is_enabled and not is_production


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt() or {}
            rol = normalize_role(claims.get("rol"))
            if _dev_auth_bypass_enabled() and not rol:
                rol = "administrador"
            allowed = expand_allowed_roles(roles)
            if rol not in allowed:
                return jsonify({"msg": "Acceso denegado"}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator
