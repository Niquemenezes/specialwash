from models.base import db, now_madrid
from models.parte_trabajo import EstadoParte


class ParteTrabajoColaborador(db.Model):
    __tablename__ = "parte_trabajo_colaborador"

    id = db.Column(db.Integer, primary_key=True)
    parte_id = db.Column(db.Integer, db.ForeignKey("parte_trabajo.id"), nullable=False, index=True)
    empleado_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    estado = db.Column(db.Enum(EstadoParte), default=EstadoParte.pendiente, nullable=False)
    fecha_inicio = db.Column(db.DateTime)
    fecha_fin = db.Column(db.DateTime)
    pausas = db.Column(db.String)
    observaciones = db.Column(db.String)
    created_at = db.Column(db.DateTime(timezone=True), default=now_madrid, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=now_madrid, onupdate=now_madrid)

    parte = db.relationship("ParteTrabajo", backref=db.backref("colaboradores", lazy="select"))
    empleado = db.relationship("User")

