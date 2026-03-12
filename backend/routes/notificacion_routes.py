from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from models import db
from models.notificacion import Notificacion
from utils.decorators import role_required

notificaciones_bp = Blueprint("notificaciones", __name__)


@notificaciones_bp.route("/notificaciones", methods=["GET"])
@role_required("administrador", "encargado")
def listar_notificaciones():
    """Devuelve las últimas 50 notificaciones (no leídas primero)."""
    items = (
        Notificacion.query
        .order_by(Notificacion.leida.asc(), Notificacion.created_at.desc())
        .limit(50)
        .all()
    )
    return jsonify([n.to_dict() for n in items]), 200


@notificaciones_bp.route("/notificaciones/no-leidas", methods=["GET"])
@role_required("administrador", "encargado")
def contar_no_leidas():
    """Devuelve solo el contador de notificaciones no leídas."""
    count = Notificacion.query.filter_by(leida=False).count()
    return jsonify({"count": count}), 200


@notificaciones_bp.route("/notificaciones/<int:nid>/leida", methods=["PATCH"])
@role_required("administrador", "encargado")
def marcar_leida(nid):
    """Marca una notificación como leída."""
    n = Notificacion.query.get_or_404(nid)
    n.leida = True
    db.session.commit()
    return jsonify(n.to_dict()), 200


@notificaciones_bp.route("/notificaciones/marcar-todas", methods=["PATCH"])
@role_required("administrador", "encargado")
def marcar_todas_leidas():
    """Marca todas las notificaciones como leídas."""
    Notificacion.query.filter_by(leida=False).update({"leida": True})
    db.session.commit()
    return jsonify({"msg": "Todas marcadas como leídas"}), 200
