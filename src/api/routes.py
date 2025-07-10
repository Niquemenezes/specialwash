from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, create_access_token, get_jwt_identity
from api.models import db, Usuario, Producto, Maquinaria, Proveedor, AlmacenProducto, MovimientoStock, RegistroEntradaProducto, RegistroSalidaProducto, Almacen
from datetime import datetime
import json
import traceback
from werkzeug.security import check_password_hash

api = Blueprint("api", __name__)

# -------------------
# LOGIN
# -------------------
@api.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")
    rol = data.get("rol", "").lower()

    user = Usuario.query.filter_by(email=email, rol=rol).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({"msg": "Credenciales inválidas"}), 401

    access_token = create_access_token(identity=json.dumps({
        "id": user.id,
        "email": user.email,
        "rol": user.rol.lower()
    }))

    return jsonify({
        "access_token": access_token,
        "user": user.serialize(),
        "rol": user.rol
    }), 200

@api.route("/admin-exists", methods=["GET"])
def admin_exists():
    admins = Usuario.query.filter_by(rol="administrador").all()
    return jsonify({
        "exists": len(admins) > 0,
        "total": len(admins)
    }), 200

# -------------------
# USUARIOS
# -------------------
@api.route("/usuarios", methods=["GET"])
@jwt_required()
def get_usuarios():
    return jsonify([u.serialize() for u in Usuario.query.all()]), 200

@api.route("/usuarios", methods=["POST"])
def create_usuario():
    data = request.get_json(force=True)
    for field in ["nombre", "email", "password"]:
        if not data.get(field):
            return jsonify({"msg": f"El campo '{field}' es obligatorio."}), 422

    rol = data.get("rol", "empleado").strip().lower()

    if rol == "administrador":
        admins = Usuario.query.filter_by(rol="administrador").all()
        if admins:
            return jsonify({"msg": "Ya existe un administrador registrado."}), 403
    else:
        from flask_jwt_extended import verify_jwt_in_request
        try:
            verify_jwt_in_request()
        except:
            return jsonify({"msg": "Token requerido para crear usuarios no administradores"}), 401

    if Usuario.query.filter_by(email=data["email"]).first():
        return jsonify({"msg": "Email ya registrado"}), 400

    nuevo = Usuario(nombre=data["nombre"], email=data["email"], rol=rol)
    nuevo.set_password(data["password"])
    db.session.add(nuevo)
    db.session.commit()
    return jsonify(nuevo.serialize()), 201

@api.route("/usuarios/<int:id>", methods=["PUT"])
@jwt_required()
def update_usuario(id):
    u = Usuario.query.get_or_404(id)
    data = request.json
    u.nombre = data.get("nombre", u.nombre)
    u.email = data.get("email", u.email)
    if "password" in data and data["password"]:
        u.set_password(data["password"])
    u.rol = data.get("rol", u.rol)
    db.session.commit()
    return jsonify(u.serialize()), 200

