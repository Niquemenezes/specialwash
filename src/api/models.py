# MODELOS LIMPIOS PARA SPECIALWASH
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Usuario(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    rol = db.Column(db.String(50), nullable=False)

    def set_password(self, password):
        from werkzeug.security import generate_password_hash
        self.password = generate_password_hash(password)

    def serialize(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "email": self.email,
            "rol": self.rol
        }

class Proveedor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)

    def serialize(self):
        return {"id": self.id, "nombre": self.nombre}

class Producto(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    detalle = db.Column(db.Text, nullable=False)
    precio_unitario = db.Column(db.Float, nullable=False)
    proveedor_id = db.Column(db.Integer, db.ForeignKey('proveedor.id'), nullable=False)
    cantidad_comprada = db.Column(db.Float, nullable=False)
    unidad = db.Column(db.String(50), nullable=True)
    categoria = db.Column(db.String(100), nullable=False)
    stock_minimo = db.Column(db.Integer, nullable=True)

    proveedor = db.relationship('Proveedor')

    def serialize(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "detalle": self.detalle,
            "precio_unitario": self.precio_unitario,
            "proveedor_id": self.proveedor_id,
            "cantidad_comprada": self.cantidad_comprada,
            "unidad": self.unidad,
            "categoria": self.categoria,
            "stock_minimo": self.stock_minimo
        }

class Maquinaria(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.Text)
    fecha_compra = db.Column(db.Date)
    garantia = db.Column(db.String(100))

    def serialize(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "fecha_compra": self.fecha_compra.isoformat() if self.fecha_compra else None,
            "garantia": self.garantia
        }

class AlmacenProducto(db.Model):
    __tablename__ = 'almacen_producto'
    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey('producto.id'), unique=True, nullable=False)
    cantidad = db.Column(db.Float, default=0)
    cantidad_minima = db.Column(db.Float, default=0)

    producto = db.relationship("Producto")

    def serialize(self):
        return {
            "id": self.id,
            "producto_id": self.producto_id,
            "producto": self.producto.serialize(),
            "cantidad": self.cantidad,
            "cantidad_minima": self.cantidad_minima
        }


class RegistroEntradaProducto(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey('producto.id'), nullable=False)
    proveedor_id = db.Column(db.Integer, db.ForeignKey('proveedor.id'), nullable=False)
    numero_albaran = db.Column(db.String(100), nullable=False)
    fecha_entrada = db.Column(db.DateTime, default=datetime.utcnow)
    cantidad = db.Column(db.Float, nullable=False)
    precio_sin_iva = db.Column(db.Float, nullable=False)
    porcentaje_iva = db.Column(db.Float, nullable=False)
    valor_iva = db.Column(db.Float)
    precio_con_iva = db.Column(db.Float)
    descuento = db.Column(db.Float, default=0)
    precio_final_pagado = db.Column(db.Float)  # 🆕 NUEVO CAMPO
    observaciones = db.Column(db.Text)

    def serialize(self):
        return {
            "id": self.id,
            "producto_id": self.producto_id,
            "proveedor_id": self.proveedor_id,
            "numero_albaran": self.numero_albaran,
            "fecha_entrada": self.fecha_entrada.isoformat(),
            "cantidad": self.cantidad,
            "precio_sin_iva": self.precio_sin_iva,
            "porcentaje_iva": self.porcentaje_iva,
            "valor_iva": self.valor_iva,
            "precio_con_iva": self.precio_con_iva,
            "descuento": self.descuento,
            "precio_final_pagado": self.precio_final_pagado,
            "observaciones": self.observaciones,
        }

class RegistroSalidaProducto(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey('producto.id'), nullable=False)
    cantidad = db.Column(db.Float, nullable=False)
    fecha_salida = db.Column(db.DateTime, default=datetime.utcnow)
    # Keep the DB column name for backwards compatibility
    empleado = db.Column('responsable', db.String(120))
    observaciones = db.Column(db.Text)

    producto = db.relationship('Producto')

    def serialize(self):
        return {
            "id": self.id,
            "producto_id": self.producto_id,
            "producto": self.producto.serialize() if self.producto else None,
            "cantidad": self.cantidad,
            "fecha_salida": self.fecha_salida.isoformat() if self.fecha_salida else None,
            "empleado": self.empleado,
            "observaciones": self.observaciones,
        }

class MovimientoStock(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey('producto.id'), nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuario.id'), nullable=False)
    cantidad = db.Column(db.Float, nullable=False)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    tipo = db.Column(db.String(20), nullable=False)  # entrada o salida
    observaciones = db.Column(db.Text)

    producto = db.relationship('Producto')
    usuario = db.relationship('Usuario')