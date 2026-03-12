from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash

from models import User, db
from utils.auth_utils import ALLOWED_ROLES, normalize_role, role_required

auth_bp = Blueprint("auth_routes", __name__)


@auth_bp.route("/signup", methods=["POST"])
@role_required("administrador")
def signup():
    data = request.get_json() or {}

    nombre = (data.get("nombre") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    rol = normalize_role(data.get("rol", "empleado"))

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
    db.session.commit()

    return jsonify({"user": user.to_dict()}), 201


@auth_bp.route("/auth/login_json", methods=["POST"])
def login_json():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"msg": "Email y contraseña son obligatorios"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.password_hash or not check_password_hash(user.password_hash, password):
        return jsonify({"msg": "Credenciales inválidas"}), 401

    if not getattr(user, "activo", True):
        return jsonify({"msg": "Tu cuenta está desactivada. Contacta al administrador."}), 403

    token = create_access_token(
        identity=str(user.id),
        additional_claims={"rol": user.rol, "email": user.email},
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
    
    # Generar contraseña temporal automática
    import string
    import random
    temporal_password = ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
    
    user.password_hash = generate_password_hash(temporal_password)
    db.session.commit()
    
    return jsonify({
        "msg": f"Contraseña generada para {user.nombre}. Comparte esta contraseña con el usuario.",
        "user": user.to_dict(),
        "temporal_password": temporal_password
    }), 200
