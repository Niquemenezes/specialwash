from flask import Blueprint, request, jsonify
import json

from models import db
from models.inspeccion_recepcion import InspeccionRecepcion
from models.notificacion import Notificacion
from models.base import now_madrid
from utils.inspeccion_helpers import role_required, _jwt_user_id
from models.user import User

repaso_bp = Blueprint('repaso', __name__, url_prefix='/api')


@repaso_bp.route("/inspeccion-recepcion/<int:inspeccion_id>/repaso", methods=["POST"])
@role_required("administrador", "calidad")
def guardar_repaso_entrega(inspeccion_id):
    """Guardar checklist de repaso pre-entrega y marcar listo para entrega."""
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    if inspeccion.entregado:
        return jsonify({"msg": "El coche ya fue entregado"}), 400

    data = request.get_json(silent=True) or {}
    checklist = data.get("checklist") or {}
    notas = (data.get("notas") or "").strip()
    marcar_listo = bool(data.get("marcar_listo", False))
    requiere_hoja_intervencion = data.get("requiere_hoja_intervencion")

    if not isinstance(checklist, dict):
        return jsonify({"msg": "checklist debe ser un objeto"}), 400

    try:
        user_id = _jwt_user_id()
        user = User.query.get(user_id) if user_id else None

        inspeccion.repaso_checklist = json.dumps(checklist)
        inspeccion.repaso_notas = notas
        if requiere_hoja_intervencion is not None:
            inspeccion.requiere_hoja_intervencion = bool(requiere_hoja_intervencion)

        if marcar_listo:
            inspeccion.repaso_completado = True
            inspeccion.repaso_completado_por_id = user.id if user else None
            inspeccion.repaso_completado_por_nombre = (user.nombre or "").strip() if user else None
            inspeccion.repaso_completado_at = now_madrid()
        else:
            # Si se guarda sin marcar listo, conservamos marca previa solo si ya existía.
            if not inspeccion.repaso_completado:
                inspeccion.repaso_completado_por_id = None
                inspeccion.repaso_completado_por_nombre = None
                inspeccion.repaso_completado_at = None

        db.session.commit()

        # Notificación al administrador si hay hoja de intervención pendiente
        if marcar_listo and inspeccion.requiere_hoja_intervencion:
            try:
                notif = Notificacion(
                    tipo="hoja_intervencion",
                    titulo=f"Hoja de intervención pendiente: {inspeccion.matricula or 'S/M'}",
                    cuerpo=(
                        f"Cliente: {inspeccion.cliente_nombre} · "
                        f"Repaso completado por: {(user.nombre or '').strip() if user else 'Calidad'}"
                    ),
                    ref_id=inspeccion.id,
                )
                db.session.add(notif)
                db.session.commit()
            except Exception:
                pass

        return jsonify(inspeccion.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"msg": f"Error al guardar repaso: {str(e)}"}), 500
