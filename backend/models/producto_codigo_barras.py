from .base import db, iso, now_madrid


class ProductoCodigoBarras(db.Model):
    __tablename__ = "producto_codigo_barras"

    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey("producto.id", ondelete="CASCADE"), nullable=False, index=True)
    codigo_barras = db.Column(db.String(64), nullable=False, unique=True, index=True)
    marca = db.Column(db.String(120))
    created_at = db.Column(db.DateTime(timezone=True), default=now_madrid, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "producto_id": self.producto_id,
            "codigo_barras": self.codigo_barras,
            "marca": self.marca,
            "created_at": iso(self.created_at),
        }
