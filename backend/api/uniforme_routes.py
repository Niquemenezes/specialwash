from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from models import db
from models.user import User
from models.uniforme import UniformeEmpleado, StockUniforme, PRENDAS, TALLAS
from models.base import now_madrid
from utils.auth_utils import role_required

uniformes_bp = Blueprint("uniformes", __name__)


# ─── Empleados activos ────────────────────────────────────────────────────────

ROLES_EMPLEADO = ("detailing", "calidad", "pintura", "tapicero", "empleado")

@uniformes_bp.route("/empleados", methods=["GET"])
@role_required("administrador")
def listar_empleados():
    empleados = (
        User.query
        .filter(User.activo == True, User.rol.in_(ROLES_EMPLEADO))
        .order_by(User.nombre)
        .all()
    )
    return jsonify([e.to_dict() for e in empleados])


# ─── Stock ────────────────────────────────────────────────────────────────────

@uniformes_bp.route("/stock", methods=["GET"])
@role_required("administrador")
def listar_stock():
    stock = StockUniforme.query.order_by(StockUniforme.prenda, StockUniforme.talla).all()
    return jsonify([s.to_dict() for s in stock])


@uniformes_bp.route("/stock", methods=["PUT"])
@role_required("administrador")
def actualizar_stock():
    """Actualiza o crea el stock de una prenda+talla."""
    data = request.get_json() or {}
    prenda = (data.get("prenda") or "").strip().lower()
    talla = (data.get("talla") or "").strip().upper()
    cantidad = data.get("cantidad")

    if prenda not in PRENDAS:
        return jsonify({"msg": f"Prenda no valida. Opciones: {', '.join(PRENDAS)}"}), 400
    if talla not in TALLAS:
        return jsonify({"msg": f"Talla no valida."}), 400
    if cantidad is None or int(cantidad) < 0:
        return jsonify({"msg": "Cantidad debe ser >= 0"}), 400

    registro = StockUniforme.query.filter_by(prenda=prenda, talla=talla).first()
    if registro:
        registro.cantidad = int(cantidad)
        registro.updated_at = now_madrid()
    else:
        registro = StockUniforme(prenda=prenda, talla=talla, cantidad=int(cantidad))
        db.session.add(registro)

    db.session.commit()
    return jsonify(registro.to_dict())


# ─── Entregas ─────────────────────────────────────────────────────────────────

@uniformes_bp.route("/entregas", methods=["GET"])
@role_required("administrador")
def listar_entregas():
    user_id = request.args.get("user_id", type=int)
    prenda = request.args.get("prenda", "").strip().lower()

    q = UniformeEmpleado.query
    if user_id:
        q = q.filter_by(user_id=user_id)
    if prenda and prenda in PRENDAS:
        q = q.filter_by(prenda=prenda)

    entregas = q.order_by(UniformeEmpleado.fecha_entrega.desc()).all()
    return jsonify([e.to_dict() for e in entregas])


@uniformes_bp.route("/entregas", methods=["POST"])
@role_required("administrador")
def registrar_entrega():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    prenda = (data.get("prenda") or "").strip().lower()
    talla = (data.get("talla") or "").strip().upper()
    cantidad = int(data.get("cantidad") or 1)
    observaciones = (data.get("observaciones") or "").strip() or None

    if not user_id:
        return jsonify({"msg": "user_id requerido"}), 400
    if prenda not in PRENDAS:
        return jsonify({"msg": f"Prenda no valida. Opciones: {', '.join(PRENDAS)}"}), 400
    if talla not in TALLAS:
        return jsonify({"msg": "Talla no valida"}), 400
    if cantidad < 1:
        return jsonify({"msg": "Cantidad debe ser >= 1"}), 400

    empleado = User.query.get(user_id)
    if not empleado:
        return jsonify({"msg": "Empleado no encontrado"}), 404

    # Descontar del stock si hay registro
    stock = StockUniforme.query.filter_by(prenda=prenda, talla=talla).first()
    if stock:
        nuevo_stock = stock.cantidad - cantidad
        if nuevo_stock < 0:
            return jsonify({"msg": f"Stock insuficiente. Disponible: {stock.cantidad}"}), 400
        stock.cantidad = nuevo_stock
        stock.updated_at = now_madrid()

    entrega = UniformeEmpleado(
        user_id=user_id,
        prenda=prenda,
        talla=talla,
        cantidad=cantidad,
        observaciones=observaciones,
    )
    db.session.add(entrega)
    db.session.commit()
    return jsonify(entrega.to_dict()), 201


