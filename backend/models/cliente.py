from . import db
from datetime import datetime


class Cliente(db.Model):
    __tablename__ = "clientes"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(200), nullable=False)
    cif = db.Column(db.String(20))
    telefono = db.Column(db.String(20))
    email = db.Column(db.String(120))
    direccion = db.Column(db.String(300))
    notas = db.Column(db.Text)
    fecha_registro = db.Column(db.DateTime, default=datetime.utcnow)

    # Relación con coches
    coches = db.relationship("Coche", back_populates="cliente", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "cif": self.cif,
            "telefono": self.telefono,
            "email": self.email,
            "direccion": self.direccion,
            "notas": self.notas,
            "fecha_registro": self.fecha_registro.isoformat() if self.fecha_registro else None,
        }
