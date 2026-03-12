from datetime import datetime
from models.base import db

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
    empleado_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    estado = db.Column(db.Enum(EstadoParte), default=EstadoParte.pendiente, nullable=False)
    fecha_inicio = db.Column(db.DateTime)
    fecha_fin = db.Column(db.DateTime)
    observaciones = db.Column(db.String)

    coche = db.relationship("Coche")
    empleado = db.relationship("User")

    # Pausas: lista de tuplas (inicio, fin)
    pausas = db.Column(db.String)  # Guardar como string JSON, luego parsear

    def iniciar_trabajo(self):
        self.estado = EstadoParte.en_proceso
        if not self.fecha_inicio:
            self.fecha_inicio = datetime.now()

    def finalizar_trabajo(self):
        self.estado = EstadoParte.finalizado
        self.fecha_fin = datetime.now()

    def poner_en_pausa(self, inicio_pausa):
        self.estado = EstadoParte.en_pausa
        # Agregar inicio de pausa
        # Implementar lógica para guardar pausas

    def quitar_pausa(self, fin_pausa):
        self.estado = EstadoParte.en_proceso
        # Agregar fin de pausa
        # Implementar lógica para guardar pausas

    def duracion_total(self):
        if not self.fecha_inicio:
            return 0

        fin_ref = self.fecha_fin or datetime.now()
        total = (fin_ref - self.fecha_inicio).total_seconds()

        # Restar pausas cerradas y, si sigue en pausa, descontar hasta ahora.
        if self.pausas:
            import json
            pausas = json.loads(self.pausas)
            for pausa in pausas:
                if not pausa or len(pausa) < 1 or not pausa[0]:
                    continue
                inicio = datetime.fromisoformat(pausa[0])
                fin_iso = pausa[1] if len(pausa) > 1 else None
                fin = datetime.fromisoformat(fin_iso) if fin_iso else datetime.now()
                if fin > inicio:
                    total -= (fin - inicio).total_seconds()

        return max(total, 0) / 3600  # horas
