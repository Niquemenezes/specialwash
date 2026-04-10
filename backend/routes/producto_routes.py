from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import or_
from datetime import datetime

from models import Producto, ProductoCodigoBarras, db
from utils.auth_utils import role_required

productos_bp = Blueprint("producto_routes", __name__)


def _normalizar_codigos(raw_codigos):
    codigos = []
    if not isinstance(raw_codigos, list):
        return codigos

    for item in raw_codigos:
        if isinstance(item, str):
            codigo = item.strip()
            if codigo:
                codigos.append({"codigo_barras": codigo, "marca": None})
        elif isinstance(item, dict):
            codigo = str(item.get("codigo_barras") or "").strip()
            marca = str(item.get("marca") or "").strip() or None
            if codigo:
                codigos.append({"codigo_barras": codigo, "marca": marca})

    unique = []
    seen = set()
    for item in codigos:
        key = item["codigo_barras"]
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def _codigo_esta_ocupado(codigo, producto_id=None):
    legacy_query = Producto.query.filter(Producto.codigo_barras == codigo)
    if producto_id:
        legacy_query = legacy_query.filter(Producto.id != producto_id)
    if legacy_query.first():
        return True

    multi_query = ProductoCodigoBarras.query.filter(ProductoCodigoBarras.codigo_barras == codigo)
    if producto_id:
        multi_query = multi_query.filter(ProductoCodigoBarras.producto_id != producto_id)
    return multi_query.first() is not None


def _parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on", "si", "sí"}


def _parse_int_or_none(value):
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _parse_datetime_or_none(value):
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


@productos_bp.route("/productos", methods=["GET"])
@jwt_required()
def productos_list():
    q = (request.args.get("q") or "").strip().lower()
    query = Producto.query
    if q:
        query = query.filter(
            or_(
                Producto.nombre.ilike(f"%{q}%"),
                Producto.categoria.ilike(f"%{q}%"),
                Producto.codigo_barras.ilike(f"%{q}%"),
                Producto.id.in_(
                    db.session.query(ProductoCodigoBarras.producto_id).filter(
                        ProductoCodigoBarras.codigo_barras.ilike(f"%{q}%")
                    )
                ),
            )
        )
    return jsonify([p.to_dict() for p in query.order_by(Producto.nombre).all()])


@productos_bp.route("/productos/barcode/<string:codigo>", methods=["GET"])
@jwt_required()
def producto_por_codigo_barras(codigo):
    codigo = (codigo or "").strip()
    if not codigo:
        return jsonify({"msg": "Codigo de barras invalido"}), 400

    producto = Producto.query.filter_by(codigo_barras=codigo).first()
    if not producto:
        item = ProductoCodigoBarras.query.filter_by(codigo_barras=codigo).first()
        if item:
            producto = Producto.query.get(item.producto_id)
    if not producto:
        return jsonify({"msg": "Producto no encontrado para ese codigo de barras"}), 404

    return jsonify(producto.to_dict()), 200


@productos_bp.route("/productos", methods=["POST"])
@role_required("administrador")
def productos_create():
    data = request.get_json() or {}
    codigo_barras = (data.get("codigo_barras") or "").strip() or None
    codigos_barras = _normalizar_codigos(data.get("codigos_barras"))

    if codigo_barras and _codigo_esta_ocupado(codigo_barras):
        return jsonify({"msg": "Ya existe un producto con ese codigo de barras"}), 400

    for item in codigos_barras:
        if _codigo_esta_ocupado(item["codigo_barras"]):
            return jsonify({"msg": "Ya existe un producto con ese codigo de barras"}), 400

    p = Producto(
        nombre=data.get("nombre"),
        categoria=data.get("categoria"),
        codigo_barras=codigo_barras,
        stock_minimo=int(data.get("stock_minimo", 0)),
        stock_actual=int(data.get("stock_actual", 0)),
        pedido_en_curso=_parse_bool(data.get("pedido_en_curso"), default=False),
        pedido_fecha=_parse_datetime_or_none(data.get("pedido_fecha")),
        pedido_cantidad=_parse_int_or_none(data.get("pedido_cantidad")),
        pedido_canal=(str(data.get("pedido_canal") or "").strip() or None),
        pedido_proveedor_id=_parse_int_or_none(data.get("pedido_proveedor_id")),
    )
    db.session.add(p)
    db.session.flush()

    for item in codigos_barras:
        if codigo_barras and item["codigo_barras"] == codigo_barras:
            continue
        db.session.add(
            ProductoCodigoBarras(
                producto_id=p.id,
                codigo_barras=item["codigo_barras"],
                marca=item.get("marca"),
            )
        )

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al guardar en base de datos"}), 500
    return jsonify(p.to_dict()), 201


