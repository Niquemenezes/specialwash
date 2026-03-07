from .base import db, iso, now_madrid


class AutorizacionInspeccion(db.Model):
    __tablename__ = "autorizacion_inspeccion"

    id = db.Column(db.Integer, primary_key=True)
    empleado_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    admin_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

    # Permiso para ver inspecciones con datos sensibles
    puede_ver_datos = db.Column(db.Boolean, default=False, nullable=False)
    fecha_expiracion = db.Column(db.DateTime(timezone=True), nullable=False)

    created_at = db.Column(db.DateTime(timezone=True), default=now_madrid, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "empleado_id": self.empleado_id,
            "admin_id": self.admin_id,
            "puede_ver_datos": self.puede_ver_datos,
            "fecha_expiracion": iso(self.fecha_expiracion),
            "created_at": iso(self.created_at),
        }
