from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash
from sqlalchemy import func, or_
import secrets
import string
import os
import time
from datetime import timedelta

_TOKEN_EXPIRES = {
    "administrador": timedelta(hours=8),
    "calidad": timedelta(hours=8),
    "salida": timedelta(days=30),
}

from models import User, db
from utils.auth_utils import ALLOWED_ROLES, normalize_role, role_required

auth_bp = Blueprint("auth_routes", __name__)


_LOGIN_FAIL_STATE = {}


def _env_int(name: str, default: int, minimum: int = 1) -> int:
    raw = str(os.getenv(name, default)).strip()
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = default
    return max(minimum, value)


LOGIN_MAX_ATTEMPTS = _env_int("LOGIN_MAX_ATTEMPTS", 5)
LOGIN_WINDOW_SECONDS = _env_int("LOGIN_WINDOW_SECONDS", 300)
LOGIN_BLOCK_SECONDS = _env_int("LOGIN_BLOCK_SECONDS", 900)


def _client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return (request.remote_addr or "unknown").strip()


def _login_rate_key(email: str) -> str:
    return f"{_client_ip()}|{(email or '').strip().lower()}"


def _prune_attempts(entry: dict, now_ts: float):
    cutoff = now_ts - LOGIN_WINDOW_SECONDS
    entry["failures"] = [ts for ts in entry.get("failures", []) if ts >= cutoff]


def _check_blocked(rate_key: str):
    now_ts = time.time()
    entry = _LOGIN_FAIL_STATE.get(rate_key) or {"failures": [], "blocked_until": 0}
    _prune_attempts(entry, now_ts)
    blocked_until = float(entry.get("blocked_until", 0) or 0)
    if blocked_until > now_ts:
        retry_after = int(blocked_until - now_ts) + 1
        return True, retry_after
    entry["blocked_until"] = 0
    _LOGIN_FAIL_STATE[rate_key] = entry
    return False, 0


def _register_login_failure(rate_key: str):
    now_ts = time.time()
    entry = _LOGIN_FAIL_STATE.get(rate_key) or {"failures": [], "blocked_until": 0}
    _prune_attempts(entry, now_ts)
    failures = entry.get("failures", [])
    failures.append(now_ts)
    entry["failures"] = failures
    if len(failures) >= LOGIN_MAX_ATTEMPTS:
        entry["blocked_until"] = now_ts + LOGIN_BLOCK_SECONDS
        entry["failures"] = []
    _LOGIN_FAIL_STATE[rate_key] = entry


def _clear_login_failures(rate_key: str):
    _LOGIN_FAIL_STATE.pop(rate_key, None)


@auth_bp.route("/signup", methods=["POST"])
@role_required("administrador")
def signup():
    data = request.get_json() or {}

    nombre = (data.get("nombre") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    rol = normalize_role(data.get("rol", "detailing"))

    if not nombre or not email or not password:
        return jsonify({"msg": "Faltan campos (nombre, email, password)"}), 400
    if len(password) < 6:
        return jsonify({"msg": "La contraseña debe tener al menos 6 caracteres"}), 400
    if rol not in ALLOWED_ROLES:
        return jsonify({"msg": "Rol inválido"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Email ya existe"}), 400

    user = User(
        nombre=nombre,
        email=email,
        rol=rol,
        password_hash=generate_password_hash(password),
        activo=True,
    )

    db.session.add(user)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al guardar el usuario"}), 500

    return jsonify({"user": user.to_dict()}), 201


@auth_bp.route("/auth/login_json", methods=["POST"])
def login_json():
    data = request.get_json() or {}

    identifier = (data.get("email") or data.get("identifier") or "").strip()
    lookup_value = identifier.lower()
    password = data.get("password") or ""
    rate_key = _login_rate_key(lookup_value)

    blocked, retry_after = _check_blocked(rate_key)
    if blocked:
        response = jsonify({"msg": "Demasiados intentos de login. Inténtalo más tarde."})
        response.status_code = 429
        response.headers["Retry-After"] = str(retry_after)
        return response

    if not lookup_value or not password:
        return jsonify({"msg": "Usuario/email y contraseña son obligatorios"}), 400

    user = User.query.filter(
        or_(
            func.lower(User.email) == lookup_value,
            func.lower(User.nombre) == lookup_value,
        )
    ).first()
    if not user or not user.password_hash or not check_password_hash(user.password_hash, password):
        _register_login_failure(rate_key)
        return jsonify({"msg": "Credenciales inválidas"}), 401

    if not getattr(user, "activo", True):
        _register_login_failure(rate_key)
        return jsonify({"msg": "Tu cuenta está desactivada. Contacta al administrador."}), 403

    _clear_login_failures(rate_key)
    expires = _TOKEN_EXPIRES.get(user.rol, timedelta(minutes=10))
    token = create_access_token(
        identity=str(user.id),
        additional_claims={"rol": user.rol, "email": user.email},
        expires_delta=expires,
    )

    return jsonify({"user": user.to_dict(), "token": token}), 200


@auth_bp.route("/auth/me", methods=["GET"])
@jwt_required()
def me():
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 401
    if not getattr(user, "activo", True):
        return jsonify({"msg": "Cuenta desactivada"}), 403
    return jsonify({"user": user.to_dict()}), 200


@auth_bp.route("/auth/logout", methods=["POST"])
def logout():
    # JWT stateless: el cliente elimina token localmente.
    return jsonify({"msg": "Logout correcto"}), 200


@auth_bp.route("/auth/reset-password", methods=["POST"])
@role_required("administrador")
def reset_password():
    """Admin genera una contraseña temporal para un usuario.
    Solo el administrador decide quién accede con qué contraseña.
    
    Body:
    {
        "user_id": <int>
    }
    
    Response: {"user": {...}, "temporal_password": "xyz123ABC", "msg": "..."}
    """
    data = request.get_json() or {}
    
    user_id = data.get("user_id")
    
    if not user_id:
        return jsonify({"msg": "user_id es requerido"}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 404
    
    # Generar contraseña temporal usando fuente criptográfica segura.
    alphabet = string.ascii_uppercase + string.digits
    temporal_password = "".join(secrets.choice(alphabet) for _ in range(10))
    
    user.password_hash = generate_password_hash(temporal_password)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al actualizar la contraseña"}), 500

    return jsonify({
        "msg": f"Contraseña generada para {user.nombre}. Comparte esta contraseña con el usuario.",
        "user": user.to_dict(),
        "temporal_password": temporal_password
    }), 200
