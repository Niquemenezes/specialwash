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
    pedido_en_curso = db.Column(db.Boolean, default=False, nullable=False)
    pedido_fecha = db.Column(db.DateTime(timezone=True))
    pedido_cantidad = db.Column(db.Integer)
    pedido_canal = db.Column(db.String(30))
    pedido_proveedor_id = db.Column(db.Integer)
   

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
        # Proveedor habitual: ultima entrada con proveedor asociado.
        ultima_con_proveedor = None
        for entrada in sorted(
            (self.entradas or []),
            key=lambda e: e.fecha or e.created_at or now_madrid(),
            reverse=True,
        ):
            if entrada.proveedor_id:
                ultima_con_proveedor = entrada
                break

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
            "pedido_en_curso": bool(self.pedido_en_curso),
            "pedido_fecha": iso(self.pedido_fecha),
            "pedido_cantidad": self.pedido_cantidad,
            "pedido_canal": self.pedido_canal,
            "pedido_proveedor_id": self.pedido_proveedor_id,
            "proveedor_habitual_id": getattr(ultima_con_proveedor, "proveedor_id", None),
            "proveedor_habitual_nombre": getattr(getattr(ultima_con_proveedor, "proveedor", None), "nombre", None),
            "created_at": iso(self.created_at),
        }
