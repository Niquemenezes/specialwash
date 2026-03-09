from .base import db, iso, now_madrid
from sqlalchemy.orm import relationship

class Producto(db.Model):
    __tablename__ = "producto"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(120), nullable=False)
    categoria = db.Column(db.String(120))
    codigo_barras = db.Column(db.String(64), unique=True, index=True)
    stock_minimo = db.Column(db.Integer, default=0)
    stock_actual = db.Column(db.Integer, default=0)
   

    created_at = db.Column(
        db.DateTime(timezone=True),
        default=now_madrid,
        nullable=False,
    )

    entradas = relationship("Entrada", back_populates="producto", lazy="selectin", cascade="all, delete-orphan")
    salidas = relationship("Salida", back_populates="producto", lazy="selectin", cascade="all, delete-orphan")
    codigos_barras = relationship(
        "ProductoCodigoBarras",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="ProductoCodigoBarras.id",
    )

    def to_dict(self):
        codigos = [c.to_dict() for c in (self.codigos_barras or [])]
        if self.codigo_barras and not any(c.get("codigo_barras") == self.codigo_barras for c in codigos):
            codigos.insert(0, {
                "id": None,
                "producto_id": self.id,
                "codigo_barras": self.codigo_barras,
                "marca": None,
                "created_at": None,
                "legacy": True,
            })

        return {
            "id": self.id,
            "nombre": self.nombre,
            "categoria": self.categoria,
            "codigo_barras": self.codigo_barras,
            "codigos_barras": codigos,
            "stock_minimo": self.stock_minimo,
            "stock_actual": self.stock_actual,
            "created_at": iso(self.created_at),
        }
