from .base import db, now_madrid
from datetime import date, datetime
import json


class RegistroHorario(db.Model):
    __tablename__ = "registro_horario"

    id = db.Column(db.Integer, primary_key=True)
    empleado_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    fecha = db.Column(db.Date, nullable=False, index=True, default=date.today)

    entrada = db.Column(db.DateTime(timezone=True), nullable=True)
    inicio_comida = db.Column(db.DateTime(timezone=True), nullable=True)
    fin_comida = db.Column(db.DateTime(timezone=True), nullable=True)
    salida = db.Column(db.DateTime(timezone=True), nullable=True)
    pausas = db.Column(db.Text, nullable=True)  # JSON: [[inicio_iso, fin_iso], ...]

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

        pausas = []
        if self.pausas:
            try:
                raw = json.loads(self.pausas)
                if isinstance(raw, list):
                    pausas = [p for p in raw if isinstance(p, list) and len(p) >= 1 and p[0]]
            except Exception:
                pausas = []

        if not pausas and self.inicio_comida:
            pausas = [[iso(self.inicio_comida), iso(self.fin_comida) if self.fin_comida else None]]

        ahora = now_madrid()
        descanso_total_minutos = 0
        descanso_activo = False
        for pausa in pausas:
            try:
                dt_inicio = pausa[0]
                dt_fin = pausa[1] if len(pausa) > 1 else None
                if not dt_inicio:
                    continue
                inicio = datetime.fromisoformat(str(dt_inicio).replace("Z", "+00:00"))
                fin = datetime.fromisoformat(str(dt_fin).replace("Z", "+00:00")) if dt_fin else ahora
                delta = max((fin - inicio).total_seconds(), 0)
                descanso_total_minutos += int(round(delta / 60))
                if not dt_fin:
                    descanso_activo = True
            except Exception:
                continue

        return {
            "id": self.id,
            "empleado_id": self.empleado_id,
            "empleado_nombre": self.empleado.nombre if self.empleado else None,
            "fecha": self.fecha.isoformat() if self.fecha else None,
            "entrada": iso(self.entrada),
            "inicio_comida": iso(self.inicio_comida),
            "fin_comida": iso(self.fin_comida),
            "salida": iso(self.salida),
            "pausas": pausas,
            "descanso_total_minutos": descanso_total_minutos,
            "descanso_activo": descanso_activo,
            "tiene_foto_entrada": bool(self.foto_entrada),
            "tiene_foto_inicio_comida": bool(self.foto_inicio_comida),
            "tiene_foto_fin_comida": bool(self.foto_fin_comida),
            "tiene_foto_salida": bool(self.foto_salida),
        }
