from .base import db, iso, now_madrid
from sqlalchemy.orm import relationship

class Entrada(db.Model):
    __tablename__ = "entrada"

    id = db.Column(db.Integer, primary_key=True)

    producto_id = db.Column(db.Integer, db.ForeignKey("producto.id"), nullable=False)
    proveedor_id = db.Column(db.Integer, db.ForeignKey("proveedor.id"))

    fecha = db.Column(db.DateTime(timezone=True), default=now_madrid, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=now_madrid, nullable=False)

    cantidad = db.Column(db.Integer, nullable=False)

    numero_albaran = db.Column(db.String(120))

    precio_sin_iva = db.Column(db.Float)
    porcentaje_iva = db.Column(db.Float)
    valor_iva = db.Column(db.Float)
    precio_con_iva = db.Column(db.Float)

    producto = relationship("Producto", back_populates="entradas", lazy="joined")
    proveedor = relationship("Proveedor", back_populates="entradas", lazy="joined")

    def to_dict(self):
        dt = self.fecha or self.created_at
        return {
            "id": self.id,
            "producto_id": self.producto_id,
            "producto_nombre": getattr(self.producto, "nombre", None),
            "proveedor_id": self.proveedor_id,
            "proveedor_nombre": getattr(self.proveedor, "nombre", None),
            "cantidad": self.cantidad,
            "numero_documento": self.numero_albaran,
            "precio_sin_iva": self.precio_sin_iva,
            "porcentaje_iva": self.porcentaje_iva,
            "valor_iva": self.valor_iva,
            "precio_con_iva": self.precio_con_iva,
            "created_at": iso(dt),
            "fecha": iso(dt),
        }