@uniformes_bp.route("/entregas/<int:entrega_id>", methods=["PATCH"])
@role_required("administrador")
def editar_entrega(entrega_id):
    entrega = UniformeEmpleado.query.get_or_404(entrega_id)
    data = request.get_json() or {}

    nueva_talla = (data.get("talla") or entrega.talla).strip().upper()
    nueva_cantidad = int(data.get("cantidad") or entrega.cantidad)
    nuevas_obs = (data.get("observaciones") or "").strip() or None

    if nueva_talla not in TALLAS:
        return jsonify({"msg": "Talla no valida"}), 400
    if nueva_cantidad < 1:
        return jsonify({"msg": "Cantidad debe ser >= 1"}), 400

    # Ajustar stock si cambia la cantidad
    diferencia = nueva_cantidad - entrega.cantidad
    if diferencia != 0:
        stock = StockUniforme.query.filter_by(prenda=entrega.prenda, talla=nueva_talla).first()
        if stock:
            nuevo_stock = stock.cantidad - diferencia
            if nuevo_stock < 0:
                return jsonify({"msg": f"Stock insuficiente. Disponible: {stock.cantidad}"}), 400
            stock.cantidad = nuevo_stock
            stock.updated_at = now_madrid()

    entrega.talla = nueva_talla
    entrega.cantidad = nueva_cantidad
    entrega.observaciones = nuevas_obs
    db.session.commit()
    return jsonify(entrega.to_dict())


@uniformes_bp.route("/entregas/<int:entrega_id>", methods=["DELETE"])
@role_required("administrador")
def eliminar_entrega(entrega_id):
    entrega = UniformeEmpleado.query.get_or_404(entrega_id)

    # Devolver al stock
    stock = StockUniforme.query.filter_by(prenda=entrega.prenda, talla=entrega.talla).first()
    if stock:
        stock.cantidad += entrega.cantidad
        stock.updated_at = now_madrid()

    db.session.delete(entrega)
    db.session.commit()
    return jsonify({"msg": "Entrega eliminada"})


# ─── Resumen por empleado ─────────────────────────────────────────────────────

@uniformes_bp.route("/resumen", methods=["GET"])
@role_required("administrador")
def resumen_por_empleado():
    """Devuelve cuantas prendas tiene cada empleado agrupadas."""
    from sqlalchemy import func

    filas = (
        db.session.query(
            UniformeEmpleado.user_id,
            UniformeEmpleado.prenda,
            UniformeEmpleado.talla,
            func.sum(UniformeEmpleado.cantidad).label("total"),
        )
        .group_by(UniformeEmpleado.user_id, UniformeEmpleado.prenda, UniformeEmpleado.talla)
        .all()
    )

    empleados = {u.id: u.nombre for u in User.query.all()}
    resultado = {}
    for fila in filas:
        nombre = empleados.get(fila.user_id, f"ID {fila.user_id}")
        if nombre not in resultado:
            resultado[nombre] = {"nombre": nombre, "user_id": fila.user_id, "prendas": {}}
        resultado[nombre]["prendas"][f"{fila.prenda}_{fila.talla}"] = {
            "prenda": fila.prenda,
            "talla": fila.talla,
            "total": fila.total,
        }

    return jsonify(list(resultado.values()))
