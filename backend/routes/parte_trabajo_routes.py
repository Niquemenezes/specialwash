from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from models.parte_trabajo import ParteTrabajo, EstadoParte
from models.coche import Coche
from models.user import User
from extensions import db
from datetime import datetime
import json

from utils.auth_utils import normalize_role, role_required

bp = Blueprint('parte_trabajo', __name__)


def _current_role():
    claims = get_jwt() or {}
    return normalize_role(claims.get('rol'))


def _can_manage_all_partes():
    return _current_role() in {'administrador', 'encargado'}


def _serialize_parte(parte):
    return {
        'id': parte.id,
        'coche_id': parte.coche_id,
        'empleado_id': parte.empleado_id,
        'estado': parte.estado.value,
        'fecha_inicio': parte.fecha_inicio.isoformat() if parte.fecha_inicio else None,
        'fecha_fin': parte.fecha_fin.isoformat() if parte.fecha_fin else None,
        'observaciones': parte.observaciones,
        'duracion_horas': parte.duracion_total()
    }


def _parse_query_datetime(raw_value, end_of_day=False):
    if not raw_value:
        return None

    value = str(raw_value).strip()
    try:
        if len(value) == 10:
            parsed = datetime.fromisoformat(f"{value}T00:00:00")
            if end_of_day:
                parsed = parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
            return parsed
        return datetime.fromisoformat(value)
    except ValueError:
        return None

# Crear parte de trabajo (solo admin)
@bp.route('/parte_trabajo', methods=['POST'])
@role_required('administrador', 'encargado')
def crear_parte_trabajo():
    data = request.get_json() or {}

    coche_id = data.get('coche_id')
    empleado_id = data.get('empleado_id')
    observaciones = (data.get('observaciones') or '').strip()

    if coche_id is None or empleado_id is None:
        return jsonify({'msg': 'Debes indicar coche_id y empleado_id'}), 400

    coche = Coche.query.get(coche_id)
    if not coche:
        return jsonify({'msg': 'Coche no encontrado'}), 404

    empleado = User.query.get(empleado_id)
    if not empleado:
        return jsonify({'msg': 'Empleado no encontrado'}), 404
    if not getattr(empleado, 'activo', True):
        return jsonify({'msg': 'El empleado está inactivo'}), 400
    if normalize_role(getattr(empleado, 'rol', '')) not in {'empleado', 'encargado'}:
        return jsonify({'msg': 'Solo se puede asignar a empleados o encargados'}), 400

    parte_activa = ParteTrabajo.query.filter(
        ParteTrabajo.coche_id == int(coche_id),
        ParteTrabajo.estado.in_([
            EstadoParte.pendiente,
            EstadoParte.en_proceso,
            EstadoParte.en_pausa,
        ])
    ).first()
    if parte_activa:
        return jsonify({'msg': 'Ese coche ya tiene un parte activo'}), 400

    parte = ParteTrabajo(
        coche_id=int(coche_id),
        empleado_id=int(empleado_id),
        estado=EstadoParte.pendiente,
        observaciones=observaciones
    )
    db.session.add(parte)
    db.session.commit()
    return jsonify({'id': parte.id}), 201

# Listar partes de trabajo (filtros por estado, coche, empleado)
@bp.route('/parte_trabajo', methods=['GET'])
@jwt_required()
def listar_partes_trabajo():
    estado = request.args.get('estado')
    empleado_id = request.args.get('empleado_id')
    coche_id = request.args.get('coche_id')
    query = ParteTrabajo.query

    if not _can_manage_all_partes():
        query = query.filter(ParteTrabajo.empleado_id == int(get_jwt_identity()))

    if estado:
        try:
            query = query.filter(ParteTrabajo.estado == EstadoParte(estado))
        except ValueError:
            return jsonify({'msg': f"Estado inválido: {estado}"}), 400
    if empleado_id:
        empleado_id_int = int(empleado_id)
        if not _can_manage_all_partes() and empleado_id_int != int(get_jwt_identity()):
            return jsonify({'msg': 'Acceso denegado'}), 403
        query = query.filter(ParteTrabajo.empleado_id == empleado_id_int)
    if coche_id:
        query = query.filter(ParteTrabajo.coche_id == int(coche_id))
    partes = query.all()
    return jsonify([_serialize_parte(p) for p in partes])


