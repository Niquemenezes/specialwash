import json
import os
import uuid
from pathlib import Path

from flask import Blueprint, jsonify, request, send_from_directory
from flask_jwt_extended import get_jwt

from models import db
from models.coche_sustitucion import CocheSustitucion
from models.base import now_madrid
from utils.auth_utils import role_required

coche_sust_bp = Blueprint("coche_sustitucion", __name__)

_MEDIA_BASE = Path(os.path.dirname(os.path.abspath(__file__))).parent / "media" / "coche_sustitucion"
_MEDIA_BASE.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def _save_file(file, subfolder: str) -> str:
    folder = _MEDIA_BASE / subfolder
    folder.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return None
    name = f"{uuid.uuid4().hex}{ext}"
    file.save(str(folder / name))
    return f"coche_sustitucion/{subfolder}/{name}"


@coche_sust_bp.route("/coche-sustitucion/media/<path:filepath>")
def serve_media(filepath):
    base = Path(os.path.dirname(os.path.abspath(__file__))).parent / "media"
    return send_from_directory(str(base), filepath)


@coche_sust_bp.route("/coche-sustitucion", methods=["GET"])
@role_required("administrador", "calidad")
def listar():
    solo_activos = request.args.get("activos", "0") == "1"
    q = CocheSustitucion.query
    if solo_activos:
        q = q.filter_by(devuelto=False)
    items = q.order_by(CocheSustitucion.fecha_entrega.desc()).all()
    return jsonify([i.to_dict() for i in items])


@coche_sust_bp.route("/coche-sustitucion/<int:id>", methods=["GET"])
@role_required("administrador", "calidad")
def obtener(id):
    item = CocheSustitucion.query.get_or_404(id)
    return jsonify(item.to_dict())


@coche_sust_bp.route("/coche-sustitucion", methods=["POST"])
@role_required("administrador", "calidad")
def crear():
    data = request.get_json() or {}

    cliente_nombre = (data.get("cliente_nombre") or "").strip()
    cliente_dni = (data.get("cliente_dni") or "").strip()
    if not cliente_nombre or not cliente_dni:
        return jsonify({"msg": "Nombre y DNI del cliente son obligatorios"}), 400
    if not (data.get("matricula") or "").strip():
        return jsonify({"msg": "Matrícula del coche de sustitución es obligatoria"}), 400
    if not data.get("consentimiento_rgpd"):
        return jsonify({"msg": "El cliente debe aceptar el tratamiento de datos (RGPD)"}), 400

    item = CocheSustitucion(
        cliente_nombre=cliente_nombre,
        cliente_dni=cliente_dni,
        cliente_telefono=(data.get("cliente_telefono") or "").strip() or None,
        matricula=(data.get("matricula") or "").strip().upper(),
        marca=(data.get("marca") or "").strip() or None,
        modelo=(data.get("modelo") or "").strip() or None,
        coche_cliente_matricula=(data.get("coche_cliente_matricula") or "").strip().upper() or None,
        km_entrega=data.get("km_entrega") or None,
        combustible_entrega=data.get("combustible_entrega") or None,
        estado_entrega=(data.get("estado_entrega") or "").strip() or None,
        firma_cliente=data.get("firma_cliente") or None,
        consentimiento_rgpd=True,
        fecha_entrega=now_madrid(),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@coche_sust_bp.route("/coche-sustitucion/<int:id>/upload-carnet", methods=["POST"])
@role_required("administrador", "calidad")
def upload_carnet(id):
    item = CocheSustitucion.query.get_or_404(id)
    file = request.files.get("file")
    if not file:
        return jsonify({"msg": "No se recibió archivo"}), 400
    path = _save_file(file, f"{id}/carnet")
    if not path:
        return jsonify({"msg": "Formato no admitido"}), 400
    item.carnet_foto = path
    db.session.commit()
    return jsonify({"carnet_foto": path})


@coche_sust_bp.route("/coche-sustitucion/<int:id>/upload-foto", methods=["POST"])
@role_required("administrador", "calidad")
def upload_foto(id):
    item = CocheSustitucion.query.get_or_404(id)
    file = request.files.get("file")
    if not file:
        return jsonify({"msg": "No se recibió archivo"}), 400
    path = _save_file(file, f"{id}/fotos")
    if not path:
        return jsonify({"msg": "Formato no admitido"}), 400
    fotos = item.fotos_entrega_list()
    fotos.append(path)
    item.fotos_entrega = json.dumps(fotos)
    db.session.commit()
    return jsonify({"fotos_entrega": fotos})


@coche_sust_bp.route("/coche-sustitucion/<int:id>/devolucion", methods=["PUT"])
@role_required("administrador", "calidad")
def registrar_devolucion(id):
    item = CocheSustitucion.query.get_or_404(id)
    if item.devuelto:
        return jsonify({"msg": "Este coche ya fue devuelto"}), 400
    data = request.get_json() or {}
    item.km_devolucion = data.get("km_devolucion") or None
    item.combustible_devolucion = data.get("combustible_devolucion") or None
    item.estado_devolucion = (data.get("estado_devolucion") or "").strip() or None
    item.firma_devolucion = data.get("firma_devolucion") or None
    item.fecha_devolucion = now_madrid()
    item.devuelto = True
    db.session.commit()
    return jsonify(item.to_dict())


@coche_sust_bp.route("/coche-sustitucion/<int:id>", methods=["DELETE"])
@role_required("administrador")
def eliminar(id):
    item = CocheSustitucion.query.get_or_404(id)
    db.session.delete(item)
    db.session.commit()
    return jsonify({"msg": "Registro eliminado"})
