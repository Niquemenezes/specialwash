from .base import db, iso, now_madrid

class Maquinaria(db.Model):
    __tablename__ = "maquinaria"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(120), nullable=False)
    tipo = db.Column(db.String(80))
    marca = db.Column(db.String(80))
    modelo = db.Column(db.String(80))
    numero_serie = db.Column(db.String(120))
    ubicacion = db.Column(db.String(120))
    estado = db.Column(db.String(50))
    fecha_compra = db.Column(db.Date)
    notas = db.Column(db.Text)

    created_at = db.Column(db.DateTime(timezone=True), default=now_madrid, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "tipo": self.tipo,
            "marca": self.marca,
            "modelo": self.modelo,
            "numero_serie": self.numero_serie,
            "ubicacion": self.ubicacion,
            "estado": self.estado,
            "fecha_compra": iso(self.fecha_compra),
            "notas": self.notas,
            "created_at": iso(self.created_at),
        }
