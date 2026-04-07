from datetime import datetime
from models.base import db, now_madrid, TZ_MADRID

import enum

class EstadoParte(enum.Enum):
    pendiente = "pendiente"
    en_proceso = "en_proceso"
    en_pausa = "en_pausa"
    finalizado = "finalizado"

class ParteTrabajo(db.Model):
    __tablename__ = "parte_trabajo"

    id = db.Column(db.Integer, primary_key=True)
    coche_id = db.Column(db.Integer, db.ForeignKey("coches.id"), nullable=False)
    inspeccion_id = db.Column(db.Integer, db.ForeignKey("inspeccion_recepcion.id"), nullable=True)
    servicio_catalogo_id = db.Column(db.Integer, db.ForeignKey("servicios_catalogo.id"), nullable=True)
    empleado_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    estado = db.Column(db.Enum(EstadoParte), default=EstadoParte.pendiente, nullable=False)
    fecha_inicio = db.Column(db.DateTime)
    fecha_fin = db.Column(db.DateTime)
    observaciones = db.Column(db.String)
    tiempo_estimado_minutos = db.Column(db.Integer, nullable=False, default=0)
    lote_uid = db.Column(db.String(36), nullable=True, index=True)
    tipo_tarea = db.Column(db.String(30), nullable=True)  # pintura | detailing | tapiceria | otro
    es_tarea_interna = db.Column(db.Boolean, nullable=False, default=False)

    coche = db.relationship("Coche")
    inspeccion = db.relationship("InspeccionRecepcion")
    servicio_catalogo = db.relationship("ServicioCatalogo")
    empleado = db.relationship("User")

    # Pausas: lista de tuplas (inicio, fin)
    pausas = db.Column(db.String)  # Guardar como string JSON, luego parsear

    def iniciar_trabajo(self):
        self.estado = EstadoParte.en_proceso
        if not self.fecha_inicio:
            self.fecha_inicio = now_madrid()

    def finalizar_trabajo(self):
        self.estado = EstadoParte.finalizado
        self.fecha_fin = now_madrid()

    def poner_en_pausa(self, inicio_pausa):
        import json
        self.estado = EstadoParte.en_pausa
        pausas = json.loads(self.pausas) if self.pausas else []
        pausas.append([inicio_pausa.isoformat(), None])
        self.pausas = json.dumps(pausas)

    def quitar_pausa(self, fin_pausa):
        import json
        self.estado = EstadoParte.en_proceso
        pausas = json.loads(self.pausas) if self.pausas else []
        # Cerrar la última pausa abierta (fin = None)
        for pausa in reversed(pausas):
            if pausa and len(pausa) >= 1 and pausa[1] is None:
                pausa[1] = fin_pausa.isoformat()
                break
        self.pausas = json.dumps(pausas)

    def duracion_total(self):
        if not self.fecha_inicio:
            return 0

        fin_ref = self.fecha_fin or now_madrid()
        total = (fin_ref - self.fecha_inicio).total_seconds()

        # Restar pausas cerradas y, si sigue en pausa, descontar hasta ahora.
        if self.pausas:
            import json
            pausas = json.loads(self.pausas)
            for pausa in pausas:
                if not pausa or len(pausa) < 1 or not pausa[0]:
                    continue
                # Normalizar a naive Madrid (el timestamp puede venir con o sin offset)
                dt_inicio = datetime.fromisoformat(pausa[0].replace('Z', '+00:00'))
                if dt_inicio.tzinfo is not None:
                    dt_inicio = dt_inicio.astimezone(TZ_MADRID).replace(tzinfo=None)
                fin_iso = pausa[1] if len(pausa) > 1 else None
                if fin_iso:
                    dt_fin = datetime.fromisoformat(fin_iso.replace('Z', '+00:00'))
                    if dt_fin.tzinfo is not None:
                        dt_fin = dt_fin.astimezone(TZ_MADRID).replace(tzinfo=None)
                else:
                    dt_fin = now_madrid()
                if dt_fin > dt_inicio:
                    total -= (dt_fin - dt_inicio).total_seconds()

        return max(total, 0) / 3600  # horas

    def duracion_total_minutos(self):
        return int(round(self.duracion_total() * 60))
