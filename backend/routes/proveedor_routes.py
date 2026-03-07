from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from models import Proveedor, db
from utils.auth_utils import role_required

proveedores_bp = Blueprint("proveedor_routes", __name__)


@proveedores_bp.route("/proveedores", methods=["GET"])
@jwt_required()
def proveedores_list():
    return jsonify([p.to_dict() for p in Proveedor.query.order_by(Proveedor.nombre).all()])


@proveedores_bp.route("/proveedores", methods=["POST"])
@role_required("administrador")
def proveedores_create():
    data = request.get_json() or {}
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return jsonify({"error": "El nombre es obligatorio"}), 400
    p = Proveedor(nombre=nombre)
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@proveedores_bp.route("/proveedores/<int:pid>", methods=["PUT"])
@role_required("administrador")
def proveedores_update(pid):
    p = Proveedor.query.get_or_404(pid)
    data = request.get_json() or {}

    p.nombre = data.get("nombre", p.nombre)
    p.telefono = data.get("telefono", p.telefono)
    p.email = data.get("email", p.email)
    p.direccion = data.get("direccion", p.direccion)
    p.contacto = data.get("contacto", p.contacto)
    p.notas = data.get("notas", p.notas)

    db.session.commit()
    return jsonify(p.to_dict()), 200


@proveedores_bp.route("/proveedores/<int:pid>", methods=["DELETE"])
@role_required("administrador")
def proveedores_delete(pid):
    p = Proveedor.query.get_or_404(pid)
    try:
        db.session.delete(p)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar: el proveedor tiene entradas asociadas"}), 400
    return jsonify({"msg": "Proveedor eliminado"}), 200
