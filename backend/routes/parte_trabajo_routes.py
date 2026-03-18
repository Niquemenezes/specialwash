from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from models.parte_trabajo import ParteTrabajo, EstadoParte
from models.coche import Coche
from models.user import User
from models.notificacion import Notificacion
from extensions import db
from datetime import datetime
import json

from utils.auth_utils import WORKSHOP_ROLES, normalize_role, role_required

bp = Blueprint('parte_trabajo', __name__)


def _current_role():
    claims = get_jwt() or {}
    return normalize_role(claims.get('rol'))


def _can_manage_all_partes():
    return _current_role() in {'administrador', 'calidad'}


ASSIGNABLE_PARTE_ROLES = set(WORKSHOP_ROLES) | {'encargado'}


def _parse_tiempo_estimado_minutos(value):
    if value in (None, ""):
        return 0
    try:
        minutos = int(value)
    except (TypeError, ValueError):
        raise ValueError('tiempo_estimado_minutos debe ser un numero entero')
    if minutos < 0:
        raise ValueError('tiempo_estimado_minutos no puede ser negativo')
    return minutos


def _serialize_parte(parte, include_sensitive=False):
    duracion_horas = parte.duracion_total()
    duracion_minutos = int(round(duracion_horas * 60))
    tiempo_estimado = int(parte.tiempo_estimado_minutos or 0)
    payload = {
        'id': parte.id,
        'coche_id': parte.coche_id,
        'empleado_id': parte.empleado_id,
        'estado': parte.estado.value,
        'fecha_inicio': parte.fecha_inicio.isoformat() if parte.fecha_inicio else None,
        'fecha_fin': parte.fecha_fin.isoformat() if parte.fecha_fin else None,
        'observaciones': parte.observaciones,
        'duracion_horas': duracion_horas,
    }
    if include_sensitive:
        payload.update({
            'tiempo_estimado_minutos': tiempo_estimado,
            'duracion_minutos': duracion_minutos,
            'desviacion_minutos': duracion_minutos - tiempo_estimado,
        })
    return payload


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
@role_required('administrador', 'calidad')
def crear_parte_trabajo():
    data = request.get_json() or {}

    coche_id = data.get('coche_id')
    empleado_id = data.get('empleado_id')
    observaciones = (data.get('observaciones') or '').strip()
    try:
        tiempo_estimado_minutos = _parse_tiempo_estimado_minutos(data.get('tiempo_estimado_minutos'))
    except ValueError as e:
        return jsonify({'msg': str(e)}), 400

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
    if normalize_role(getattr(empleado, 'rol', '')) not in ASSIGNABLE_PARTE_ROLES:
        return jsonify({'msg': 'Solo se puede asignar a roles operativos'}), 400

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
        observaciones=observaciones,
        tiempo_estimado_minutos=tiempo_estimado_minutos,
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
        try:
            empleado_id_int = int(empleado_id)
        except (TypeError, ValueError):
            return jsonify({'msg': 'empleado_id inválido'}), 400
        if not _can_manage_all_partes() and empleado_id_int != int(get_jwt_identity()):
            return jsonify({'msg': 'Acceso denegado'}), 403
        query = query.filter(ParteTrabajo.empleado_id == empleado_id_int)
    if coche_id:
        try:
            coche_id_int = int(coche_id)
        except (TypeError, ValueError):
            return jsonify({'msg': 'coche_id inválido'}), 400
        query = query.filter(ParteTrabajo.coche_id == coche_id_int)
    partes = query.all()
    include_sensitive = _can_manage_all_partes()
    return jsonify([_serialize_parte(p, include_sensitive=include_sensitive) for p in partes])


@bp.route('/parte_trabajo/<int:parte_id>', methods=['PUT'])
@role_required('administrador', 'calidad')
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
        if normalize_role(getattr(empleado, 'rol', '')) not in ASSIGNABLE_PARTE_ROLES:
            return jsonify({'msg': 'Solo se puede asignar a roles operativos'}), 400

        parte.empleado_id = empleado.id

    if 'observaciones' in data:
        parte.observaciones = (data.get('observaciones') or '').strip()

    if 'tiempo_estimado_minutos' in data:
        try:
            parte.tiempo_estimado_minutos = _parse_tiempo_estimado_minutos(data.get('tiempo_estimado_minutos'))
        except ValueError as e:
            return jsonify({'msg': str(e)}), 400

    db.session.commit()

    return jsonify(_serialize_parte(parte, include_sensitive=True))

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
        try:
            coche = Coche.query.get(parte.coche_id)
            empleado = User.query.get(parte.empleado_id)
            matricula = coche.matricula if coche else f"coche #{parte.coche_id}"
            nombre_empleado = empleado.nombre if empleado else "Empleado"
            notif = Notificacion(
                tipo="parte_finalizado",
                titulo=f"Parte finalizado: {matricula}",
                cuerpo=f"Empleado: {nombre_empleado} · Vehículo: {matricula}",
                ref_id=parte.id,
            )
            db.session.add(notif)
        except Exception:
            pass
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
@role_required('administrador', 'calidad')
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
    total_estimado_minutos = sum([int(p.tiempo_estimado_minutos or 0) for p in partes])
    total_real_minutos = sum([int(round(p.duracion_total() * 60)) for p in partes])
    return jsonify({
        'total_partes': len(partes),
        'total_horas': total_horas,
        'promedio_horas': total_horas / len(partes) if partes else 0,
        'total_estimado_minutos': total_estimado_minutos,
        'total_real_minutos': total_real_minutos,
        'total_desviacion_minutos': total_real_minutos - total_estimado_minutos,
        'partes': [
            {
                'id': p.id,
                'coche_id': p.coche_id,
                'estado': p.estado.value,
                'duracion_horas': p.duracion_total(),
                'tiempo_estimado_minutos': int(p.tiempo_estimado_minutos or 0),
                'duracion_minutos': int(round(p.duracion_total() * 60)),
            } for p in partes
        ]
    })
