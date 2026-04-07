from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from models import ServicioCatalogo, User, db
from utils.auth_utils import _dev_auth_bypass_enabled, normalize_role, role_required

servicio_catalogo_bp = Blueprint("servicio_catalogo_routes", __name__)
SERVICIO_SCOPED_ROLES = {"detailing", "pintura", "tapicero"}


def _current_role():
    claims = get_jwt() or {}
    role = normalize_role(claims.get("rol"))
    if role:
        return role

    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        user_id = None

    if user_id:
        user = User.query.get(user_id)
        role = normalize_role(getattr(user, "rol", ""))
        if role:
            return role

    if _dev_auth_bypass_enabled():
        return "administrador"

    return ""


def parse_tiempo_estimado_minutos(value):
    if value in (None, ""):
        return None
    try:
        minutos = int(value)
    except (TypeError, ValueError):
        raise ValueError("El tiempo estimado debe ser un numero entero de minutos")
    if minutos < 0:
        raise ValueError("El tiempo estimado no puede ser negativo")
    return minutos


def _is_truthy(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).strip().lower() in {"1", "true", "yes", "on", "si", "sí"}


@servicio_catalogo_bp.route("/servicios_catalogo", methods=["GET"])
@jwt_required()
def listar_servicios_catalogo():
    solo_activos = request.args.get("activos", "false").lower() == "true"
    current_role = _current_role()
    requested_role = normalize_role(request.args.get("rol") or "")

    query = ServicioCatalogo.query
    if solo_activos:
        query = query.filter_by(activo=True)

    servicios = query.order_by(ServicioCatalogo.nombre).all()

    # Roles operativos: siempre su propia area.
    # Roles gestores: pueden forzar vista por area usando ?rol=<area>.
    scoped_role = ""
    if current_role in SERVICIO_SCOPED_ROLES:
        scoped_role = current_role
    elif current_role in {"administrador", "encargado", "calidad"} and requested_role in SERVICIO_SCOPED_ROLES:
        scoped_role = requested_role

    if scoped_role:
        servicios = [
            s
            for s in servicios
            if normalize_role(getattr(s, "rol_responsable", "")) == scoped_role
        ]

    return jsonify([s.to_dict() for s in servicios])


@servicio_catalogo_bp.route("/servicios_catalogo", methods=["POST"])
@role_required("administrador")
def crear_servicio_catalogo():
    data = request.get_json() or {}
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return jsonify({"msg": "El nombre es obligatorio"}), 400

    existente = ServicioCatalogo.query.filter(
        ServicioCatalogo.nombre.ilike(nombre)
    ).first()
    if existente:
        return jsonify({"msg": "Ya existe un servicio con ese nombre"}), 400

    try:
        tiempo_estimado_minutos = parse_tiempo_estimado_minutos(
            data.get("tiempo_estimado_minutos")
        )
    except ValueError as exc:
        return jsonify({"msg": str(exc)}), 400

    if tiempo_estimado_minutos is None or tiempo_estimado_minutos <= 0:
        return jsonify({"msg": "El tiempo estimado es obligatorio y debe ser mayor que 0 minutos"}), 400

    rol_responsable = normalize_role(data.get("rol_responsable") or "")
    
    servicio = ServicioCatalogo(
        nombre=nombre,
        descripcion=(data.get("descripcion") or "").strip() or None,
        precio_base=data.get("precio_base"),
        tiempo_estimado_minutos=tiempo_estimado_minutos,
        rol_responsable=rol_responsable or None,
        activo=True,
    )
    db.session.add(servicio)
    db.session.commit()
    return jsonify(servicio.to_dict()), 201


@servicio_catalogo_bp.route("/servicios_catalogo/<int:servicio_id>", methods=["PUT"])
@role_required("administrador")
def editar_servicio_catalogo(servicio_id):
    servicio = ServicioCatalogo.query.get_or_404(servicio_id)
    data = request.get_json() or {}

    nombre = (data.get("nombre") or "").strip()
    if nombre:
        # Verificar duplicado (excepto el propio)
        dup = ServicioCatalogo.query.filter(
            ServicioCatalogo.nombre.ilike(nombre),
            ServicioCatalogo.id != servicio_id,
        ).first()
        if dup:
            return jsonify({"msg": "Ya existe un servicio con ese nombre"}), 400
        servicio.nombre = nombre

    if "descripcion" in data:
        servicio.descripcion = (data["descripcion"] or "").strip() or None
    if "precio_base" in data:
        servicio.precio_base = data["precio_base"]
    if "tiempo_estimado_minutos" in data:
        try:
            servicio.tiempo_estimado_minutos = parse_tiempo_estimado_minutos(
                data.get("tiempo_estimado_minutos")
            )
        except ValueError as exc:
            return jsonify({"msg": str(exc)}), 400
    if "rol_responsable" in data:
        rol_responsable = normalize_role(data.get("rol_responsable") or "")
        servicio.rol_responsable = rol_responsable or None

    # Los servicios activos siempre deben tener tiempo estimado > 0.
    activo_resultante = servicio.activo
    if "activo" in data:
        activo_resultante = _is_truthy(data["activo"])
        servicio.activo = activo_resultante

    if activo_resultante and (servicio.tiempo_estimado_minutos is None or int(servicio.tiempo_estimado_minutos) <= 0):
        return jsonify({"msg": "Un servicio activo debe tener tiempo estimado mayor que 0 minutos"}), 400

    db.session.commit()
    return jsonify(servicio.to_dict())


@servicio_catalogo_bp.route("/servicios_catalogo/<int:servicio_id>", methods=["DELETE"])
@role_required("administrador")
def eliminar_servicio_catalogo(servicio_id):
    servicio = ServicioCatalogo.query.get_or_404(servicio_id)
    db.session.delete(servicio)
    db.session.commit()
    return jsonify({"msg": "Servicio eliminado"}), 200