@productos_bp.route("/productos/<int:pid>", methods=["PUT"])
@role_required("administrador")
def productos_update(pid):
    p = Producto.query.get_or_404(pid)
    data = request.get_json() or {}

    codigos_barras = _normalizar_codigos(data.get("codigos_barras")) if "codigos_barras" in data else None

    if "codigo_barras" in data:
        nuevo_codigo = (data.get("codigo_barras") or "").strip() or None
        if nuevo_codigo and _codigo_esta_ocupado(nuevo_codigo, producto_id=p.id):
            return jsonify({"msg": "Ya existe un producto con ese codigo de barras"}), 400
        p.codigo_barras = nuevo_codigo

    if codigos_barras is not None:
        for item in codigos_barras:
            if _codigo_esta_ocupado(item["codigo_barras"], producto_id=p.id):
                return jsonify({"msg": "Ya existe un producto con ese codigo de barras"}), 400

        ProductoCodigoBarras.query.filter_by(producto_id=p.id).delete()
        for item in codigos_barras:
            if p.codigo_barras and item["codigo_barras"] == p.codigo_barras:
                continue
            db.session.add(
                ProductoCodigoBarras(
                    producto_id=p.id,
                    codigo_barras=item["codigo_barras"],
                    marca=item.get("marca"),
                )
            )

    p.nombre = data.get("nombre", p.nombre)
    p.categoria = data.get("categoria", p.categoria)
    p.stock_minimo = int(data.get("stock_minimo", p.stock_minimo))
    p.stock_actual = int(data.get("stock_actual", p.stock_actual))

    if "pedido_en_curso" in data:
        p.pedido_en_curso = _parse_bool(data.get("pedido_en_curso"), default=False)
    if "pedido_fecha" in data:
        p.pedido_fecha = _parse_datetime_or_none(data.get("pedido_fecha"))
    if "pedido_cantidad" in data:
        p.pedido_cantidad = _parse_int_or_none(data.get("pedido_cantidad"))
    if "pedido_canal" in data:
        p.pedido_canal = (str(data.get("pedido_canal") or "").strip() or None)
    if "pedido_proveedor_id" in data:
        p.pedido_proveedor_id = _parse_int_or_none(data.get("pedido_proveedor_id"))

    # Si se marca como no pedido, limpiamos metadatos para evitar estados incoherentes.
    if not p.pedido_en_curso:
        p.pedido_fecha = None
        p.pedido_cantidad = None
        p.pedido_canal = None
        p.pedido_proveedor_id = None

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al guardar en base de datos"}), 500
    return jsonify(p.to_dict()), 200


@productos_bp.route("/productos/<int:pid>/codigos-barras", methods=["GET"])
@jwt_required()
def producto_codigos_list(pid):
    p = Producto.query.get_or_404(pid)
    return jsonify(p.to_dict().get("codigos_barras", [])), 200


@productos_bp.route("/productos/<int:pid>/codigos-barras", methods=["POST"])
@role_required("administrador")
def producto_codigo_create(pid):
    p = Producto.query.get_or_404(pid)
    data = request.get_json() or {}
    codigo = str(data.get("codigo_barras") or "").strip()
    marca = str(data.get("marca") or "").strip() or None

    if not codigo:
        return jsonify({"msg": "Codigo de barras requerido"}), 400
    if _codigo_esta_ocupado(codigo, producto_id=p.id):
        return jsonify({"msg": "Ya existe un producto con ese codigo de barras"}), 400

    item = ProductoCodigoBarras(producto_id=p.id, codigo_barras=codigo, marca=marca)
    db.session.add(item)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al guardar en base de datos"}), 500
    return jsonify(item.to_dict()), 201


@productos_bp.route("/productos/<int:pid>/codigos-barras/<int:cid>", methods=["DELETE"])
@role_required("administrador")
def producto_codigo_delete(pid, cid):
    p = Producto.query.get_or_404(pid)
    item = ProductoCodigoBarras.query.filter_by(id=cid, producto_id=p.id).first_or_404()
    db.session.delete(item)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al guardar en base de datos"}), 500
    return jsonify({"msg": "Codigo de barras eliminado"}), 200


@productos_bp.route("/productos/<int:pid>", methods=["DELETE"])
@role_required("administrador")
def productos_delete(pid):
    p = Producto.query.get_or_404(pid)
    try:
        db.session.delete(p)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "No se puede eliminar: el producto tiene entradas o salidas asociadas"}), 400
    return jsonify({"msg": "Producto eliminado"}), 200
