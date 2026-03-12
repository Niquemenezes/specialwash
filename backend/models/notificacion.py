from .base import db, now_madrid, iso


class Notificacion(db.Model):
    __tablename__ = "notificaciones"

    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(64), nullable=False, default="inspeccion")  # inspeccion | cita | alerta
    titulo = db.Column(db.String(200), nullable=False)
    cuerpo = db.Column(db.Text, nullable=True)
    leida = db.Column(db.Boolean, nullable=False, default=False)
    # id del objeto relacionado (inspeccion_id, cita_id…)
    ref_id = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=now_madrid)

    def to_dict(self):
        return {
            "id": self.id,
            "tipo": self.tipo,
            "titulo": self.titulo,
            "cuerpo": self.cuerpo,
            "leida": self.leida,
            "ref_id": self.ref_id,
            "created_at": iso(self.created_at),
        }
