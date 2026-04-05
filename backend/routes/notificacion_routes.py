from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.exc import OperationalError
from models import db
from models.notificacion import Notificacion
from utils.decorators import role_required

notificaciones_bp = Blueprint("notificaciones", __name__)


@notificaciones_bp.route("/notificaciones", methods=["GET"])
@role_required("administrador", "encargado")
def listar_notificaciones():
    """Devuelve las últimas 50 notificaciones (no leídas primero)."""
    try:
        items = (
            Notificacion.query
            .order_by(Notificacion.leida.asc(), Notificacion.created_at.desc())
            .limit(50)
            .all()
        )
    except OperationalError:
        # Producción puede arrancar sin tabla de notificaciones por decisión operativa.
        return jsonify([]), 200
    return jsonify([n.to_dict() for n in items]), 200


@notificaciones_bp.route("/notificaciones/no-leidas", methods=["GET"])
@role_required("administrador", "encargado")
def contar_no_leidas():
    """Devuelve solo el contador de notificaciones no leídas."""
    try:
        count = Notificacion.query.filter_by(leida=False).count()
    except OperationalError:
        return jsonify({"count": 0}), 200
    return jsonify({"count": count}), 200


@notificaciones_bp.route("/notificaciones/<int:nid>/leida", methods=["PATCH"])
@role_required("administrador", "encargado")
def marcar_leida(nid):
    """Elimina una notificación al marcarla como leída."""
    n = Notificacion.query.get_or_404(nid)
    db.session.delete(n)
    db.session.commit()
    return jsonify({"msg": "Notificación eliminada", "id": nid}), 200


@notificaciones_bp.route("/notificaciones/marcar-todas", methods=["PATCH"])
@role_required("administrador", "encargado")
def marcar_todas_leidas():
    """Elimina todas las notificaciones pendientes (equivale a marcar todas leídas)."""
    pendientes = Notificacion.query.filter_by(leida=False).all()
    total = len(pendientes)
    for n in pendientes:
        db.session.delete(n)
    db.session.commit()
    return jsonify({"msg": "Notificaciones pendientes eliminadas", "deleted": total}), 200
