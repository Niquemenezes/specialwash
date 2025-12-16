from .base import db
from sqlalchemy.orm import relationship

class Proveedor(db.Model):
    __tablename__ = "proveedor"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(120), nullable=False)

    telefono = db.Column(db.String(50))
    email = db.Column(db.String(120))
    direccion = db.Column(db.String(255))
    contacto = db.Column(db.String(120))
    notas = db.Column(db.Text)

    entradas = relationship("Entrada", back_populates="proveedor", lazy="selectin")

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "telefono": self.telefono,
            "email": self.email,
            "direccion": self.direccion,
            "contacto": self.contacto,
            "notas": self.notas,
        }
