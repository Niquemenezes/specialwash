from .base import db, iso, now_madrid


class ActaEntrega(db.Model):
    __tablename__ = "acta_entrega"

    id = db.Column(db.Integer, primary_key=True)
    inspeccion_id = db.Column(db.Integer, db.ForeignKey("inspeccion_recepcion.id"), nullable=False, unique=True)

    cliente_nombre = db.Column(db.String(200), nullable=False)
    coche_descripcion = db.Column(db.String(250), nullable=False)
    matricula = db.Column(db.String(30), nullable=False)

    trabajos_realizados = db.Column(db.Text, nullable=False)
    entrega_observaciones = db.Column(db.Text)

    firma_cliente_entrega = db.Column(db.Text, nullable=True)  # Solo particulares, concesionarios no firman
    firma_empleado_entrega = db.Column(db.Text)

    consentimiento_datos_entrega = db.Column(db.Boolean, default=False, nullable=False)
    conformidad_revision_entrega = db.Column(db.Boolean, default=False, nullable=False)

    fecha_entrega = db.Column(db.DateTime(timezone=True), default=now_madrid, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=now_madrid, nullable=False)

    inspeccion = db.relationship("InspeccionRecepcion", backref=db.backref("acta_entrega_final", uselist=False))

    def to_dict(self):
        return {
            "id": self.id,
            "inspeccion_id": self.inspeccion_id,
            "cliente_nombre": self.cliente_nombre,
            "coche_descripcion": self.coche_descripcion,
            "matricula": self.matricula,
            "trabajos_realizados": self.trabajos_realizados,
            "entrega_observaciones": self.entrega_observaciones,
            "firma_cliente_entrega": self.firma_cliente_entrega,
            "firma_empleado_entrega": self.firma_empleado_entrega,
            "consentimiento_datos_entrega": self.consentimiento_datos_entrega,
            "conformidad_revision_entrega": self.conformidad_revision_entrega,
            "fecha_entrega": iso(self.fecha_entrega),
            "created_at": iso(self.created_at),
        }
