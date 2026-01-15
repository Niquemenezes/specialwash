from . import db
from datetime import datetime


class ServicioCliente(db.Model):
    """Servicios personalizados por cliente con precio específico"""
    __tablename__ = "servicios_cliente"

    id = db.Column(db.Integer, primary_key=True)
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=False)
    nombre = db.Column(db.String(200), nullable=False)
    precio = db.Column(db.Float, nullable=False)
    descripcion = db.Column(db.Text)
    activo = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relación
    cliente = db.relationship("Cliente", backref="servicios_personalizados")

    def to_dict(self):
        return {
            "id": self.id,
            "cliente_id": self.cliente_id,
            "cliente_nombre": self.cliente.nombre if self.cliente else None,
            "nombre": self.nombre,
            "precio": self.precio,
            "descripcion": self.descripcion,
            "activo": self.activo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
