from .base import db, now_madrid
from datetime import date


class RegistroHorario(db.Model):
    __tablename__ = "registro_horario"

    id = db.Column(db.Integer, primary_key=True)
    empleado_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    fecha = db.Column(db.Date, nullable=False, index=True, default=date.today)

    entrada = db.Column(db.DateTime(timezone=True), nullable=True)
    inicio_comida = db.Column(db.DateTime(timezone=True), nullable=True)
    fin_comida = db.Column(db.DateTime(timezone=True), nullable=True)
    salida = db.Column(db.DateTime(timezone=True), nullable=True)

    foto_entrada = db.Column(db.String(512), nullable=True)
    foto_inicio_comida = db.Column(db.String(512), nullable=True)
    foto_fin_comida = db.Column(db.String(512), nullable=True)
    foto_salida = db.Column(db.String(512), nullable=True)

    empleado = db.relationship("User", backref=db.backref("registros_horario", lazy="dynamic"))

    __table_args__ = (
        db.UniqueConstraint("empleado_id", "fecha", name="uq_horario_empleado_fecha"),
    )

    def to_dict(self):
        from .base import iso
        return {
            "id": self.id,
            "empleado_id": self.empleado_id,
            "empleado_nombre": self.empleado.nombre if self.empleado else None,
            "fecha": self.fecha.isoformat() if self.fecha else None,
            "entrada": iso(self.entrada),
            "inicio_comida": iso(self.inicio_comida),
            "fin_comida": iso(self.fin_comida),
            "salida": iso(self.salida),
            "tiene_foto_entrada": bool(self.foto_entrada),
            "tiene_foto_inicio_comida": bool(self.foto_inicio_comida),
            "tiene_foto_fin_comida": bool(self.foto_fin_comida),
            "tiene_foto_salida": bool(self.foto_salida),
        }
