from datetime import datetime
from .base import db


class ServicioCatalogo(db.Model):
    __tablename__ = "servicios_catalogo"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)
    descripcion = db.Column(db.Text)
    precio_base = db.Column(db.Float, nullable=True)
    tiempo_estimado_minutos = db.Column(db.Integer, nullable=True)
    rol_responsable = db.Column(db.String(30), nullable=False, default="otro")
    activo = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "precio_base": self.precio_base,
            "tiempo_estimado_minutos": self.tiempo_estimado_minutos,
            "rol_responsable": self.rol_responsable,
            "activo": self.activo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
