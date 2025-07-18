from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, create_access_token, get_jwt_identity, verify_jwt_in_request
from api.models import db, Usuario, Producto, Maquinaria, Proveedor, AlmacenProducto, MovimientoStock, RegistroEntradaProducto, RegistroSalidaProducto
from datetime import datetime
import json

from werkzeug.security import check_password_hash

api = Blueprint("api", __name__)

def safe_float(val):
    try:
        return float(str(val).replace(",", "."))
    except:
        return 0.0

def safe_int(val):
    try:
        return int(val)
    except:
        return 0

# -------------------
# LOGIN
# -------------------
@api.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get("email", "").strip().lower()
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
def obtener_usuarios_por_rol():
    rol = request.args.get("rol")
    if not rol:
        return jsonify({"error": "Rol no especificado"}), 400
    usuarios = Usuario.query.filter_by(rol=rol).all()
    return jsonify([user.serialize() for user in usuarios]), 200



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
        try:
            verify_jwt_in_request()
        except:
            return jsonify({"msg": "Token requerido para crear usuarios no administradores"}), 401

    if Usuario.query.filter_by(email=data["email"].strip().lower()).first():
        return jsonify({"msg": "Email ya registrado"}), 400

    nuevo = Usuario(nombre=data["nombre"], email=data["email"].strip().lower(), rol=rol)
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

@api.route("/usuarios/rol/<rol>", methods=["GET"])
@jwt_required()
def obtener_usuarios_por_rol_param(rol):
    usuarios = Usuario.query.filter_by(rol=rol).all()
    return jsonify([usuario.serialize() for usuario in usuarios]), 200

@api.route("/usuarios-todos", methods=["GET"])
@jwt_required()
def obtener_todos_los_usuarios():
    usuarios = Usuario.query.all()
    return jsonify([usuario.serialize() for usuario in usuarios]), 200




# -------------------
# PRODUCTOS
# -------------------
@api.route("/productos", methods=["GET"])
@jwt_required()
def get_productos():
    return jsonify([p.serialize() for p in Producto.query.all()]), 200

