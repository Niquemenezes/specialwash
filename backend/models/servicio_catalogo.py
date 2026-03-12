from datetime import datetime
from .base import db


class ServicioCatalogo(db.Model):
    __tablename__ = "servicios_catalogo"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)
    descripcion = db.Column(db.Text)
    precio_base = db.Column(db.Float, nullable=True)
    activo = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "precio_base": self.precio_base,
            "activo": self.activo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
