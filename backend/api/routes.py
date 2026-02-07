from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token, jwt_required, get_jwt, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from sqlalchemy import func, desc
from datetime import datetime

from models import db, User, Producto, Proveedor, Entrada, Salida, Maquinaria, Cliente, Coche, Servicio, ServicioCliente

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
@role_required("administrador")
def signup():
    data = request.get_json() or {}

    nombre = (data.get("nombre") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    rol = _normalize_role(data.get("rol", "empleado"))

    if not nombre or not email or not password:
        return jsonify({"msg": "Faltan campos (nombre, email, password)"}), 400
    if len(password) < 6:
        return jsonify({"msg": "La contraseña debe tener al menos 6 caracteres"}), 400
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

    return jsonify({"user": user.to_dict()}), 201


@api.route("/auth/login_json", methods=["POST"])
def login_json():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"msg": "Email y contraseña son obligatorios"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.password_hash or not check_password_hash(user.password_hash, password):
        return jsonify({"msg": "Credenciales inválidas"}), 401

    if not getattr(user, 'activo', True):
        return jsonify({"msg": "Tu cuenta está desactivada. Contacta al administrador."}), 403

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
    if not user:
        return jsonify({"msg": "Usuario no encontrado"}), 401
    if not getattr(user, 'activo', True):
        return jsonify({"msg": "Cuenta desactivada"}), 403
    return jsonify({"user": user.to_dict()}), 200


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

    nombre = (data.get("nombre") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    rol = _normalize_role(data.get("rol", "empleado"))

    if not nombre or not email or not password:
        return jsonify({"msg": "Faltan campos obligatorios (nombre, email, password)"}), 400
    if len(password) < 6:
        return jsonify({"msg": "La contraseña debe tener al menos 6 caracteres"}), 400
    if rol not in _ALLOWED_ROLES:
        return jsonify({"msg": "Rol inválido"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"msg": "Ya existe un usuario con ese email"}), 400

    user = User(
        nombre=nombre,
        email=email,
        rol=rol,
        activo=True,
        password_hash=generate_password_hash(password)
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
    try:
        db.session.delete(u)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar: el usuario tiene registros asociados"}), 400
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
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return jsonify({"error": "El nombre es obligatorio"}), 400
    p = Proveedor(nombre=nombre)
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
    try:
        db.session.delete(p)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar: el proveedor tiene entradas asociadas"}), 400
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
    try:
        db.session.delete(p)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar: el producto tiene entradas o salidas asociadas"}), 400
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

    # Calcular IVA automáticamente
    precio_unitario = float(data.get("precio_unitario") or 0)
    porcentaje_iva = float(data.get("porcentaje_iva") or 21)  # IVA por defecto 21%
    descuento_pct = float(data.get("descuento_porcentaje") or 0)

    # Calcular totales: subtotal - descuento = base sin IVA
    subtotal = round(precio_unitario * cantidad, 2)
    importe_descuento = round(subtotal * (descuento_pct / 100), 2)
    precio_sin_iva_total = round(subtotal - importe_descuento, 2)
    valor_iva_total = round(precio_sin_iva_total * (porcentaje_iva / 100), 2)
    precio_con_iva_total = round(precio_sin_iva_total + valor_iva_total, 2)

    # Guardar el precio de referencia unitario en el producto
    if precio_unitario > 0:
        producto.precio_referencia = precio_unitario

    entrada = Entrada(
        producto_id=producto.id,
        producto_nombre=producto.nombre,
        proveedor_id=data.get("proveedor_id"),
        cantidad=cantidad,
        numero_albaran=data.get("numero_albaran"),
        precio_sin_iva=precio_sin_iva_total,
        porcentaje_iva=porcentaje_iva,
        valor_iva=valor_iva_total,
        precio_con_iva=precio_con_iva_total,
    )

    db.session.add(entrada)
    db.session.commit()

    return jsonify({"msg": "Entrada registrada", "producto": producto.to_dict()}), 201


@api.route("/registro-entrada", methods=["GET"])
@jwt_required()
def entradas_list():
    query = Entrada.query

    # Filtro por fecha "desde"
    desde = request.args.get("desde")
    if desde:
        try:
            fecha_desde = datetime.strptime(desde, "%Y-%m-%d")
            query = query.filter(Entrada.fecha >= fecha_desde)
        except ValueError:
            pass

    # Filtro por fecha "hasta" (incluye todo el día)
    hasta = request.args.get("hasta")
    if hasta:
        try:
            fecha_hasta = datetime.strptime(hasta, "%Y-%m-%d")
            # Sumar 1 día para incluir todo el día seleccionado
            from datetime import timedelta
            fecha_hasta = fecha_hasta + timedelta(days=1)
            query = query.filter(Entrada.fecha < fecha_hasta)
        except ValueError:
            pass

    # Filtro por proveedor
    proveedor_id = request.args.get("proveedor_id")
    if proveedor_id:
        try:
            query = query.filter(Entrada.proveedor_id == int(proveedor_id))
        except (ValueError, TypeError):
            pass

    return jsonify([e.to_dict() for e in query.order_by(Entrada.fecha.desc()).all()])


@api.route("/registro-entrada/<int:eid>", methods=["PUT"])
@role_required("administrador")
def entrada_update(eid):
    entrada = Entrada.query.get_or_404(eid)
    data = request.get_json() or {}
    
    # Actualizar producto y recalcular stock si cambió
    nuevo_producto_id = data.get("producto_id")
    nueva_cantidad = int(data.get("cantidad", entrada.cantidad))
    
    if nuevo_producto_id and nuevo_producto_id != entrada.producto_id:
        # Revertir stock del producto anterior
        producto_anterior = Producto.query.get(entrada.producto_id)
        if producto_anterior:
            producto_anterior.stock_actual -= entrada.cantidad
        
        # Actualizar nuevo producto
        nuevo_producto = Producto.query.get_or_404(nuevo_producto_id)
        nuevo_producto.stock_actual += nueva_cantidad
        entrada.producto_id = nuevo_producto_id
        entrada.producto_nombre = nuevo_producto.nombre
    elif nueva_cantidad != entrada.cantidad:
        # Solo cambió la cantidad
        producto = Producto.query.get(entrada.producto_id)
        if producto:
            diferencia = nueva_cantidad - entrada.cantidad
            producto.stock_actual += diferencia
    
    # Actualizar campos
    entrada.proveedor_id = data.get("proveedor_id", entrada.proveedor_id)
    entrada.cantidad = nueva_cantidad
    entrada.numero_albaran = data.get("numero_albaran", entrada.numero_albaran)
    
    # Recalcular precios si se proporcionan nuevos valores
    if "precio_unitario" in data:
        precio_unitario = float(data.get("precio_unitario") or 0)
        porcentaje_iva = float(data.get("porcentaje_iva") or 21)
        descuento_pct = float(data.get("descuento_porcentaje") or 0)

        subtotal = round(precio_unitario * nueva_cantidad, 2)
        importe_descuento = round(subtotal * (descuento_pct / 100), 2)
        precio_sin_iva = round(subtotal - importe_descuento, 2)
        valor_iva = round(precio_sin_iva * (porcentaje_iva / 100), 2)
        precio_con_iva = round(precio_sin_iva + valor_iva, 2)

        entrada.precio_sin_iva = precio_sin_iva
        entrada.porcentaje_iva = porcentaje_iva
        entrada.valor_iva = valor_iva
        entrada.precio_con_iva = precio_con_iva
    elif "precio_sin_iva" in data:
        precio_sin_iva = float(data.get("precio_sin_iva") or 0)
        porcentaje_iva = float(data.get("porcentaje_iva") or 21)
        valor_iva = round(precio_sin_iva * (porcentaje_iva / 100), 2)
        precio_con_iva = round(precio_sin_iva + valor_iva, 2)

        entrada.precio_sin_iva = precio_sin_iva
        entrada.porcentaje_iva = porcentaje_iva
        entrada.valor_iva = valor_iva
        entrada.precio_con_iva = precio_con_iva
    
    db.session.commit()
    return jsonify(entrada.to_dict()), 200


@api.route("/registro-entrada/<int:eid>", methods=["DELETE"])
@role_required("administrador")
def entrada_delete(eid):
    entrada = Entrada.query.get_or_404(eid)
    
    # Revertir el stock
    producto = Producto.query.get(entrada.producto_id)
    if producto:
        producto.stock_actual -= entrada.cantidad
    
    try:
        db.session.delete(entrada)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar la entrada"}), 400
    return jsonify({"msg": "Entrada eliminada"}), 200


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

    # 🔥 OBTENER ÚLTIMA ENTRADA REAL (OPCIONAL)
    ultima_entrada = (
        Entrada.query
        .filter_by(producto_id=producto.id)
        .order_by(Entrada.fecha.desc())
        .first()
    )

    # ✅ CÁLCULO DE PRECIO (OPCIONAL - Si no hay entrada, se guarda NULL)
    precio_unitario = None
    precio_total = None
    
    if ultima_entrada and ultima_entrada.precio_con_iva and ultima_entrada.cantidad and ultima_entrada.cantidad > 0:
        precio_unitario = round(
            float(ultima_entrada.precio_con_iva) / float(ultima_entrada.cantidad),
            4,
        )
        precio_total = round(precio_unitario * cantidad, 2)

    # 🔥 ACTUALIZAR STOCK
    producto.stock_actual -= cantidad

    salida = Salida(
        producto_id=producto.id,
        producto_nombre=producto.nombre,
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


@api.route("/registro-salida/<int:sid>", methods=["PUT"])
@role_required("administrador")
def salida_update(sid):
    salida = Salida.query.get_or_404(sid)
    data = request.get_json() or {}
    
    # Actualizar producto y recalcular stock si cambió
    nuevo_producto_id = data.get("producto_id")
    nueva_cantidad = int(data.get("cantidad", salida.cantidad))
    
    if nuevo_producto_id and nuevo_producto_id != salida.producto_id:
        # Revertir stock del producto anterior
        producto_anterior = Producto.query.get(salida.producto_id)
        if producto_anterior:
            producto_anterior.stock_actual += salida.cantidad
        
        # Actualizar nuevo producto
        nuevo_producto = Producto.query.get_or_404(nuevo_producto_id)
        nuevo_producto.stock_actual -= nueva_cantidad
        salida.producto_id = nuevo_producto_id
        salida.producto_nombre = nuevo_producto.nombre
    elif nueva_cantidad != salida.cantidad:
        # Solo cambió la cantidad
        producto = Producto.query.get(salida.producto_id)
        if producto:
            diferencia = salida.cantidad - nueva_cantidad
            producto.stock_actual += diferencia
    
    # Actualizar campos
    salida.cantidad = nueva_cantidad
    salida.observaciones = data.get("observaciones", salida.observaciones)
    
    # Actualizar precio unitario si se proporciona
    if "precio_unitario" in data:
        precio_unit = data.get("precio_unitario")
        if precio_unit is not None:
            salida.precio_unitario = float(precio_unit)
            salida.precio_total = round(salida.precio_unitario * nueva_cantidad, 2)
        else:
            # Si se pasa None, limpiar precios
            salida.precio_unitario = None
            salida.precio_total = None
    elif nueva_cantidad != salida.cantidad and salida.precio_unitario:
        # Solo recalcular si cambió la cantidad y hay precio unitario
        salida.precio_total = round(salida.precio_unitario * nueva_cantidad, 2)
    
    db.session.commit()
    return jsonify(salida.to_dict()), 200


@api.route("/registro-salida/<int:sid>", methods=["DELETE"])
@role_required("administrador")
def salida_delete(sid):
    salida = Salida.query.get_or_404(sid)
    
    # Revertir el stock
    producto = Producto.query.get(salida.producto_id)
    if producto:
        producto.stock_actual += salida.cantidad
    
    try:
        db.session.delete(salida)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar la salida"}), 400
    return jsonify({"msg": "Salida eliminada"}), 200


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
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return jsonify({"error": "El nombre es obligatorio"}), 400
    m = Maquinaria(nombre=nombre)
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
    try:
        db.session.delete(m)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar la maquinaria"}), 400
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


# =====================================================
# CLIENTES
# =====================================================

@api.route("/clientes", methods=["GET"])
@jwt_required()
def clientes_list():
    q = (request.args.get("q") or "").strip().lower()
    query = Cliente.query
    if q:
        query = query.filter(
            (Cliente.nombre.ilike(f"%{q}%")) |
            (Cliente.telefono.ilike(f"%{q}%")) |
            (Cliente.email.ilike(f"%{q}%"))
        )
    return jsonify([c.to_dict() for c in query.order_by(Cliente.nombre).all()])


@api.route("/clientes", methods=["POST"])
@role_required("administrador")
def clientes_create():
    data = request.get_json() or {}
    c = Cliente(
        nombre=data.get("nombre"),
        cif=data.get("cif"),
        telefono=data.get("telefono"),
        email=data.get("email"),
        direccion=data.get("direccion"),
        notas=data.get("notas")
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@api.route("/clientes/<int:cid>", methods=["PUT"])
@role_required("administrador")
def clientes_update(cid):
    c = Cliente.query.get_or_404(cid)
    data = request.get_json() or {}
    
    c.nombre = data.get("nombre", c.nombre)
    c.cif = data.get("cif", c.cif)
    c.telefono = data.get("telefono", c.telefono)
    c.email = data.get("email", c.email)
    c.direccion = data.get("direccion", c.direccion)
    c.notas = data.get("notas", c.notas)
    
    db.session.commit()
    return jsonify(c.to_dict()), 200


@api.route("/clientes/<int:cid>", methods=["DELETE"])
@role_required("administrador")
def clientes_delete(cid):
    c = Cliente.query.get_or_404(cid)
    try:
        db.session.delete(c)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar: el cliente tiene registros asociados"}), 400
    return jsonify({"msg": "Cliente eliminado"}), 200


# =====================================================
# COCHES
# =====================================================

@api.route("/coches", methods=["GET"])
@jwt_required()
def coches_list():
    q = (request.args.get("q") or "").strip().lower()
    query = Coche.query
    if q:
        query = query.filter(
            (Coche.matricula.ilike(f"%{q}%")) |
            (Coche.marca.ilike(f"%{q}%")) |
            (Coche.modelo.ilike(f"%{q}%"))
        )
    return jsonify([c.to_dict() for c in query.order_by(Coche.matricula).all()])


@api.route("/coches", methods=["POST"])
@role_required("administrador")
def coches_create():
    data = request.get_json() or {}
    
    # Verificar que la matrícula no exista
    matricula = data.get("matricula", "").strip().upper()
    if Coche.query.filter_by(matricula=matricula).first():
        return jsonify({"error": "Ya existe un coche con esa matrícula"}), 400
    
    c = Coche(
        matricula=matricula,
        marca=data.get("marca"),
        modelo=data.get("modelo"),
        color=data.get("color"),
        cliente_id=int(data.get("cliente_id")),
        notas=data.get("notas")
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@api.route("/coches/<int:cid>", methods=["PUT"])
@role_required("administrador")
def coches_update(cid):
    c = Coche.query.get_or_404(cid)
    data = request.get_json() or {}
    
    # Verificar matrícula si se cambia
    if "matricula" in data:
        nueva_matricula = data.get("matricula", "").strip().upper()
        if nueva_matricula != c.matricula:
            if Coche.query.filter_by(matricula=nueva_matricula).first():
                return jsonify({"error": "Ya existe un coche con esa matrícula"}), 400
            c.matricula = nueva_matricula
    
    c.marca = data.get("marca", c.marca)
    c.modelo = data.get("modelo", c.modelo)
    c.color = data.get("color", c.color)
    if "cliente_id" in data:
        c.cliente_id = int(data.get("cliente_id"))
    c.notas = data.get("notas", c.notas)
    
    db.session.commit()
    return jsonify(c.to_dict()), 200


@api.route("/coches/<int:cid>", methods=["DELETE"])
@role_required("administrador")
def coches_delete(cid):
    c = Coche.query.get_or_404(cid)
    try:
        db.session.delete(c)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar: el coche tiene servicios asociados"}), 400
    return jsonify({"msg": "Coche eliminado"}), 200


# =====================================================
# SERVICIOS
# =====================================================

@api.route("/servicios", methods=["GET"])
@jwt_required()
def servicios_list():
    q = (request.args.get("q") or "").strip().lower()
    coche_id = request.args.get("coche_id")
    
    query = Servicio.query
    if coche_id:
        query = query.filter_by(coche_id=int(coche_id))
    if q:
        query = query.join(Coche).filter(
            (Coche.matricula.ilike(f"%{q}%")) |
            (Servicio.tipo_servicio.ilike(f"%{q}%"))
        )
    return jsonify([s.to_dict() for s in query.order_by(Servicio.fecha.desc()).all()])


@api.route("/servicios", methods=["POST"])
@jwt_required()
def servicios_create():
    data = request.get_json() or {}
    usuario_id = get_jwt_identity()
    
    s = Servicio(
        fecha=datetime.utcnow(),  
        coche_id=int(data.get("coche_id")),
        tipo_servicio=data.get("tipo_servicio"),
        precio=float(data.get("precio", 0)),
        observaciones=data.get("observaciones"),
        usuario_id=usuario_id
    )
    db.session.add(s)
    db.session.commit()
    return jsonify(s.to_dict()), 201


@api.route("/servicios/<int:sid>", methods=["PUT"])
@role_required("administrador")
def servicios_update(sid):
    s = Servicio.query.get_or_404(sid)
    data = request.get_json() or {}
    
    if "coche_id" in data:
        s.coche_id = int(data.get("coche_id"))
    s.tipo_servicio = data.get("tipo_servicio", s.tipo_servicio)
    if "precio" in data:
        s.precio = float(data.get("precio"))
    s.observaciones = data.get("observaciones", s.observaciones)
    
    db.session.commit()
    return jsonify(s.to_dict()), 200


@api.route("/servicios/<int:sid>", methods=["DELETE"])
@role_required("administrador")
def servicios_delete(sid):
    s = Servicio.query.get_or_404(sid)
    try:
        db.session.delete(s)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar el servicio"}), 400
    return jsonify({"msg": "Servicio eliminado"}), 200


# =====================================================
# SERVICIOS PERSONALIZADOS POR CLIENTE
# =====================================================

@api.route("/clientes/<int:cliente_id>/servicios", methods=["GET"])
@jwt_required()
def get_servicios_cliente(cliente_id):
    """Obtener todos los servicios personalizados de un cliente"""
    servicios = ServicioCliente.query.filter_by(cliente_id=cliente_id).all()
    return jsonify([s.to_dict() for s in servicios]), 200


@api.route("/clientes/<int:cliente_id>/servicios", methods=["POST"])
@role_required("administrador")
def create_servicio_cliente(cliente_id):
    """Crear un servicio personalizado para un cliente"""
    cliente = Cliente.query.get_or_404(cliente_id)
    data = request.get_json() or {}
    
    nombre = data.get("nombre", "").strip()
    precio = data.get("precio")
    
    if not nombre:
        return jsonify({"msg": "El nombre del servicio es obligatorio"}), 400
    
    if precio is None or float(precio) < 0:
        return jsonify({"msg": "El precio debe ser un valor válido"}), 400
    
    servicio = ServicioCliente(
        cliente_id=cliente_id,
        nombre=nombre,
        precio=float(precio),
        descripcion=data.get("descripcion", "").strip(),
        activo=data.get("activo", True)
    )
    
    db.session.add(servicio)
    db.session.commit()
    
    return jsonify(servicio.to_dict()), 201


@api.route("/clientes/<int:cliente_id>/servicios/<int:servicio_id>", methods=["PUT"])
@role_required("administrador")
def update_servicio_cliente(cliente_id, servicio_id):
    """Actualizar un servicio personalizado de un cliente"""
    servicio = ServicioCliente.query.filter_by(id=servicio_id, cliente_id=cliente_id).first_or_404()
    data = request.get_json() or {}
    
    if "nombre" in data:
        nombre = data["nombre"].strip()
        if not nombre:
            return jsonify({"msg": "El nombre no puede estar vacío"}), 400
        servicio.nombre = nombre
    
    if "precio" in data:
        precio = float(data["precio"])
        if precio < 0:
            return jsonify({"msg": "El precio debe ser mayor o igual a 0"}), 400
        servicio.precio = precio
    
    if "descripcion" in data:
        servicio.descripcion = data["descripcion"].strip()
    
    if "activo" in data:
        servicio.activo = bool(data["activo"])
    
    db.session.commit()
    return jsonify(servicio.to_dict()), 200


@api.route("/clientes/<int:cliente_id>/servicios/<int:servicio_id>", methods=["DELETE"])
@role_required("administrador")
def delete_servicio_cliente(cliente_id, servicio_id):
    """Eliminar un servicio personalizado de un cliente"""
    servicio = ServicioCliente.query.filter_by(id=servicio_id, cliente_id=cliente_id).first_or_404()
    try:
        db.session.delete(servicio)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar el servicio personalizado"}), 400
    return jsonify({"msg": "Servicio eliminado"}), 200


# =====================================================
# REPORTES
# =====================================================

@api.route("/reportes/clientes", methods=["GET"])
@jwt_required()
def reporte_clientes():
    """
    Reporte de ingresos por cliente y coche en un período.
    Parámetros: fecha_desde, fecha_hasta (opcional)
    """
    fecha_desde = request.args.get("fecha_desde")
    fecha_hasta = request.args.get("fecha_hasta")
    
    query = db.session.query(
        Cliente.id.label("cliente_id"),
        Cliente.nombre.label("cliente_nombre"),
        Cliente.cif.label("cliente_cif"),
        Coche.id.label("coche_id"),
        Coche.matricula.label("coche_matricula"),
        Coche.marca.label("coche_marca"),
        Coche.modelo.label("coche_modelo"),
        func.count(Servicio.id).label("total_servicios"),
        func.sum(Servicio.precio).label("total_pagado")
    ).join(Coche, Cliente.id == Coche.cliente_id
    ).join(Servicio, Coche.id == Servicio.coche_id)
    
    # Filtros de fecha
    if fecha_desde:
        try:
            fecha_desde_dt = datetime.strptime(fecha_desde, "%Y-%m-%d")
            query = query.filter(Servicio.fecha >= fecha_desde_dt)
        except ValueError:
            pass
    
    if fecha_hasta:
        try:
            fecha_hasta_dt = datetime.strptime(fecha_hasta, "%Y-%m-%d")
            # Incluir todo el día hasta
            from datetime import timedelta
            fecha_hasta_dt = fecha_hasta_dt + timedelta(days=1)
            query = query.filter(Servicio.fecha < fecha_hasta_dt)
        except ValueError:
            pass
    
    query = query.group_by(
        Cliente.id, Cliente.nombre, Cliente.cif,
        Coche.id, Coche.matricula, Coche.marca, Coche.modelo
    ).order_by(Cliente.nombre, Coche.matricula)
    
    resultados = query.all()
    
    # Agrupar por cliente
    clientes_dict = {}
    for r in resultados:
        cliente_id = r.cliente_id
        if cliente_id not in clientes_dict:
            clientes_dict[cliente_id] = {
                "cliente_id": cliente_id,
                "cliente_nombre": r.cliente_nombre,
                "cliente_cif": r.cliente_cif,
                "coches": [],
                "total_cliente": 0
            }
        
        coche_info = {
            "coche_id": r.coche_id,
            "matricula": r.coche_matricula,
            "marca": r.coche_marca,
            "modelo": r.coche_modelo,
            "total_servicios": r.total_servicios,
            "total_pagado": round(float(r.total_pagado or 0), 2)
        }
        
        clientes_dict[cliente_id]["coches"].append(coche_info)
        clientes_dict[cliente_id]["total_cliente"] += coche_info["total_pagado"]
    
    # Redondear totales de cliente
    for cliente_id in clientes_dict:
        clientes_dict[cliente_id]["total_cliente"] = round(clientes_dict[cliente_id]["total_cliente"], 2)
    
    return jsonify({
        "clientes": list(clientes_dict.values()),
        "fecha_desde": fecha_desde,
        "fecha_hasta": fecha_hasta
    }), 200



