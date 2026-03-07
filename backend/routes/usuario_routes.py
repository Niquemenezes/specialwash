from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash

from models import User, db
from utils.auth_utils import ALLOWED_ROLES, normalize_role, role_required

usuarios_bp = Blueprint("usuario_routes", __name__)


@usuarios_bp.route("/usuarios", methods=["GET"])
@role_required("administrador")
def usuarios_list():
    return jsonify([u.to_dict() for u in User.query.order_by(User.id.desc()).all()])


@usuarios_bp.route("/usuarios", methods=["POST"])
@role_required("administrador")
def usuarios_create():
    data = request.get_json() or {}

    nombre = (data.get("nombre") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    rol = normalize_role(data.get("rol", "empleado"))

    if not nombre or not email or not password:
        return jsonify({"msg": "Faltan campos obligatorios (nombre, email, password)"}), 400
    if len(password) < 6:
        return jsonify({"msg": "La contraseña debe tener al menos 6 caracteres"}), 400
    if rol not in ALLOWED_ROLES:
        return jsonify({"msg": "Rol inválido"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Ya existe un usuario con ese email"}), 400

    user = User(
        nombre=nombre,
        email=email,
        rol=rol,
        activo=True,
        password_hash=generate_password_hash(password),
    )

    db.session.add(user)
    db.session.commit()

    return jsonify(user.to_dict()), 201


@usuarios_bp.route("/usuarios/<int:uid>", methods=["PUT"])
@role_required("administrador")
def usuarios_update(uid):
    u = User.query.get_or_404(uid)
    data = request.get_json() or {}

    u.nombre = data.get("nombre", u.nombre)
    u.email = (data.get("email") or u.email).lower()

    if data.get("password"):
        u.password_hash = generate_password_hash(data["password"])

    u.rol = normalize_role(data.get("rol", u.rol))

    db.session.commit()
    return jsonify(u.to_dict()), 200


@usuarios_bp.route("/usuarios/<int:uid>", methods=["DELETE"])
@role_required("administrador")
def usuarios_delete(uid):
    u = User.query.get_or_404(uid)
    try:
        db.session.delete(u)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar: el usuario tiene registros asociados"}), 400
    return jsonify({"msg": "Usuario eliminado"}), 200
