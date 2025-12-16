from .base import db, iso, now_madrid
from sqlalchemy.orm import relationship

class Producto(db.Model):
    __tablename__ = "producto"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(120), nullable=False)
    categoria = db.Column(db.String(120))
    stock_minimo = db.Column(db.Integer, default=0)
    stock_actual = db.Column(db.Integer, default=0)
   

    created_at = db.Column(
        db.DateTime(timezone=True),
        default=now_madrid,
        nullable=False,
    )

    entradas = relationship("Entrada", back_populates="producto", lazy="selectin")
    salidas = relationship("Salida", back_populates="producto", lazy="selectin")

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "categoria": self.categoria,
            "stock_minimo": self.stock_minimo,
            "stock_actual": self.stock_actual,
            "created_at": iso(self.created_at),
        }
