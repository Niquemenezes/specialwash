from flask import Blueprint, request, jsonify
from sqlalchemy import func

from models import db
from models.user import User
from models.uniforme import UniformeEmpleado, StockUniforme, PRENDAS
from models.base import now_madrid
from utils.auth_utils import role_required

uniformes_bp = Blueprint("uniformes", __name__)

ROLES_EMPLEADO = ("detailing", "calidad", "pintura", "tapicero", "empleado")


def _parse_cantidad(valor, default=1, minimo=0):
    """Convierte valor a int de forma segura. Retorna None si es invalido."""
    try:
        n = int(float(str(valor)))
        return n if n >= minimo else None
    except (TypeError, ValueError):
        return None


# ─── Empleados activos ────────────────────────────────────────────────────────

@uniformes_bp.route("/empleados", methods=["GET"])
@role_required("administrador")
def listar_empleados():
    empleados = (
        User.query
        .filter(User.activo == True, User.rol.in_(ROLES_EMPLEADO))
        .order_by(User.nombre)
        .all()
    )
    return jsonify([{"id": e.id, "nombre": e.nombre, "rol": e.rol} for e in empleados])


# ─── Stock ────────────────────────────────────────────────────────────────────

@uniformes_bp.route("/stock", methods=["GET"])
@role_required("administrador")
def listar_stock():
    stock = StockUniforme.query.order_by(StockUniforme.prenda, StockUniforme.talla).all()
    return jsonify([s.to_dict() for s in stock])


@uniformes_bp.route("/stock", methods=["PUT"])
@role_required("administrador")
def actualizar_stock():
    data = request.get_json() or {}
    prenda = (data.get("prenda") or "").strip().lower()
    talla = (data.get("talla") or "").strip().upper()
    cantidad = _parse_cantidad(data.get("cantidad"), minimo=0)

    if prenda not in PRENDAS:
        return jsonify({"msg": f"Prenda no valida. Opciones: {', '.join(PRENDAS)}"}), 400
    if not talla:
        return jsonify({"msg": "Talla requerida"}), 400
    if cantidad is None:
        return jsonify({"msg": "Cantidad debe ser un numero >= 0"}), 400

    registro = StockUniforme.query.filter_by(prenda=prenda, talla=talla).first()
    if registro:
        registro.cantidad = cantidad
        registro.updated_at = now_madrid()
    else:
        registro = StockUniforme(prenda=prenda, talla=talla, cantidad=cantidad)
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
    cantidad = _parse_cantidad(data.get("cantidad"), default=1, minimo=1)
    observaciones = (data.get("observaciones") or "").strip() or None

    if not user_id:
        return jsonify({"msg": "user_id requerido"}), 400
    if prenda not in PRENDAS:
        return jsonify({"msg": f"Prenda no valida. Opciones: {', '.join(PRENDAS)}"}), 400
    if not talla:
        return jsonify({"msg": "Talla requerida"}), 400
    if cantidad is None:
        return jsonify({"msg": "Cantidad debe ser un numero >= 1"}), 400

    empleado = User.query.get(user_id)
    if not empleado:
        return jsonify({"msg": "Empleado no encontrado"}), 404

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
    nueva_cantidad = _parse_cantidad(data.get("cantidad") or entrega.cantidad, minimo=1)
    nuevas_obs = (data.get("observaciones") or "").strip() or None

    if not nueva_talla:
        return jsonify({"msg": "Talla requerida"}), 400
    if nueva_cantidad is None:
        return jsonify({"msg": "Cantidad debe ser un numero >= 1"}), 400

    # Ajustar stock: devolver talla/cantidad anterior y descontar nueva
    talla_cambio = nueva_talla != entrega.talla
    cantidad_cambio = nueva_cantidad != entrega.cantidad

    if talla_cambio or cantidad_cambio:
        # Devolver stock de la entrega original
        stock_anterior = StockUniforme.query.filter_by(prenda=entrega.prenda, talla=entrega.talla).first()
        if stock_anterior:
            stock_anterior.cantidad += entrega.cantidad
            stock_anterior.updated_at = now_madrid()

        # Descontar stock de la nueva talla/cantidad
        stock_nuevo = StockUniforme.query.filter_by(prenda=entrega.prenda, talla=nueva_talla).first()
        if stock_nuevo:
            if stock_nuevo.cantidad < nueva_cantidad:
                # Revertir devolucion anterior
                if stock_anterior:
                    stock_anterior.cantidad -= entrega.cantidad
                return jsonify({"msg": f"Stock insuficiente para talla {nueva_talla}. Disponible: {stock_nuevo.cantidad}"}), 400
            stock_nuevo.cantidad -= nueva_cantidad
            stock_nuevo.updated_at = now_madrid()

    entrega.talla = nueva_talla
    entrega.cantidad = nueva_cantidad
    entrega.observaciones = nuevas_obs
    db.session.commit()
    return jsonify(entrega.to_dict())


@uniformes_bp.route("/entregas/<int:entrega_id>", methods=["DELETE"])
@role_required("administrador")
def eliminar_entrega(entrega_id):
    entrega = UniformeEmpleado.query.get_or_404(entrega_id)

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
    filas = (
        db.session.query(
            UniformeEmpleado.user_id,
            User.nombre,
            UniformeEmpleado.prenda,
            UniformeEmpleado.talla,
            func.sum(UniformeEmpleado.cantidad).label("total"),
        )
        .join(User, User.id == UniformeEmpleado.user_id)
        .group_by(UniformeEmpleado.user_id, User.nombre, UniformeEmpleado.prenda, UniformeEmpleado.talla)
        .all()
    )

    resultado = {}
    for fila in filas:
        nombre = fila.nombre or f"ID {fila.user_id}"
        if nombre not in resultado:
            resultado[nombre] = {"nombre": nombre, "user_id": fila.user_id, "prendas": {}}
        resultado[nombre]["prendas"][f"{fila.prenda}_{fila.talla}"] = {
            "prenda": fila.prenda,
            "talla": fila.talla,
            "total": fila.total,
        }

    return jsonify(list(resultado.values()))
