from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models.cita import Cita, EstadoCita
from models.cliente import Cliente
from models.coche import Coche
from utils.auth_utils import normalize_role, role_required
from flask_jwt_extended import get_jwt

citas_bp = Blueprint("citas", __name__)

ESTADOS_VALIDOS = {e.value for e in EstadoCita}


def _parse_datetime_flexible(raw_value):
    """Acepta datetime-local (YYYY-MM-DDTHH:MM), ISO con segundos y con sufijo Z."""
    value = str(raw_value or "").strip()
    if not value:
        return None

    # Compatibilidad con strings ISO que terminan en Z (UTC)
    if value.endswith("Z"):
        value = value[:-1]

    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _current_role():
    claims = get_jwt() or {}
    return normalize_role(claims.get("rol", ""))


# ── Listar citas ──────────────────────────────────────────────────────────────
@citas_bp.route("/citas", methods=["GET"])
@jwt_required()
def listar_citas():
    """
    GET /api/citas
    Filtros: ?cliente_id=&estado=&fecha=YYYY-MM-DD&proximas=true
    """
    q = Cita.query

    cliente_id = request.args.get("cliente_id")
    if cliente_id:
        try:
            q = q.filter(Cita.cliente_id == int(cliente_id))
        except (TypeError, ValueError):
            return jsonify({"msg": "cliente_id invalido"}), 400

    estado = request.args.get("estado")
    if estado:
        try:
            q = q.filter(Cita.estado == EstadoCita(estado))
        except ValueError:
            return jsonify({"msg": f"Estado inválido: {estado}"}), 400

    fecha = request.args.get("fecha")
    if fecha:
        try:
            dia = datetime.strptime(fecha, "%Y-%m-%d")
            q = q.filter(
                Cita.fecha_hora >= dia.replace(hour=0, minute=0, second=0),
                Cita.fecha_hora <= dia.replace(hour=23, minute=59, second=59),
            )
        except ValueError:
            return jsonify({"msg": "Formato de fecha inválido, usa YYYY-MM-DD"}), 400

    proximas = request.args.get("proximas", "").lower() == "true"
    if proximas:
        q = q.filter(
            Cita.fecha_hora >= datetime.utcnow(),
            Cita.estado.in_([EstadoCita.pendiente, EstadoCita.confirmada]),
        )

    citas = q.order_by(Cita.fecha_hora.asc()).all()
    return jsonify([c.to_dict() for c in citas])


# ── Obtener una cita ──────────────────────────────────────────────────────────
@citas_bp.route("/citas/<int:cita_id>", methods=["GET"])
@jwt_required()
def obtener_cita(cita_id):
    cita = Cita.query.get_or_404(cita_id)
    return jsonify(cita.to_dict())


# ── Crear cita ────────────────────────────────────────────────────────────────
@citas_bp.route("/citas", methods=["POST"])
@role_required("administrador", "encargado", "tecnico_comercial")
def crear_cita():
    """
    POST /api/citas
    Body:
    {
        "cliente_id": <int>,
        "coche_id": <int|null>,
        "fecha_hora": "2026-03-15T10:30:00",
        "motivo": "Lavado completo",
        "notas": "..."
    }
    """
    data = request.get_json() or {}

    cliente_id = data.get("cliente_id")
    fecha_hora_raw = (data.get("fecha_hora") or "").strip()
    motivo = (data.get("motivo") or "").strip()

    if not cliente_id:
        return jsonify({"msg": "cliente_id es obligatorio"}), 400
    if not fecha_hora_raw:
        return jsonify({"msg": "fecha_hora es obligatorio"}), 400
    if not motivo:
        return jsonify({"msg": "motivo es obligatorio"}), 400

    cliente = Cliente.query.get(cliente_id)
    if not cliente:
        return jsonify({"msg": "Cliente no encontrado"}), 404

    fecha_hora = _parse_datetime_flexible(fecha_hora_raw)
    if not fecha_hora:
        return jsonify({"msg": "Formato de fecha_hora inválido, usa ISO 8601 (YYYY-MM-DDTHH:MM:SS)"}), 400

    coche_id = data.get("coche_id")
    if coche_id:
        coche = Coche.query.get(coche_id)
        if not coche or coche.cliente_id != int(cliente_id):
            return jsonify({"msg": "El coche no pertenece a ese cliente"}), 400

    cita = Cita(
        cliente_id=int(cliente_id),
        coche_id=int(coche_id) if coche_id else None,
        fecha_hora=fecha_hora,
        motivo=motivo,
        notas=(data.get("notas") or "").strip() or None,
        estado=EstadoCita.pendiente,
        creada_por_id=int(get_jwt_identity()),
    )
    db.session.add(cita)
    db.session.commit()
    return jsonify(cita.to_dict()), 201


# ── Editar cita ───────────────────────────────────────────────────────────────
@citas_bp.route("/citas/<int:cita_id>", methods=["PUT"])
@role_required("administrador", "encargado", "tecnico_comercial")
def editar_cita(cita_id):
    cita = Cita.query.get_or_404(cita_id)
    data = request.get_json() or {}

    if "cliente_id" in data:
        cliente = Cliente.query.get(data["cliente_id"])
        if not cliente:
            return jsonify({"msg": "Cliente no encontrado"}), 404
        cita.cliente_id = data["cliente_id"]

    if "fecha_hora" in data:
        parsed = _parse_datetime_flexible(data["fecha_hora"])
        if not parsed:
            return jsonify({"msg": "Formato de fecha_hora inválido"}), 400
        cita.fecha_hora = parsed

    if "motivo" in data:
        motivo = (data["motivo"] or "").strip()
        if not motivo:
            return jsonify({"msg": "El motivo no puede estar vacío"}), 400
        cita.motivo = motivo

    if "notas" in data:
        cita.notas = (data["notas"] or "").strip() or None

    if "coche_id" in data:
        coche_id = data["coche_id"]
        if coche_id:
            coche = Coche.query.get(coche_id)
            if not coche or coche.cliente_id != cita.cliente_id:
                return jsonify({"msg": "El coche no pertenece a ese cliente"}), 400
        cita.coche_id = coche_id or None

    if "estado" in data:
        try:
            cita.estado = EstadoCita(data["estado"])
        except ValueError:
            return jsonify({"msg": f"Estado inválido. Opciones: {', '.join(ESTADOS_VALIDOS)}"}), 400

    db.session.commit()
    return jsonify(cita.to_dict())


# ── Cambiar solo el estado ─────────────────────────────────────────────────────
@citas_bp.route("/citas/<int:cita_id>/estado", methods=["PATCH"])
@role_required("administrador", "encargado", "tecnico_comercial")
def cambiar_estado_cita(cita_id):
    cita = Cita.query.get_or_404(cita_id)
    data = request.get_json() or {}
    estado = (data.get("estado") or "").strip()
    if estado not in ESTADOS_VALIDOS:
        return jsonify({"msg": f"Estado inválido. Opciones: {', '.join(sorted(ESTADOS_VALIDOS))}"}), 400
    cita.estado = EstadoCita(estado)
    db.session.commit()
    return jsonify(cita.to_dict())


# ── Eliminar cita ─────────────────────────────────────────────────────────────
@citas_bp.route("/citas/<int:cita_id>", methods=["DELETE"])
@role_required("administrador")
def eliminar_cita(cita_id):
    cita = Cita.query.get_or_404(cita_id)
    db.session.delete(cita)
    db.session.commit()
    return jsonify({"msg": "Cita eliminada"}), 200
