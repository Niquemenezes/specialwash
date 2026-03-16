import os
from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt, jwt_required

ALLOWED_ROLES = {
    "administrador",
    "empleado",
    "encargado",
    "tecnico_comercial",
    "detailing",
    "calidad",
    "pintura",
}

# Roles operativos con mismos permisos base que "empleado".
WORKSHOP_ROLES = {"empleado", "detailing", "calidad", "pintura"}


def normalize_role(role):
    r = (role or "").lower().strip()
    if r in ("admin", "administrator"):
        return "administrador"
    if r in ("employee", "staff"):
        return "empleado"
    if r in ("manager", "responsable"):
        return "encargado"
    if r in ("quality",):
        return "calidad"
    if r in ("paint", "painter"):
        return "pintura"
    return r


def expand_allowed_roles(roles):
    normalized = {normalize_role(r) for r in roles}
    if "empleado" in normalized:
        normalized |= WORKSHOP_ROLES
    return normalized


def _dev_auth_bypass_enabled():
    raw = str(os.getenv("DEV_AUTH_BYPASS", "0")).strip().lower()
    is_enabled = raw in {"1", "true", "yes", "on"}
    is_production = str(os.getenv("FLASK_ENV", "development")).strip().lower() == "production"
    return is_enabled and not is_production


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        @jwt_required(optional=True)
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
