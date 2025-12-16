from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from sqlalchemy import func, desc
from datetime import datetime

from models import db, User, Producto, Proveedor, Entrada, Salida, Maquinaria

api = Blueprint("api", __name__)

# =====================================================
# HELPERS
# =====================================================

_ALLOWED_ROLES = {"administrador", "empleado", "encargado"}


def _normalize_role(role):
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
            rol = _normalize_role(claims.get("rol"))
            allowed = {_normalize_role(r) for r in roles}
            if rol not in allowed:
                return jsonify({"msg": "Acceso denegado"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# =====================================================
# AUTH
# =====================================================

@api.route("/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}

    nombre = (data.get("nombre") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    rol = _normalize_role(data.get("rol", "empleado"))

    if not nombre or not email or not password:
        return jsonify({"msg": "Faltan campos"}), 400
    if rol not in _ALLOWED_ROLES:
        return jsonify({"msg": "Rol inválido"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Email ya existe"}), 400

    user = User(
        nombre=nombre,
        email=email,
        rol=rol,
        password_hash=generate_password_hash(password),
        activo=True
    )

    db.session.add(user)
    db.session.commit()

    token = create_access_token(
        identity=str(user.id),
        additional_claims={"rol": user.rol, "email": user.email}
    )

    return jsonify({"user": user.to_dict(), "token": token}), 201


@api.route("/auth/login_json", methods=["POST"])
def login_json():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password")

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"msg": "Credenciales inválidas"}), 401

    token = create_access_token(
        identity=str(user.id),
        additional_claims={"rol": user.rol, "email": user.email}
    )

    return jsonify({"user": user.to_dict(), "token": token}), 200


@api.route("/auth/me", methods=["GET"])
@jwt_required()
def me():
    uid = int(get_jwt_identity())
    user = User.query.get(uid)
    return jsonify({"user": user.to_dict() if user else None}), 200


# =====================================================
# USUARIOS (ADMIN)
# =====================================================

@api.route("/usuarios", methods=["GET"])
@role_required("administrador")
def usuarios_list():
    return jsonify([u.to_dict() for u in User.query.order_by(User.id.desc()).all()])


@api.route("/usuarios", methods=["POST"])
@role_required("administrador")
def usuarios_create():
    data = request.get_json() or {}

    user = User(
        nombre=data.get("nombre"),
        email=(data.get("email") or "").lower(),
        rol=_normalize_role(data.get("rol", "empleado")),
        activo=True,
        password_hash=generate_password_hash(data.get("password"))
    )

    db.session.add(user)
    db.session.commit()

    return jsonify(user.to_dict()), 201


@api.route("/usuarios/<int:uid>", methods=["PUT"])
@role_required("administrador")
def usuarios_update(uid):
    u = User.query.get_or_404(uid)
    data = request.get_json() or {}

    u.nombre = data.get("nombre", u.nombre)
    u.email = (data.get("email") or u.email).lower()

    if data.get("password"):
        u.password_hash = generate_password_hash(data["password"])

    u.rol = _normalize_role(data.get("rol", u.rol))

    db.session.commit()
    return jsonify(u.to_dict()), 200


@api.route("/usuarios/<int:uid>", methods=["DELETE"])
@role_required("administrador")
def usuarios_delete(uid):
    u = User.query.get_or_404(uid)
    db.session.delete(u)
    db.session.commit()
    return jsonify({"msg": "Usuario eliminado"}), 200


# =====================================================
# PROVEEDORES
# =====================================================

@api.route("/proveedores", methods=["GET"])
@jwt_required()
def proveedores_list():
    return jsonify([p.to_dict() for p in Proveedor.query.order_by(Proveedor.nombre).all()])


@api.route("/proveedores", methods=["POST"])
@role_required("administrador")
def proveedores_create():
    data = request.get_json() or {}
    p = Proveedor(nombre=data.get("nombre"))
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@api.route("/proveedores/<int:pid>", methods=["PUT"])
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


@api.route("/proveedores/<int:pid>", methods=["DELETE"])
@role_required("administrador")
def proveedores_delete(pid):
    p = Proveedor.query.get_or_404(pid)
    db.session.delete(p)
    db.session.commit()
    return jsonify({"msg": "Proveedor eliminado"}), 200


# =====================================================
# PRODUCTOS
# =====================================================

@api.route("/productos", methods=["GET"])
@jwt_required()
def productos_list():
    q = (request.args.get("q") or "").strip().lower()
    query = Producto.query
    if q:
        query = query.filter(Producto.nombre.ilike(f"%{q}%"))
    return jsonify([p.to_dict() for p in query.order_by(Producto.nombre).all()])


@api.route("/productos", methods=["POST"])
@role_required("administrador")
def productos_create():
    data = request.get_json() or {}
    p = Producto(
        nombre=data.get("nombre"),
        categoria=data.get("categoria"),
        stock_minimo=int(data.get("stock_minimo", 0)),
        stock_actual=int(data.get("stock_actual", 0))
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@api.route("/productos/<int:pid>", methods=["PUT"])
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


@api.route("/productos/<int:pid>", methods=["DELETE"])
@role_required("administrador")
def productos_delete(pid):
    p = Producto.query.get_or_404(pid)
    db.session.delete(p)
    db.session.commit()
    return jsonify({"msg": "Producto eliminado"}), 200


# =====================================================
# ENTRADAS
# =====================================================

@api.route("/registro-entrada", methods=["POST"])
@role_required("administrador")
def registrar_entrada():
    data = request.get_json() or {}

    producto_id = data.get("producto_id")
    cantidad = int(data.get("cantidad", 0))

    if not producto_id or cantidad <= 0:
        return jsonify({"msg": "Datos inválidos"}), 400

    producto = Producto.query.get_or_404(producto_id)
    producto.stock_actual += cantidad

    # Calcular precio unitario = precio_sin_iva / cantidad
    precio_sin_iva = float(data.get("precio_sin_iva") or 0)
    if precio_sin_iva > 0 and cantidad > 0:
        precio_unitario = precio_sin_iva / cantidad
        producto.precio_referencia = precio_unitario

    entrada = Entrada(
        producto_id=producto.id,
        proveedor_id=data.get("proveedor_id"),
        cantidad=cantidad,
        numero_albaran=data.get("numero_albaran"),
        precio_sin_iva=data.get("precio_sin_iva"),
        porcentaje_iva=data.get("porcentaje_iva"),
        valor_iva=data.get("valor_iva"),
        precio_con_iva=data.get("precio_con_iva"),
    )

    db.session.add(entrada)
    db.session.commit()

    return jsonify({"msg": "Entrada registrada", "producto": producto.to_dict()}), 201


@api.route("/registro-entrada", methods=["GET"])
@jwt_required()
def entradas_list():
    return jsonify([e.to_dict() for e in Entrada.query.order_by(Entrada.fecha.desc()).all()])


# =====================================================
# SALIDAS
# =====================================================

@api.route("/registro-salida", methods=["POST"])
@role_required("administrador", "empleado")
def registrar_salida():
    data = request.get_json() or {}

    producto_id = data.get("producto_id")
    cantidad = int(data.get("cantidad", 0))

    if not producto_id or cantidad <= 0:
        return jsonify({"msg": "Datos inválidos"}), 400

    producto = Producto.query.get(producto_id)
    if not producto:
        return jsonify({"msg": "Producto no encontrado"}), 404

    if producto.stock_actual < cantidad:
        return jsonify({"msg": "Stock insuficiente"}), 400

    uid = int(data.get("usuario_id") or get_jwt_identity())

    # 🔥 OBTENER ÚLTIMA ENTRADA REAL
    ultima_entrada = (
        Entrada.query
        .filter_by(producto_id=producto.id)
        .order_by(Entrada.fecha.desc())
        .first()
    )

    if (
        not ultima_entrada
        or not ultima_entrada.precio_con_iva
        or not ultima_entrada.cantidad
        or ultima_entrada.cantidad <= 0
    ):
        return jsonify(
            {"msg": "No hay una entrada válida con precio para este producto"},
            400,
        )

    # ✅ CÁLCULO CORRECTO
    precio_unitario = round(
        float(ultima_entrada.precio_con_iva) / float(ultima_entrada.cantidad),
        4,
    )

    precio_total = round(precio_unitario * cantidad, 2)

    # 🔥 ACTUALIZAR STOCK
    producto.stock_actual -= cantidad

    salida = Salida(
        producto_id=producto.id,
        usuario_id=uid,
        cantidad=cantidad,
        observaciones=data.get("observaciones"),
        precio_unitario=precio_unitario,
        precio_total=precio_total,
    )

    db.session.add(salida)
    db.session.commit()

    return jsonify({
        **salida.to_dict(),
        "producto": producto.to_dict()
    }), 201



@api.route("/salidas", methods=["GET"])
@jwt_required()
def salidas_list():
    return jsonify([s.to_dict() for s in Salida.query.order_by(Salida.fecha.desc()).all()])


# =====================================================
# MAQUINARIA
# =====================================================

@api.route("/maquinaria", methods=["GET"])
@jwt_required()
def maquinaria_list():
    return jsonify([m.to_dict() for m in Maquinaria.query.order_by(Maquinaria.id.desc()).all()])


@api.route("/maquinaria", methods=["POST"])
@role_required("administrador")
def maquinaria_create():
    data = request.get_json() or {}
    m = Maquinaria(nombre=data.get("nombre"))
    db.session.add(m)
    db.session.commit()
    return jsonify(m.to_dict()), 201


@api.route("/maquinaria/<int:mid>", methods=["PUT"])
@role_required("administrador")
def maquinaria_update(mid):
    m = Maquinaria.query.get_or_404(mid)
    data = request.get_json() or {}

    m.nombre = data.get("nombre", m.nombre)
    m.tipo = data.get("tipo", m.tipo)
    m.marca = data.get("marca", m.marca)
    m.modelo = data.get("modelo", m.modelo)
    m.numero_serie = data.get("numero_serie", m.numero_serie)
    m.estado = data.get("estado", m.estado)

    db.session.commit()
    return jsonify(m.to_dict()), 200


@api.route("/maquinaria/<int:mid>", methods=["DELETE"])
@role_required("administrador")
def maquinaria_delete(mid):
    m = Maquinaria.query.get_or_404(mid)
    db.session.delete(m)
    db.session.commit()
    return jsonify({"msg": "Maquinaria eliminada"}), 200


# =====================================================
# PING
# =====================================================

@api.route("/hello", methods=["GET"])
def hello():
    return jsonify({"msg": "Hello SpecialWash API"}), 200


@api.route("/salidas/resumen-mensual", methods=["GET"])
@role_required("administrador")
def resumen_mensual():
    data = (
        db.session.query(
            Producto.nombre.label("producto"),
            func.strftime("%Y-%m", Salida.fecha).label("mes"),
            func.sum(Salida.precio_total).label("gasto")
        )
        .join(Producto, Producto.id == Salida.producto_id)
        .group_by("mes", Producto.id)
        .order_by(desc("mes"))
        .all()
    )

    return jsonify([
        {
            "producto": r.producto,
            "mes": r.mes,
            "gasto": round(r.gasto, 2)
        }
        for r in data
    ])
