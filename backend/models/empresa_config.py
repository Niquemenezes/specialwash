from . import db
from datetime import datetime


class EmpresaConfig(db.Model):
    __tablename__ = "empresa_config"

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(200), default="Special Wash Car Solutions, S.R.L.")
    nombre_comercial = db.Column(db.String(200), default="SPECIAL WASH STUDIO")
    cif = db.Column(db.String(20), default="B21816566")
    direccion = db.Column(db.String(300), default="Calle Salvador Dalí, 22, 29700, Vélez-Málaga, ES")
    email = db.Column(db.String(120), default="alejandro@specialwash.es")
    telefono = db.Column(db.String(30), default="645811313")
    albaran_prefijo = db.Column(db.String(10), default="SW")
    albaran_siguiente_numero = db.Column(db.Integer, default=1)
    logo_url = db.Column(db.String(500), nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "nombre_comercial": self.nombre_comercial,
            "cif": self.cif,
            "direccion": self.direccion,
            "email": self.email,
            "telefono": self.telefono,
            "albaran_prefijo": self.albaran_prefijo,
            "albaran_siguiente_numero": self.albaran_siguiente_numero,
            "logo_url": self.logo_url,
        }
