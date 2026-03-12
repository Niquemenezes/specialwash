from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt, jwt_required

ALLOWED_ROLES = {"administrador", "empleado", "encargado", "tecnico_comercial"}


def normalize_role(role):
    r = (role or "").lower().strip()
    if r in ("admin", "administrator"):
        return "administrador"
    if r in ("employee", "staff"):
        return "empleado"
    if r in ("manager", "responsable"):
        return "encargado"
    return r


def role_required(*roles):
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt() or {}
            rol = normalize_role(claims.get("rol"))
            allowed = {normalize_role(r) for r in roles}
            if rol not in allowed:
                return jsonify({"msg": "Acceso denegado"}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator
