from .base import db, iso, now_madrid
import json


class InspeccionRecepcion(db.Model):
    __tablename__ = "inspeccion_recepcion"

    id = db.Column(db.Integer, primary_key=True)
    usuario_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    
    # Vínculos a modelos existentes
    cliente_id = db.Column(db.Integer, db.ForeignKey("clientes.id"), nullable=True)
    coche_id = db.Column(db.Integer, db.ForeignKey("coches.id"), nullable=True)

    # Datos de respaldo (por si cliente o coche no existen aún)
    cliente_nombre = db.Column(db.String(200), nullable=False)
    cliente_telefono = db.Column(db.String(30), nullable=False)
    coche_descripcion = db.Column(db.String(250), nullable=False)
    matricula = db.Column(db.String(30))
    kilometros = db.Column(db.Integer, nullable=True)

    # Firmas de recepción
    es_concesionario = db.Column(db.Boolean, default=False, nullable=False)
    firma_cliente_recepcion = db.Column(db.Text)
    firma_empleado_recepcion = db.Column(db.Text)
    consentimiento_datos_recepcion = db.Column(db.Boolean, default=False, nullable=False)

    fecha_inspeccion = db.Column(db.DateTime(timezone=True), default=now_madrid, nullable=False)

    # Evidencias
    fotos_cloudinary = db.Column(db.Text, default="[]")
    videos_cloudinary = db.Column(db.Text, default="[]")

    # Observaciones / averias
    averias_notas = db.Column(db.Text)
    servicios_aplicados = db.Column(db.Text, default="[]")

    # Datos de entrega / cierre
    entregado = db.Column(db.Boolean, default=False, nullable=False)
    fecha_entrega = db.Column(db.DateTime(timezone=True), nullable=True)
    firma_cliente_entrega = db.Column(db.Text)
    firma_empleado_entrega = db.Column(db.Text)
    consentimiento_datos_entrega = db.Column(db.Boolean, default=False, nullable=False)
    conformidad_revision_entrega = db.Column(db.Boolean, default=False, nullable=False)
    trabajos_realizados = db.Column(db.Text)
    entrega_observaciones = db.Column(db.Text)

    # Repaso pre-entrega
    repaso_checklist = db.Column(db.Text, default="{}")
    repaso_notas = db.Column(db.Text)
    repaso_completado = db.Column(db.Boolean, default=False, nullable=False)
    repaso_completado_por_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    repaso_completado_por_nombre = db.Column(db.String(120))
    repaso_completado_at = db.Column(db.DateTime(timezone=True), nullable=True)

    confirmado = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=now_madrid, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=now_madrid, onupdate=now_madrid)

    # Relaciones
    usuario = db.relationship(
        "User",
        foreign_keys=[usuario_id],
        backref="inspecciones_realizadas",
    )
    repaso_completado_por = db.relationship(
        "User",
        foreign_keys=[repaso_completado_por_id],
        backref="inspecciones_repaso_completado",
    )
    cliente = db.relationship("Cliente", backref="inspecciones_recepcion")
    coche = db.relationship("Coche", backref="inspecciones_recepcion")

    def to_dict(self):
        return {
            "id": self.id,
            "usuario_id": self.usuario_id,
            "usuario_nombre": self.usuario.nombre if self.usuario else None,
            "cliente_id": self.cliente_id,
            "coche_id": self.coche_id,
            "cliente_nombre": self.cliente_nombre,
            "cliente_telefono": self.cliente_telefono,
            "coche_descripcion": self.coche_descripcion,
            "matricula": self.matricula,
            "kilometros": self.kilometros,
            "es_concesionario": self.es_concesionario,
            "firma_cliente_recepcion": self.firma_cliente_recepcion,
            "firma_empleado_recepcion": self.firma_empleado_recepcion,
            "consentimiento_datos_recepcion": self.consentimiento_datos_recepcion,
            "fecha_inspeccion": iso(self.fecha_inspeccion),
            "fotos_cloudinary": json.loads(self.fotos_cloudinary or "[]"),
            "videos_cloudinary": json.loads(self.videos_cloudinary or "[]"),
            "averias_notas": self.averias_notas,
            "servicios_aplicados": json.loads(self.servicios_aplicados or "[]"),
            "entregado": self.entregado,
            "fecha_entrega": iso(self.fecha_entrega),
            "firma_cliente_entrega": self.firma_cliente_entrega,
            "firma_empleado_entrega": self.firma_empleado_entrega,
            "consentimiento_datos_entrega": self.consentimiento_datos_entrega,
            "conformidad_revision_entrega": self.conformidad_revision_entrega,
            "trabajos_realizados": self.trabajos_realizados,
            "entrega_observaciones": self.entrega_observaciones,
            "repaso_checklist": json.loads(self.repaso_checklist or "{}"),
            "repaso_notas": self.repaso_notas,
            "repaso_completado": self.repaso_completado,
            "repaso_completado_por_id": self.repaso_completado_por_id,
            "repaso_completado_por_nombre": self.repaso_completado_por_nombre,
            "repaso_completado_at": iso(self.repaso_completado_at),
            "confirmado": self.confirmado,
            "created_at": iso(self.created_at),
            "updated_at": iso(self.updated_at),
            "cliente": self.cliente.to_dict() if self.cliente else None,
            "coche": self.coche.to_dict() if self.coche else None,
        }
