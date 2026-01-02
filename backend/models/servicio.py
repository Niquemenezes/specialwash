from . import db
from datetime import datetime


class Servicio(db.Model):
    __tablename__ = "servicios"

    id = db.Column(db.Integer, primary_key=True)
    coche_id = db.Column(db.Integer, db.ForeignKey("coches.id"), nullable=False)
    fecha = db.Column(db.DateTime, default=datetime.utcnow)
    tipo_servicio = db.Column(db.String(100))  # Lavado, Encerado, Pulido, etc.
    precio = db.Column(db.Float, default=0.0)
    observaciones = db.Column(db.Text)
    usuario_id = db.Column(db.Integer, db.ForeignKey("user.id"))

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
