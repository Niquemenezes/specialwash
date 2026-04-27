from datetime import datetime, time, timedelta
from models.base import db, now_madrid, TZ_MADRID

import enum
import os

class EstadoParte(enum.Enum):
    pendiente = "pendiente"
    en_proceso = "en_proceso"
    en_pausa = "en_pausa"
    finalizado = "finalizado"


def _to_madrid_naive(value):
    """Normaliza strings/aware datetimes a naive Europe/Madrid."""
    if value is None:
        return None
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if value.tzinfo is not None:
        value = value.astimezone(TZ_MADRID).replace(tzinfo=None)
    return value


def _get_workday_limits():
    """Límites de jornada laboral para cálculo de tiempos de parte."""
    try:
        start_hour = int(os.getenv("PARTE_WORKDAY_START_HOUR", "8"))
    except (TypeError, ValueError):
        start_hour = 8
    try:
        end_hour = int(os.getenv("PARTE_WORKDAY_END_HOUR", "18"))
    except (TypeError, ValueError):
        end_hour = 18

    if start_hour < 0 or start_hour > 23:
        start_hour = 8
    if end_hour <= start_hour or end_hour > 23:
        end_hour = 18
    return start_hour, end_hour


def _seconds_within_workday(start_dt, end_dt):
    """Cuenta solo los segundos que caen dentro de la jornada laboral diaria."""
    start_dt = _to_madrid_naive(start_dt)
    end_dt = _to_madrid_naive(end_dt)
    if start_dt is None or end_dt is None or end_dt <= start_dt:
        return 0.0

    start_hour, end_hour = _get_workday_limits()
    total = 0.0
    current_day = start_dt.date()
    last_day = end_dt.date()

    while current_day <= last_day:
        tramo_inicio = datetime.combine(current_day, time(hour=start_hour, minute=0))
        tramo_fin = datetime.combine(current_day, time(hour=end_hour, minute=0))

        inicio_real = max(start_dt, tramo_inicio)
        fin_real = min(end_dt, tramo_fin)
        if fin_real > inicio_real:
            total += (fin_real - inicio_real).total_seconds()

        current_day += timedelta(days=1)

    return total


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
    fase = db.Column(db.String(20), nullable=True)  # preparacion | pintura
    es_tarea_interna = db.Column(db.Boolean, nullable=False, default=False)
    prioridad = db.Column(db.Integer, nullable=False, default=0, server_default='0')  # 0=normal 1=urgente 2=muy_urgente

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
        """Duración en horas contando solo tiempo dentro de jornada laboral."""
        if not self.fecha_inicio:
            return 0

        inicio_ref = _to_madrid_naive(self.fecha_inicio)
        fin_ref = _to_madrid_naive(self.fecha_fin) or now_madrid()
        total = _seconds_within_workday(inicio_ref, fin_ref)

        # Restar pausas cerradas y, si sigue en pausa, descontar hasta ahora.
        if self.pausas:
            import json
            pausas = json.loads(self.pausas)
            for pausa in pausas:
                if not pausa or len(pausa) < 1 or not pausa[0]:
                    continue
                dt_inicio = _to_madrid_naive(pausa[0])
                fin_iso = pausa[1] if len(pausa) > 1 else None
                dt_fin = _to_madrid_naive(fin_iso) if fin_iso else now_madrid()
                if dt_inicio and dt_fin and dt_fin > dt_inicio:
                    total -= _seconds_within_workday(dt_inicio, dt_fin)

        return max(total, 0) / 3600  # horas

    def duracion_total_minutos(self):
        return int(round(self.duracion_total() * 60))
