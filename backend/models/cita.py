import enum
from datetime import datetime
from .base import db


class EstadoCita(enum.Enum):
    pendiente = "pendiente"
    confirmada = "confirmada"
    cancelada = "cancelada"
    completada = "completada"


class Cita(db.Model):
    __tablename__ = "citas"

    id = db.Column(db.Integer, primary_key=True)

    # Cliente y coche (coche es opcional)
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=False)
    coche_id = db.Column(db.Integer, db.ForeignKey("coches.id"), nullable=True)

    # Fecha y hora de la cita
    fecha_hora = db.Column(db.DateTime, nullable=False)

    # Servicio/motivo
    motivo = db.Column(db.String(300), nullable=False)
    notas = db.Column(db.Text)

    # Estado
    estado = db.Column(db.Enum(EstadoCita), default=EstadoCita.pendiente, nullable=False)

    # Registro
    creada_en = db.Column(db.DateTime, default=datetime.utcnow)
    creada_por_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)

    # Relaciones
    cliente = db.relationship("Cliente", backref=db.backref("citas", lazy="dynamic"))
    coche = db.relationship("Coche", backref=db.backref("citas", lazy="dynamic"))
    creada_por = db.relationship("User", foreign_keys=[creada_por_id])

    def to_dict(self):
        return {
            "id": self.id,
            "cliente_id": self.cliente_id,
            "cliente_nombre": self.cliente.nombre if self.cliente else None,
            "cliente_telefono": self.cliente.telefono if self.cliente else None,
            "coche_id": self.coche_id,
            "coche_matricula": self.coche.matricula if self.coche else None,
            "coche_descripcion": (
                f"{self.coche.marca or ''} {self.coche.modelo or ''}".strip()
                if self.coche else None
            ),
            "fecha_hora": self.fecha_hora.isoformat() if self.fecha_hora else None,
            "motivo": self.motivo,
            "notas": self.notas,
            "estado": self.estado.value,
            "creada_en": self.creada_en.isoformat() if self.creada_en else None,
            "creada_por_nombre": self.creada_por.nombre if self.creada_por else None,
        }
