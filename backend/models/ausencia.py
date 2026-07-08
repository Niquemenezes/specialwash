from .base import db, now_madrid
from datetime import date, datetime


class AusenciaPersonal(db.Model):
    __tablename__ = "ausencia_personal"

    id = db.Column(db.Integer, primary_key=True)
    empleado_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo = db.Column(db.String(32), nullable=False, default="vacaciones")
    fecha_inicio = db.Column(db.Date, nullable=False, index=True)
    fecha_fin = db.Column(db.Date, nullable=False, index=True)
    dias = db.Column(db.Integer, nullable=False, default=1)
    motivo = db.Column(db.Text, nullable=True)
    estado = db.Column(db.String(32), nullable=False, default="pendiente")
    creado_en = db.Column(db.DateTime, nullable=False, default=now_madrid)
    actualizado_en = db.Column(db.DateTime, nullable=False, default=now_madrid, onupdate=now_madrid)

    empleado = db.relationship("User", backref=db.backref("ausencias", lazy="dynamic"))

    __table_args__ = (
        db.CheckConstraint("tipo IN ('vacaciones','falta','permiso')", name="ck_ausencia_tipo"),
        db.CheckConstraint("estado IN ('pendiente','aprobado','rechazado')", name="ck_ausencia_estado"),
    )

    def to_dict(self):
        dias = self.dias if self.dias and self.dias > 0 else max(1, (self.fecha_fin - self.fecha_inicio).days + 1)
        return {
            "id": self.id,
            "empleado_id": self.empleado_id,
            "empleado_nombre": self.empleado.nombre if self.empleado else None,
            "tipo": self.tipo,
            "fecha_inicio": self.fecha_inicio.isoformat() if self.fecha_inicio else None,
            "fecha_fin": self.fecha_fin.isoformat() if self.fecha_fin else None,
            "dias": dias,
            "motivo": self.motivo,
            "estado": self.estado,
            "creado_en": self.creado_en.isoformat() if self.creado_en else None,
            "actualizado_en": self.actualizado_en.isoformat() if self.actualizado_en else None,
        }