@api.route("/usuarios/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_usuario(id):
    u = Usuario.query.get_or_404(id)
    db.session.delete(u)
    db.session.commit()
    return jsonify({"msg": "Usuario eliminado"}), 200

# -------------------
# PRODUCTOS
# -------------------
def to_float(val):
    try:
        return float(str(val).replace(",", "."))
    except:
        return 0.0

def to_int(val):
    try:
        return int(val)
    except:
        return 0

@api.route("/productos", methods=["GET"])
@jwt_required()
def get_productos():
    return jsonify([p.serialize() for p in Producto.query.all()]), 200

@api.route("/productos", methods=["POST"])
@jwt_required()
def crear_producto():
    data = request.get_json()
    detalle = data.get("detalle")
    nombre = data.get("nombre")
    precio_unitario = data.get("precio_unitario", 0)
    proveedor_id = data.get("proveedor_id")
    cantidad_comprada = data.get("cantidad_comprada", 0)
    unidad = data.get("unidad", "")
    categoria = data.get("categoria", "general")
    stock_minimo = data.get("stock_minimo", 0)

    if not nombre:
        return jsonify({"msg": "El nombre del producto es obligatorio"}), 400

    nuevo_producto = Producto(
        detalle=detalle,
        nombre=nombre,
        precio_unitario=precio_unitario,
        proveedor_id=proveedor_id,
        cantidad_comprada=cantidad_comprada,
        unidad=unidad,
        categoria=categoria,
        stock_minimo=stock_minimo
    )
    db.session.add(nuevo_producto)
    db.session.commit()

    return jsonify({"msg": "Producto creado", "producto": nuevo_producto.serialize()}), 201

# -------------------
# MAQUINARIA
# -------------------
@api.route("/maquinaria", methods=["GET"])
@jwt_required()
def get_maquinaria():
    return jsonify([m.serialize() for m in Maquinaria.query.all()]), 200

@api.route("/maquinaria", methods=["POST"])
@jwt_required()
def create_maquinaria():
    data = request.json
    nueva = Maquinaria(**data)
    db.session.add(nueva)
    db.session.commit()
    return jsonify(nueva.serialize()), 201

# -------------------
# PROVEEDORES
# -------------------

@api.route("/proveedores", methods=["GET"])
@jwt_required()
def get_proveedores():
    return jsonify([p.serialize() for p in Proveedor.query.all()]), 200


@api.route("/proveedores", methods=["POST"])
@jwt_required()
def create_proveedor():
    try:
        data = request.json

        if not data.get("nombre"):
            return jsonify({"msg": "El nombre del proveedor es obligatorio"}), 400

        nuevo = Proveedor(nombre=data["nombre"])
        db.session.add(nuevo)
        db.session.commit()
        return jsonify(nuevo.serialize()), 201

    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        return jsonify({"msg": "Error al crear proveedor", "error": str(e)}), 500




@api.route("/proveedores/<int:id>", methods=["PUT"])
@jwt_required()
def update_proveedor(id):
    p = Proveedor.query.get_or_404(id)
    data = request.json
    for key, value in data.items():
        setattr(p, key, value)
    db.session.commit()
    return jsonify(p.serialize()), 200


@api.route("/proveedores/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_proveedor(id):
    p = Proveedor.query.get_or_404(id)
    db.session.delete(p)
    db.session.commit()
    return jsonify({"msg": "Proveedor eliminado"}), 200


# -------------------
# PRODUCTOS EN ALMACÉN
# -------------------

@api.route("/almacen-productos", methods=["GET"])
@jwt_required()
def get_almacen_productos():
    return jsonify([p.serialize() for p in AlmacenProducto.query.all()]), 200


@api.route("/almacen-productos", methods=["POST"])
@jwt_required()
def create_almacen_producto():
    data = request.json
    clave = (data.get("producto_id"))
    if AlmacenProducto.query.get(clave):
        return jsonify({"msg": "Este producto ya está registrado en ese almacén."}), 400

    nuevo = AlmacenProducto(
        almacen_id=clave[0],
        producto_id=clave[1],
        cantidad=data.get("cantidad", 0),
        cantidad_minima=data.get("cantidad_minima", 0)
    )
    db.session.add(nuevo)
    db.session.commit()
    return jsonify(nuevo.serialize()), 201


@api.route("/almacen-productos/<int:almacen_id>/<int:producto_id>", methods=["PUT"])
@jwt_required()
def update_almacen_producto(almacen_id, producto_id):
    p = AlmacenProducto.query.get_or_404((almacen_id, producto_id))
    data = request.json
    p.cantidad = data.get("cantidad", p.cantidad)
    p.cantidad_minima = data.get("cantidad_minima", p.cantidad_minima)
    db.session.commit()
    return jsonify(p.serialize()), 200


@api.route("/almacen-productos/<int:almacen_id>/<int:producto_id>", methods=["DELETE"])
@jwt_required()
def delete_almacen_producto(almacen_id, producto_id):
    p = AlmacenProducto.query.get_or_404((almacen_id, producto_id))
    db.session.delete(p)
    db.session.commit()
    return jsonify({"msg": "Producto eliminado del almacén"}), 200


@api.route("/almacen-productos/bajo-minimo", methods=["GET"])
@jwt_required()
def productos_bajo_minimo():
    bajos = [p.serialize() for p in AlmacenProducto.query.all() if p.cantidad <= p.cantidad_minima]
    return jsonify(bajos), 200

@api.route("/api/productos/bajo-stock", methods=["GET"])
@jwt_required()
def productos_bajo_stock():
    productos = Producto.query.all()
    bajo_stock = [p.serialize() for p in productos if p.cantidad_comprada <= p.stock_minimo]
    return jsonify(bajo_stock), 200


# -------------------
# ALMACENES
# -------------------

@api.route('/almacenes', methods=['POST'])
@jwt_required()
def crear_almacen():
    data = request.get_json()
    nombre = data.get("nombre")
    if not nombre:
        return jsonify({"msg": "Nombre del almacén requerido"}), 400

    nuevo_almacen = Almacen(nombre=nombre)
    db.session.add(nuevo_almacen)
    db.session.commit()

    return jsonify({"msg": "Almacén creado correctamente"}), 201


# -------------------
# REGISTRO DE SALIDAS DE PRODUCTOS
# -------------------

@api.route("/registro-salida", methods=["POST"])
@jwt_required()
def registrar_salida():
    try:
        data = request.get_json()
        producto_id = data.get("producto_id")
        cantidad = to_float(data.get("cantidad"))
        fecha_salida = data.get("fecha_salida", datetime.utcnow())
        observaciones = data.get("observaciones", "")

        if not producto_id or not cantidad:
            return jsonify({"msg": "Faltan datos obligatorios"}), 400

        stock = AlmacenProducto.query.filter_by(producto_id=producto_id).first()
        if not stock:
            return jsonify({"msg": "Producto no encontrado en el stock"}), 404
        if stock.cantidad < cantidad:
            return jsonify({"msg": "Stock insuficiente"}), 400

        stock.cantidad -= cantidad
        salida = RegistroSalidaProducto(
            producto_id=producto_id,
            cantidad=cantidad,
            fecha_salida=fecha_salida,
            observaciones=observaciones
        )
        db.session.add(salida)
        db.session.commit()
        return jsonify({"msg": "Salida registrada correctamente"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al registrar salida", "error": str(e)}), 500




# -------------------
# HISTORIAL DE SALIDAS (RESUMEN)
# -------------------

@api.route("/registro-salida", methods=["GET"])
@jwt_required()
def historial_salidas():
    try:
        fecha_inicio = request.args.get("fecha_inicio")
        fecha_fin = request.args.get("fecha_fin")

        query = RegistroSalidaProducto.query

        if fecha_inicio:
            query = query.filter(RegistroSalidaProducto.fecha_salida >= fecha_inicio)
        if fecha_fin:
            query = query.filter(RegistroSalidaProducto.fecha_salida <= fecha_fin)

        salidas = query.order_by(RegistroSalidaProducto.fecha_salida.desc()).all()
        return jsonify([s.serialize() for s in salidas]), 200
    except Exception as e:
        return jsonify({"msg": "Error al obtener historial de salidas", "error": str(e)}), 500
    
# -------------------
# REGISTRO-ENTRADA DE PRODUCTOS 
# -------------------

@api.route("/registro-entrada", methods=["POST"])
@jwt_required()
def registrar_entrada_producto():
    data = request.get_json()
    
    producto_id = data.get("producto_id")
    proveedor_id = data.get("proveedor_id")
    numero_albaran = data.get("numero_albaran")
    fecha_entrada = data.get("fecha_entrada", datetime.utcnow())
    cantidad = float(data.get("cantidad", 0))
    precio_sin_iva = float(data.get("precio_sin_iva", 0))
    porcentaje_iva = float(data.get("porcentaje_iva", 0))
    descuento = float(data.get("descuento", 0))
    observaciones = data.get("observaciones", "")

    if not all([producto_id, proveedor_id, numero_albaran, cantidad, precio_sin_iva, porcentaje_iva]):
        return jsonify({"msg": "Faltan campos obligatorios"}), 400

    # Calcular valores automáticos
    valor_iva = precio_sin_iva * porcentaje_iva / 100
    precio_con_iva = precio_sin_iva + valor_iva - descuento

    # 1. Registrar entrada
    entrada = RegistroEntradaProducto(
        producto_id=producto_id,
        proveedor_id=proveedor_id,
        numero_albaran=numero_albaran,
        fecha_entrada=fecha_entrada,
        cantidad=cantidad,
        precio_sin_iva=precio_sin_iva,
        porcentaje_iva=porcentaje_iva,
        valor_iva=valor_iva,
        precio_con_iva=precio_con_iva,
        descuento=descuento,
        observaciones=observaciones,
    )
    db.session.add(entrada)

    # 2. Actualizar stock del producto
    producto = Producto.query.get(producto_id)
    if not producto:
        return jsonify({"msg": "Producto no encontrado"}), 404

    producto.cantidad_comprada += cantidad
    db.session.commit()

    return jsonify({
        "msg": "Entrada registrada y stock actualizado correctamente",
        "entrada": entrada.serialize(),
        "producto_actualizado": producto.serialize()
    }), 201


    
@api.route("/registro-entrada", methods=["GET"])
@jwt_required()
def get_registros_entrada():
    try:
        registros = RegistroEntradaProducto.query.order_by(RegistroEntradaProducto.fecha_entrada.desc()).all()
        return jsonify([r.serialize() for r in registros]), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({"msg": "Error al obtener registros de entrada", "error": str(e)}), 500

