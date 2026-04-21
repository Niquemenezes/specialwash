import json
from .base import db, iso, now_madrid


class CocheSustitucion(db.Model):
    __tablename__ = "coche_sustitucion"

    id = db.Column(db.Integer, primary_key=True)

    # Cliente
    cliente_nombre = db.Column(db.String(200), nullable=False)
    cliente_dni = db.Column(db.String(20), nullable=False)
    cliente_telefono = db.Column(db.String(20))
    carnet_foto = db.Column(db.String(500))       # frente del carnet
    carnet_foto_verso = db.Column(db.String(500)) # verso del carnet

    # Coche prestado
    matricula = db.Column(db.String(20), nullable=False)
    marca = db.Column(db.String(100))
    modelo = db.Column(db.String(100))
    coche_cliente_matricula = db.Column(db.String(20))  # matrícula del coche en taller

    # Estado entrega
    km_entrega = db.Column(db.Integer)
    combustible_entrega = db.Column(db.String(20))  # lleno, 3/4, 1/2, 1/4, vacio
    estado_entrega = db.Column(db.Text)
    fotos_entrega = db.Column(db.Text, default="[]")  # JSON array de rutas

    # Firma y consentimiento
    firma_cliente = db.Column(db.Text)  # base64 PNG
    consentimiento_rgpd = db.Column(db.Boolean, default=False, nullable=False)
    fecha_entrega = db.Column(db.DateTime(timezone=False), default=now_madrid, nullable=False)

    # Estado devolución
    km_devolucion = db.Column(db.Integer)
    combustible_devolucion = db.Column(db.String(20))
    estado_devolucion = db.Column(db.Text)
    firma_devolucion = db.Column(db.Text)
    fecha_devolucion = db.Column(db.DateTime(timezone=False))

    created_at = db.Column(db.DateTime(timezone=False), default=now_madrid, nullable=False)
    devuelto = db.Column(db.Boolean, default=False, nullable=False)

    def fotos_entrega_list(self):
        try:
            return json.loads(self.fotos_entrega or "[]")
        except Exception:
            return []

    def to_dict(self):
        return {
            "id": self.id,
            "cliente_nombre": self.cliente_nombre,
            "cliente_dni": self.cliente_dni,
            "cliente_telefono": self.cliente_telefono,
            "carnet_foto": self.carnet_foto,
            "carnet_foto_verso": self.carnet_foto_verso,
            "matricula": self.matricula,
            "marca": self.marca,
            "modelo": self.modelo,
            "coche_cliente_matricula": self.coche_cliente_matricula,
            "km_entrega": self.km_entrega,
            "combustible_entrega": self.combustible_entrega,
            "estado_entrega": self.estado_entrega,
            "fotos_entrega": self.fotos_entrega_list(),
            "firma_cliente": self.firma_cliente,
            "consentimiento_rgpd": self.consentimiento_rgpd,
            "fecha_entrega": iso(self.fecha_entrega),
            "km_devolucion": self.km_devolucion,
            "combustible_devolucion": self.combustible_devolucion,
            "estado_devolucion": self.estado_devolucion,
            "firma_devolucion": self.firma_devolucion,
            "fecha_devolucion": iso(self.fecha_devolucion),
            "devuelto": self.devuelto,
            "created_at": iso(self.created_at),
        }
