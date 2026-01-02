from . import db
from datetime import datetime


class Coche(db.Model):
    __tablename__ = "coches"

    id = db.Column(db.Integer, primary_key=True)
    matricula = db.Column(db.String(20), unique=True, nullable=False)
    marca = db.Column(db.String(100))
    modelo = db.Column(db.String(100))
    color = db.Column(db.String(50))
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=False)
    notas = db.Column(db.Text)
    fecha_registro = db.Column(db.DateTime, default=datetime.utcnow)

    # Relación con cliente
    cliente = db.relationship("Cliente", back_populates="coches")
    
    # Relación con servicios
    servicios = db.relationship("Servicio", back_populates="coche", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "matricula": self.matricula,
            "marca": self.marca,
            "modelo": self.modelo,
            "color": self.color,
            "cliente_id": self.cliente_id,
            "cliente_nombre": self.cliente.nombre if self.cliente else None,
            "notas": self.notas,
            "fecha_registro": self.fecha_registro.isoformat() if self.fecha_registro else None,
        }
