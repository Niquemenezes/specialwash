from . import db
from datetime import datetime


class ServicioCliente(db.Model):
    """Servicios personalizados por cliente con precio específico"""
    __tablename__ = "servicios_cliente"

    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=False)
    nombre = db.Column(db.String(200), nullable=False)
    precio = db.Column(db.Float, nullable=False)
    descuento_porcentaje = db.Column(db.Float, nullable=False, default=0.0)
    descripcion = db.Column(db.Text)
    activo = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relación
    cliente = db.relationship("Cliente", back_populates="servicios_personalizados")

    def to_dict(self):
        descuento = float(self.descuento_porcentaje or 0)
        precio = float(self.precio or 0)
        precio_final = round(precio * (1 - (descuento / 100)), 2)
        return {
            "id": self.id,
            "cliente_id": self.cliente_id,
            "cliente_nombre": self.cliente.nombre if self.cliente else None,
            "nombre": self.nombre,
            "precio": self.precio,
            "descuento_porcentaje": descuento,
            "precio_final": precio_final,
            "descripcion": self.descripcion,
            "activo": self.activo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
