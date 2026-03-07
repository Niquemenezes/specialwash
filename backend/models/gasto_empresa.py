from .base import db, iso, now_madrid


class GastoEmpresa(db.Model):
    __tablename__ = "gasto_empresa"

    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.DateTime(timezone=True), default=now_madrid, nullable=False)
    concepto = db.Column(db.String(200), nullable=False)
    categoria = db.Column(db.String(100), nullable=False, default="general")
    importe = db.Column(db.Float, nullable=False, default=0)
    proveedor = db.Column(db.String(200))
    observaciones = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), default=now_madrid, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "fecha": iso(self.fecha),
            "concepto": self.concepto,
            "categoria": self.categoria,
            "importe": self.importe,
            "proveedor": self.proveedor,
            "observaciones": self.observaciones,
            "created_at": iso(self.created_at),
        }
