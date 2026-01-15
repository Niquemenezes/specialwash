from . import db
from datetime import datetime


class Servicio(db.Model):
    __tablename__ = "servicios"

    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.DateTime, nullable=False)
    coche_id = db.Column(db.Integer, db.ForeignKey("coches.id"), nullable=False)
    tipo_servicio = db.Column(db.String(100), nullable=False)
    precio = db.Column(db.Float, nullable=False)
    descripcion = db.Column(db.Text)
    usuario_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    observaciones = db.Column(db.Text)

    # Relaciones
    coche = db.relationship("Coche", back_populates="servicios")
    usuario = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "coche_id": self.coche_id,
            "coche_matricula": self.coche.matricula if self.coche else None,
            "coche_marca": self.coche.marca if self.coche else None,
            "coche_modelo": self.coche.modelo if self.coche else None,
            "cliente_nombre": self.coche.cliente.nombre if self.coche and self.coche.cliente else None,
            "fecha": self.fecha.isoformat() if self.fecha else None,
            "tipo_servicio": self.tipo_servicio,
            "precio": self.precio,
            "observaciones": self.observaciones,
            "usuario_nombre": self.usuario.nombre if self.usuario else None,
        }