@bp.route('/parte_trabajo/<int:parte_id>', methods=['PUT'])
@role_required('administrador', 'encargado')
def editar_parte_trabajo(parte_id):
    parte = ParteTrabajo.query.get_or_404(parte_id)
    data = request.get_json() or {}

    if 'empleado_id' in data:
        empleado_id = data.get('empleado_id')
        if empleado_id is None:
            return jsonify({'msg': 'El empleado_id es obligatorio'}), 400

        empleado = User.query.get(empleado_id)
        if not empleado:
            return jsonify({'msg': 'Empleado no encontrado'}), 404
        if not getattr(empleado, 'activo', True):
            return jsonify({'msg': 'El empleado está inactivo'}), 400
        if normalize_role(getattr(empleado, 'rol', '')) not in {'empleado', 'encargado'}:
            return jsonify({'msg': 'Solo se puede asignar a empleados o encargados'}), 400

        parte.empleado_id = empleado.id

    if 'observaciones' in data:
        parte.observaciones = (data.get('observaciones') or '').strip()

    db.session.commit()

    return jsonify(_serialize_parte(parte))

# Cambiar estado de parte de trabajo
@bp.route('/parte_trabajo/<int:parte_id>/estado', methods=['PUT'])
@jwt_required()
def cambiar_estado_parte(parte_id):
    data = request.get_json() or {}
    parte = ParteTrabajo.query.get_or_404(parte_id)
    current_user_id = int(get_jwt_identity())
    if not _can_manage_all_partes() and parte.empleado_id != current_user_id:
        return jsonify({'msg': 'Acceso denegado'}), 403

    nuevo_estado = data['estado']
    if nuevo_estado == 'en_proceso':
        parte.iniciar_trabajo()
    elif nuevo_estado == 'finalizado':
        if parte.estado == EstadoParte.en_pausa:
            pausas = json.loads(parte.pausas) if parte.pausas else []
            for pausa in reversed(pausas):
                if pausa[1] is None:
                    pausa[1] = datetime.now().isoformat()
                    break
            parte.pausas = json.dumps(pausas)
        parte.finalizar_trabajo()
    elif nuevo_estado == 'en_pausa':
        inicio_pausa = datetime.now().isoformat()
        # Guardar pausa
        pausas = json.loads(parte.pausas) if parte.pausas else []
        pausas.append([inicio_pausa, None])
        parte.pausas = json.dumps(pausas)
        parte.estado = EstadoParte.en_pausa
    elif nuevo_estado == 'pendiente':
        parte.estado = EstadoParte.pendiente
    db.session.commit()
    return jsonify({'estado': parte.estado.value})

# Quitar pausa (empleado vuelve a en_proceso)
@bp.route('/parte_trabajo/<int:parte_id>/quitar_pausa', methods=['PUT'])
@jwt_required()
def quitar_pausa(parte_id):
    parte = ParteTrabajo.query.get_or_404(parte_id)
    current_user_id = int(get_jwt_identity())
    if not _can_manage_all_partes() and parte.empleado_id != current_user_id:
        return jsonify({'msg': 'Acceso denegado'}), 403

    if parte.estado == EstadoParte.en_pausa:
        pausas = json.loads(parte.pausas) if parte.pausas else []
        # Buscar última pausa sin fin
        for pausa in reversed(pausas):
            if pausa[1] is None:
                pausa[1] = datetime.now().isoformat()
                break
        parte.pausas = json.dumps(pausas)
        parte.estado = EstadoParte.en_proceso
        db.session.commit()
    return jsonify({'estado': parte.estado.value})

# Analítica: partes por empleado y semana
@bp.route('/parte_trabajo/analitica', methods=['GET'])
@role_required('administrador', 'encargado')
def analitica_partes():
    empleado_id = request.args.get('empleado_id')
    fecha_inicio = request.args.get('fecha_inicio')
    fecha_fin = request.args.get('fecha_fin')
    query = ParteTrabajo.query
    if empleado_id:
        query = query.filter(ParteTrabajo.empleado_id == int(empleado_id))
    if fecha_inicio:
        fecha_inicio_dt = _parse_query_datetime(fecha_inicio)
        if not fecha_inicio_dt:
            return jsonify({'msg': 'fecha_inicio inválida'}), 400
        query = query.filter(ParteTrabajo.fecha_inicio >= fecha_inicio_dt)
    if fecha_fin:
        fecha_fin_dt = _parse_query_datetime(fecha_fin, end_of_day=True)
        if not fecha_fin_dt:
            return jsonify({'msg': 'fecha_fin inválida'}), 400
        query = query.filter(ParteTrabajo.fecha_fin <= fecha_fin_dt)
    partes = query.all()
    total_horas = sum([p.duracion_total() for p in partes])
    return jsonify({
        'total_partes': len(partes),
        'total_horas': total_horas,
        'promedio_horas': total_horas / len(partes) if partes else 0,
        'partes': [
            {
                'id': p.id,
                'coche_id': p.coche_id,
                'estado': p.estado.value,
                'duracion_horas': p.duracion_total()
            } for p in partes
        ]
    })