@api.route('/productos', methods=['POST'])
@jwt_required()
def crear_producto():
    data = request.get_json()

    try:
        nombre = data.get('nombre')
        detalle = data.get('detalle', '')
        categoria = data.get('categoria', '')
        stock_minimo = int(data.get('stock_minimo') or 0)

        if not nombre or not categoria:
            return jsonify({"msg": "Nombre y categoría son obligatorios"}), 400

        nuevo = Producto(
            nombre=nombre,
            detalle=detalle,
            precio_unitario=0.0,               # valor por defecto
            proveedor_id=1,                    # puedes cambiar este ID por uno válido o permitir NULL
            cantidad_comprada=0.0,
            unidad="",
            categoria=categoria,
            stock_minimo=stock_minimo
        )

        db.session.add(nuevo)
        db.session.commit()

        return jsonify({"msg": "Producto creado", "id": nuevo.id}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@api.route("/productos/<int:id>", methods=["PUT"])
@jwt_required()
def update_producto(id):
    producto = Producto.query.get_or_404(id)
    data = request.get_json()
    producto.detalle = data.get("detalle", producto.detalle)
    producto.nombre = data.get("nombre", producto.nombre)
    producto.precio_unitario = safe_float(data.get("precio_unitario", producto.precio_unitario))
    producto.proveedor_id = data.get("proveedor_id", producto.proveedor_id)
    producto.cantidad_comprada = safe_float(data.get("cantidad_comprada", producto.cantidad_comprada))
    producto.unidad = data.get("unidad", producto.unidad)
    producto.categoria = data.get("categoria", producto.categoria)
    producto.stock_minimo = safe_int(data.get("stock_minimo", producto.stock_minimo))
    db.session.commit()
    return jsonify(producto.serialize()), 200

@api.route("/productos/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_producto(id):
    producto = Producto.query.get_or_404(id)
    db.session.delete(producto)
    db.session.commit()
    return jsonify({"msg": "Producto eliminado"}), 200

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
    data = request.json
    if not data.get("nombre"):
        return jsonify({"msg": "El nombre del proveedor es obligatorio"}), 400
    nuevo = Proveedor(nombre=data["nombre"])
    db.session.add(nuevo)
    db.session.commit()
    return jsonify(nuevo.serialize()), 201

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

@api.route("/almacen-productos/bajo-minimo", methods=["GET"])
@jwt_required()
def productos_bajo_minimo():
    bajos = [p.serialize() for p in AlmacenProducto.query.all() if p.cantidad <= p.cantidad_minima]
    return jsonify(bajos), 200

@api.route("/productos/bajo-stock", methods=["GET"])
@jwt_required()
def productos_bajo_stock():
    productos = Producto.query.all()
    bajo_stock = [p.serialize() for p in productos if p.cantidad_comprada <= p.stock_minimo]
    return jsonify(bajo_stock), 200

# -------------------
# REGISTRO DE SALIDA
# -------------------
@api.route("/registro-salida", methods=["POST"])
@jwt_required()
def registrar_salida():
    try:
        data = request.get_json()
        producto_id = data.get("producto_id")
        cantidad = safe_float(data.get("cantidad"))
        empleado = data.get("responsable", "")
        observaciones = data.get("observaciones", "")

        if not producto_id or cantidad <= 0:
            return jsonify({"msg": "Faltan datos obligatorios o cantidad inválida"}), 400

        stock = AlmacenProducto.query.filter_by(producto_id=producto_id).first()
        if not stock or stock.cantidad < cantidad:
            return jsonify({"msg": "Stock insuficiente o producto no encontrado"}), 400

        stock.cantidad -= cantidad
        producto = Producto.query.get(producto_id)
        if producto:
            producto.cantidad_comprada = max(producto.cantidad_comprada - cantidad, 0)

        salida = RegistroSalidaProducto(
            producto_id=producto_id,
            cantidad=cantidad,
            empleado=empleado,
            observaciones=observaciones
        )
        db.session.add(salida)

        mov = MovimientoStock(
            producto_id=producto_id,
            usuario_id=json.loads(get_jwt_identity())["id"],
            cantidad=cantidad,
            tipo="salida",
            observaciones=observaciones
        )
        db.session.add(mov)

        db.session.commit()
        return jsonify({"msg": "Salida registrada correctamente"}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al registrar salida", "error": str(e)}), 500

@api.route("/registro-salida", methods=["GET"])
@jwt_required()
def obtener_historial_salidas():
    try:
        salidas = RegistroSalidaProducto.query.all()
        resultado = []
        for salida in salidas:
            resultado.append({
                "id": salida.id,
                "producto": {
                    "id": salida.producto.id,
                    "nombre": salida.producto.nombre,
                    "detalle": salida.producto.detalle,
                    "precio_unitario": salida.producto.precio_unitario
                },
                "cantidad": salida.cantidad,
                "fecha_salida": salida.fecha_salida,
                "responsable": salida.usuario.nombre if salida.usuario else None,
                "observaciones": salida.observaciones
            })
        return jsonify(resultado), 200
    except Exception as e:
        print("Error en /registro-salida:", e)
        return jsonify({"msg": "Error al obtener historial de salidas"}), 500

@api.route('/salidas', methods=['GET'])
@jwt_required()
def obtener_salidas():
    desde = request.args.get('desde')
    hasta = request.args.get('hasta')

    query = db.session.query(SalidaProducto).join(Producto).join(Usuario)

    if desde and hasta:
        try:
            fecha_desde = datetime.strptime(desde, "%Y-%m-%d")
            fecha_hasta = datetime.strptime(hasta, "%Y-%m-%d")
            query = query.filter(SalidaProducto.fecha >= fecha_desde, SalidaProducto.fecha <= fecha_hasta)
        except ValueError:
            return jsonify({"msg": "Formato de fecha inválido"}), 400

    salidas = query.order_by(SalidaProducto.fecha.desc()).all()

    return jsonify([{
        "id": salida.id,
        "cantidad": salida.cantidad,
        "fecha": salida.fecha,
        "producto": {
            "id": salida.producto.id,
            "nombre": salida.producto.nombre
        } if salida.producto else None,
        "usuario": {
            "id": salida.usuario.id,
            "nombre": salida.usuario.nombre
        } if salida.usuario else None
    } for salida in salidas]), 200

# -------------------
# REGISTRO DE ENTRADA
# -------------------
@api.route("/registro-entrada", methods=["POST"])
@jwt_required()
def registrar_entrada_producto():
    try:
        data = request.get_json()

        producto_id = data.get("producto_id")
        proveedor_id = data.get("proveedor_id")
        numero_albaran = data.get("numero_albaran")
        cantidad = safe_float(data.get("cantidad"))
        precio_sin_iva = safe_float(data.get("precio_sin_iva"))
        porcentaje_iva = safe_float(data.get("porcentaje_iva"))
        descuento = safe_float(data.get("descuento"))
        observaciones = data.get("observaciones", "")

        if not producto_id or not proveedor_id or not numero_albaran:
            return jsonify({"msg": "Producto, proveedor y albarán son obligatorios"}), 400
        if cantidad <= 0 or precio_sin_iva < 0:
            return jsonify({"msg": "Cantidad o precio inválido"}), 400

        subtotal = precio_sin_iva * cantidad
        valor_iva = subtotal * porcentaje_iva / 100
        total_con_iva = subtotal + valor_iva
        descuento_valor = total_con_iva * descuento / 100
        precio_con_iva = total_con_iva - descuento_valor

        entrada = RegistroEntradaProducto(
            producto_id=producto_id,
            proveedor_id=proveedor_id,
            numero_albaran=numero_albaran,
            cantidad=cantidad,
            precio_sin_iva=precio_sin_iva,
            porcentaje_iva=porcentaje_iva,
            valor_iva=valor_iva,
            precio_con_iva=precio_con_iva,
            descuento=descuento,
            precio_final_pagado=precio_con_iva,
            observaciones=observaciones
        )
        db.session.add(entrada)

        producto = Producto.query.get(producto_id)
        if producto:
            producto.cantidad_comprada += cantidad

        almacen = AlmacenProducto.query.filter_by(producto_id=producto_id).first()
        if almacen:
            almacen.cantidad += cantidad
        else:
            db.session.add(AlmacenProducto(producto_id=producto_id, cantidad=cantidad, cantidad_minima=producto.stock_minimo or 0))

        mov = MovimientoStock(
            producto_id=producto_id,
            usuario_id=json.loads(get_jwt_identity())["id"],
            cantidad=cantidad,
            tipo="entrada",
            observaciones=observaciones
        )
        db.session.add(mov)

        db.session.commit()

        return jsonify({
            "msg": "Entrada registrada y stock actualizado",
            "entrada": entrada.serialize(),
            "producto_actualizado": producto.serialize()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": "Error al registrar entrada", "error": str(e)}), 500

@api.route("/registro-entrada", methods=["GET"])
@jwt_required()
def get_registros_entrada():
    try:
        registros = RegistroEntradaProducto.query.order_by(RegistroEntradaProducto.fecha_entrada.desc()).all()
        return jsonify([r.serialize() for r in registros]), 200
    except Exception as e:
        return jsonify({"msg": "Error al obtener registros de entrada", "error": str(e)}), 500
