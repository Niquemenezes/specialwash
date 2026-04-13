from .base import db, iso, now_madrid


PRENDAS = ("camiseta", "pantalon", "zapatilla", "chaqueta")
TALLAS = ("XS", "S", "M", "L", "XL", "XXL", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45")


class UniformeEmpleado(db.Model):
    """Registro de uniformes entregados a cada empleado."""
    __tablename__ = "uniforme_empleado"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    prenda = db.Column(db.String(50), nullable=False)   # camiseta, pantalon, zapatilla, chaqueta
    talla = db.Column(db.String(10), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False, default=1)
    fecha_entrega = db.Column(db.DateTime(timezone=True), default=now_madrid, nullable=False)
    observaciones = db.Column(db.Text)
    created_at = db.Column(db.DateTime(timezone=True), default=now_madrid, nullable=False)

    usuario = db.relationship("User", lazy="joined")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "nombre_empleado": self.usuario.nombre if self.usuario else "",
            "prenda": self.prenda,
            "talla": self.talla,
            "cantidad": self.cantidad,
            "fecha_entrega": iso(self.fecha_entrega),
            "observaciones": self.observaciones,
            "created_at": iso(self.created_at),
        }


class StockUniforme(db.Model):
    """Stock disponible de cada prenda por talla."""
    __tablename__ = "stock_uniforme"

    id = db.Column(db.Integer, primary_key=True)
    prenda = db.Column(db.String(50), nullable=False)
    talla = db.Column(db.String(10), nullable=False)
    cantidad = db.Column(db.Integer, nullable=False, default=0)
    updated_at = db.Column(db.DateTime(timezone=True), default=now_madrid, onupdate=now_madrid, nullable=False)

    __table_args__ = (
        db.UniqueConstraint("prenda", "talla", name="uq_stock_prenda_talla"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "prenda": self.prenda,
            "talla": self.talla,
            "cantidad": self.cantidad,
            "updated_at": iso(self.updated_at),
        }
