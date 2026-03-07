from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from models import Producto, db
from utils.auth_utils import role_required

productos_bp = Blueprint("producto_routes", __name__)


@productos_bp.route("/productos", methods=["GET"])
@jwt_required()
def productos_list():
    q = (request.args.get("q") or "").strip().lower()
    query = Producto.query
    if q:
        query = query.filter(Producto.nombre.ilike(f"%{q}%"))
    return jsonify([p.to_dict() for p in query.order_by(Producto.nombre).all()])


@productos_bp.route("/productos", methods=["POST"])
@role_required("administrador")
def productos_create():
    data = request.get_json() or {}
    p = Producto(
        nombre=data.get("nombre"),
        categoria=data.get("categoria"),
        stock_minimo=int(data.get("stock_minimo", 0)),
        stock_actual=int(data.get("stock_actual", 0)),
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@productos_bp.route("/productos/<int:pid>", methods=["PUT"])
@role_required("administrador")
def productos_update(pid):
    p = Producto.query.get_or_404(pid)
    data = request.get_json() or {}

    p.nombre = data.get("nombre", p.nombre)
    p.categoria = data.get("categoria", p.categoria)
    p.stock_minimo = int(data.get("stock_minimo", p.stock_minimo))
    p.stock_actual = int(data.get("stock_actual", p.stock_actual))

    db.session.commit()
    return jsonify(p.to_dict()), 200


@productos_bp.route("/productos/<int:pid>", methods=["DELETE"])
@role_required("administrador")
def productos_delete(pid):
    p = Producto.query.get_or_404(pid)
    try:
        db.session.delete(p)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar: el producto tiene entradas o salidas asociadas"}), 400
    return jsonify({"msg": "Producto eliminado"}), 200
