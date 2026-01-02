from .base import db, iso, now_madrid
from sqlalchemy.orm import relationship

class Salida(db.Model):
    __tablename__ = "salida"

    id = db.Column(db.Integer, primary_key=True)

    fecha = db.Column(
        db.DateTime(timezone=True),
        default=now_madrid,
        nullable=False
    )

    created_at = db.Column(
        db.DateTime(timezone=True),
        default=now_madrid,
        nullable=False
    )

    producto_id = db.Column(
        db.Integer,
        db.ForeignKey("producto.id"),
        nullable=False
    )
    producto_nombre = db.Column(db.String(200))  # Guardar nombre del producto

    usuario_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False
    )

    cantidad = db.Column(db.Integer, nullable=False)

    # 💰 CLAVE
    precio_unitario = db.Column(db.Float, nullable=False)
    precio_total = db.Column(db.Float, nullable=False)

    observaciones = db.Column(db.String(255))

    producto = relationship("Producto", back_populates="salidas", lazy="joined")
    usuario = relationship("User", back_populates="salidas", lazy="joined")

    def to_dict(self):
        dt = self.fecha or self.created_at
        return {
            "id": self.id,
            "fecha": iso(dt),
            "producto_id": self.producto_id,
            "producto_nombre": self.producto_nombre or getattr(self.producto, "nombre", None),
            "usuario_id": self.usuario_id,
            "usuario_nombre": getattr(self.usuario, "nombre", None),
            "cantidad": self.cantidad,
            "precio_unitario": self.precio_unitario,
            "precio_total": self.precio_total,
            "observaciones": self.observaciones,
        }
