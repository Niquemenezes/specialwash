from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from models.parte_trabajo import ParteTrabajo, EstadoParte
from models.coche import Coche
from models.cliente import Cliente
from models.user import User
from models.notificacion import Notificacion
from models.servicio_catalogo import ServicioCatalogo
from extensions import db
from datetime import datetime
from uuid import uuid4
import json
from models.base import now_madrid

from utils.auth_utils import WORKSHOP_ROLES, normalize_role, role_required, _dev_auth_bypass_enabled

bp = Blueprint('parte_trabajo', __name__)


def _current_role():
    claims = get_jwt() or {}
    role = normalize_role(claims.get('rol'))
    if role:
        return role

    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        user_id = None

    if user_id:
        user = User.query.get(user_id)
        role = normalize_role(getattr(user, 'rol', ''))
        if role:
            return role

    if _dev_auth_bypass_enabled():
        return 'administrador'

    return ''


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


def _sum_tiempo_servicios(servicios):
    if not isinstance(servicios, list):
        return 0
    total = 0
    for item in servicios:
        if not isinstance(item, dict):
            continue
        raw = item.get('tiempo_estimado_minutos', 0)
        try:
            mins = int(raw)
        except (TypeError, ValueError):
            mins = 0
        if mins <= 0:
            servicio_catalogo_id = item.get('servicio_catalogo_id')
            servicio_catalogo = None
            try:
                if servicio_catalogo_id is not None:
                    servicio_catalogo = ServicioCatalogo.query.get(int(servicio_catalogo_id))
            except (TypeError, ValueError):
                servicio_catalogo = None

            if servicio_catalogo is None:
                nombre = str(item.get('nombre') or '').strip()
                if nombre:
                    servicio_catalogo = ServicioCatalogo.query.filter(
                        ServicioCatalogo.nombre.ilike(nombre)
                    ).first()

            if servicio_catalogo and servicio_catalogo.tiempo_estimado_minutos:
                mins = int(servicio_catalogo.tiempo_estimado_minutos)
        if mins > 0:
            total += mins
    return total


def _serialize_parte(parte, include_sensitive=False):
    duracion_horas = parte.duracion_total()
    duracion_minutos = int(round(duracion_horas * 60))
    tiempo_estimado = int(parte.tiempo_estimado_minutos or 0)

    coche = parte.coche
    empleado = parte.empleado

    payload = {
        'id': parte.id,
        'coche_id': parte.coche_id,
        'inspeccion_id': parte.inspeccion_id,
        'servicio_catalogo_id': parte.servicio_catalogo_id,
        'matricula': coche.matricula if coche else None,
        'marca': coche.marca if coche else None,
        'modelo': coche.modelo if coche else None,
        'cliente_nombre': (coche.cliente.nombre if coche and coche.cliente else None),
        'empleado_id': parte.empleado_id,
        'empleado_nombre': empleado.nombre if empleado else None,
        'estado': parte.estado.value,
        'fecha_inicio': parte.fecha_inicio.isoformat() if parte.fecha_inicio else None,
        'fecha_fin': parte.fecha_fin.isoformat() if parte.fecha_fin else None,
        'observaciones': parte.observaciones,
        'tipo_tarea': getattr(parte, 'tipo_tarea', None),
        'es_tarea_interna': bool(getattr(parte, 'es_tarea_interna', False)),
        'lote_uid': getattr(parte, 'lote_uid', None),
        'pausas': parte.pausas,
        'duracion_horas': duracion_horas,
        'tiempo_estimado_minutos': tiempo_estimado,
    }
    if include_sensitive:
        payload.update({
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


def _get_or_create_internal_coche_id():
    """Retorna un coche técnico para registrar tareas internas sin coche operativo."""
    internal_plate = "INT-TAREAS"
    coche = Coche.query.filter_by(matricula=internal_plate).first()
    if coche:
        return coche.id

    cliente = Cliente.query.filter_by(nombre="TAREAS INTERNAS").first()
    if not cliente:
        cliente = Cliente(
            nombre="TAREAS INTERNAS",
            telefono="000000000",
            email=None,
            cif=None,
            direccion=None,
            notas="Cliente técnico para partes sin coche",
        )
        db.session.add(cliente)
        db.session.flush()

    coche = Coche(
        matricula=internal_plate,
        marca="INTERNO",
        modelo="TAREA",
        color=None,
        cliente_id=cliente.id,
        notas="Coche técnico para registrar tareas internas",
    )
    db.session.add(coche)
    db.session.flush()
    return coche.id


@bp.route('/parte_trabajo/interno', methods=['POST'])
@jwt_required()
def crear_parte_interno():
    """Permite registrar trabajo interno (sin coche operativo) y empezar a contar tiempo."""
    current_role = normalize_role(_current_role())
    allowed_roles = set(WORKSHOP_ROLES) | {'encargado', 'calidad', 'administrador'}
    if current_role not in allowed_roles:
        return jsonify({'msg': 'Acceso denegado'}), 403

    data = request.get_json() or {}
    observaciones = (data.get('observaciones') or '').strip()
    if not observaciones:
        return jsonify({'msg': 'Debes indicar la tarea realizada (ej. limpiar baño)'}), 400

    try:
        tiempo_estimado = _parse_tiempo_estimado_minutos(data.get('tiempo_estimado_minutos'))
    except ValueError as e:
        return jsonify({'msg': str(e)}), 400

    tipo_tarea_payload = normalize_role((data.get('tipo_tarea') or '').strip())
    tipo_tarea = tipo_tarea_payload or (current_role if current_role in WORKSHOP_ROLES else 'otro')

    try:
        current_user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return jsonify({'msg': 'Usuario inválido'}), 401

    coche_id = _get_or_create_internal_coche_id()
    parte = ParteTrabajo(
        coche_id=coche_id,
        empleado_id=current_user_id,
        estado=EstadoParte.en_proceso,
        fecha_inicio=now_madrid(),
        observaciones=observaciones,
        tiempo_estimado_minutos=tiempo_estimado,
        lote_uid=str(uuid4()),
        tipo_tarea=tipo_tarea,
        es_tarea_interna=True,
    )
    db.session.add(parte)
    db.session.commit()
    return jsonify(_serialize_parte(parte, include_sensitive=True)), 201


@bp.route('/parte_trabajo/coche/<int:coche_id>/sumarme', methods=['POST'])
@jwt_required()
def sumarme_a_coche_activo(coche_id):
    """Permite a un empleado crear e iniciar su propio parte en un coche con trabajo en curso."""
    current_role = normalize_role(_current_role())
    allowed_roles = set(WORKSHOP_ROLES) | {'encargado', 'calidad', 'administrador'}
    if current_role not in allowed_roles:
        return jsonify({'msg': 'Acceso denegado'}), 403

    coche = Coche.query.get(coche_id)
    if not coche:
        return jsonify({'msg': 'Coche no encontrado'}), 404

    data = request.get_json() or {}
    observaciones = (data.get('observaciones') or '').strip()
    if not observaciones:
        observaciones = 'Apoyo en trabajo del coche'

    try:
        tiempo_estimado = _parse_tiempo_estimado_minutos(data.get('tiempo_estimado_minutos'))
    except ValueError as e:
        return jsonify({'msg': str(e)}), 400

    try:
        current_user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return jsonify({'msg': 'Usuario inválido'}), 401

    # Si el usuario ya está activo en este coche, devolvemos ese parte para evitar duplicados.
    existente = ParteTrabajo.query.filter(
        ParteTrabajo.coche_id == coche_id,
        ParteTrabajo.empleado_id == current_user_id,
        ParteTrabajo.estado.in_([EstadoParte.en_proceso, EstadoParte.en_pausa]),
    ).order_by(ParteTrabajo.id.desc()).first()
    if existente:
        return jsonify(_serialize_parte(existente, include_sensitive=True)), 200

    tipo_tarea_payload = normalize_role((data.get('tipo_tarea') or '').strip())
    tipo_tarea = tipo_tarea_payload or (current_role if current_role in WORKSHOP_ROLES else 'otro')

    parte = ParteTrabajo(
        coche_id=coche_id,
        empleado_id=current_user_id,
        estado=EstadoParte.en_proceso,
        fecha_inicio=now_madrid(),
        observaciones=observaciones,
        tiempo_estimado_minutos=tiempo_estimado,
        lote_uid=str(uuid4()),
        tipo_tarea=tipo_tarea,
        es_tarea_interna=False,
    )
    db.session.add(parte)
    db.session.commit()
    return jsonify(_serialize_parte(parte, include_sensitive=True)), 201

# Crear parte de trabajo (solo admin/calidad)
@bp.route('/parte_trabajo', methods=['POST'])
@role_required('administrador', 'calidad')
def crear_parte_trabajo():
    data = request.get_json() or {}

    coche_id = data.get('coche_id')
    inspeccion_id = data.get('inspeccion_id')
    servicio_catalogo_id = data.get('servicio_catalogo_id')
    empleado_id = data.get('empleado_id')
    # opcional: None = sin asignar aún; el empleado lo tomará al hacer "Iniciar"
    observaciones = (data.get('observaciones') or '').strip()
    tipo_tarea = (data.get('tipo_tarea') or '').strip() or None
    servicios = data.get('servicios') if isinstance(data.get('servicios'), list) else []
    try:
        tiempo_estimado_payload = _parse_tiempo_estimado_minutos(data.get('tiempo_estimado_minutos'))
    except ValueError as e:
        return jsonify({'msg': str(e)}), 400

    tiempo_estimado_minutos = _sum_tiempo_servicios(servicios) if servicios else tiempo_estimado_payload

    if coche_id is None:
        return jsonify({'msg': 'Debes indicar el coche_id'}), 400

    try:
        inspeccion_id = int(inspeccion_id) if inspeccion_id not in (None, '') else None
    except (TypeError, ValueError):
        return jsonify({'msg': 'inspeccion_id inválido'}), 400

    try:
        servicio_catalogo_id = int(servicio_catalogo_id) if servicio_catalogo_id not in (None, '') else None
    except (TypeError, ValueError):
        return jsonify({'msg': 'servicio_catalogo_id inválido'}), 400

    coche = Coche.query.get(coche_id)
    if not coche:
        return jsonify({'msg': 'Coche no encontrado'}), 404

    # Validar empleado solo si fue indicado; si no, el parte queda sin asignar
    if empleado_id is not None:
        empleado = User.query.get(empleado_id)
        if not empleado:
            return jsonify({'msg': 'Empleado no encontrado'}), 404
        if not getattr(empleado, 'activo', True):
            return jsonify({'msg': 'El empleado está inactivo'}), 400
        if normalize_role(getattr(empleado, 'rol', '')) not in ASSIGNABLE_PARTE_ROLES:
            return jsonify({'msg': 'Solo se puede asignar a roles operativos'}), 400

    # Creación en lote (varios servicios / trabajos a la vez)
    if servicios:
        lote_uid = str(uuid4())
        partes_creados = []

        for item in servicios:
            if not isinstance(item, dict):
                continue
            tarea = (item.get('nombre') or '').strip()
            if not tarea:
                continue

            item_empleado_id = item.get('empleado_id', empleado_id)
            item_raw_emp = item.get('empleado_id')
            item_empleado_id = item_raw_emp if item_raw_emp is not None else empleado_id
            if item_empleado_id is not None:
                item_empleado = User.query.get(item_empleado_id)
                if not item_empleado:
                    return jsonify({'msg': f'Empleado no encontrado para tarea: {tarea}'}), 404
                if not getattr(item_empleado, 'activo', True):
                    return jsonify({'msg': f'El empleado asignado a {tarea} está inactivo'}), 400
                if normalize_role(getattr(item_empleado, 'rol', '')) not in ASSIGNABLE_PARTE_ROLES:
                    return jsonify({'msg': f'Rol inválido para tarea: {tarea}'}), 400

            try:
                tiempo_item = _parse_tiempo_estimado_minutos(item.get('tiempo_estimado_minutos'))
            except ValueError:
                tiempo_item = 0

            item_tipo_tarea = (item.get('tipo_tarea') or '').strip() or tipo_tarea or None
            item_inspeccion_id = item.get('inspeccion_id', inspeccion_id)
            item_servicio_catalogo_id = item.get('servicio_catalogo_id', servicio_catalogo_id)
            try:
                item_inspeccion_id = int(item_inspeccion_id) if item_inspeccion_id not in (None, '') else None
            except (TypeError, ValueError):
                return jsonify({'msg': f'inspeccion_id inválido para tarea: {tarea}'}), 400
            try:
                item_servicio_catalogo_id = int(item_servicio_catalogo_id) if item_servicio_catalogo_id not in (None, '') else None
            except (TypeError, ValueError):
                return jsonify({'msg': f'servicio_catalogo_id inválido para tarea: {tarea}'}), 400
            parte_item = ParteTrabajo(
                coche_id=int(coche_id),
                inspeccion_id=item_inspeccion_id,
                servicio_catalogo_id=item_servicio_catalogo_id,
                empleado_id=int(item_empleado_id) if item_empleado_id is not None else None,
                estado=EstadoParte.pendiente,
                observaciones=tarea,
                tiempo_estimado_minutos=tiempo_item,
                lote_uid=lote_uid,
                tipo_tarea=item_tipo_tarea,
            )
            db.session.add(parte_item)
            partes_creados.append(parte_item)

        if not partes_creados:
            return jsonify({'msg': 'Debes incluir al menos un servicio/tarea válido'}), 400

        db.session.commit()
        return jsonify({
            'lote_uid': lote_uid,
            'total_partes': len(partes_creados),
            'partes': [
                {
                    'id': p.id,
                    'coche_id': p.coche_id,
                    'empleado_id': p.empleado_id,
                    'estado': p.estado.value,
                    'observaciones': p.observaciones,
                    'tipo_tarea': p.tipo_tarea,
                    'tiempo_estimado_minutos': int(p.tiempo_estimado_minutos or 0),
                }
                for p in partes_creados
            ],
        }), 201

    # Creación individual
    parte = ParteTrabajo(
        coche_id=int(coche_id),
        inspeccion_id=inspeccion_id,
        servicio_catalogo_id=servicio_catalogo_id,
        empleado_id=int(empleado_id) if empleado_id is not None else None,
        estado=EstadoParte.pendiente,
        observaciones=observaciones,
        tiempo_estimado_minutos=tiempo_estimado_minutos,
        lote_uid=str(uuid4()),
        tipo_tarea=tipo_tarea,
    )
    db.session.add(parte)
    db.session.commit()
    return jsonify({'id': parte.id, 'lote_uid': parte.lote_uid, 'total_partes': 1}), 201

# Listar partes de trabajo (filtros por estado, coche, empleado)
@bp.route('/parte_trabajo', methods=['GET'])
@jwt_required()
def listar_partes_trabajo():
    estado = request.args.get('estado')
    empleado_id = request.args.get('empleado_id')
    coche_id = request.args.get('coche_id')
    tipo_tarea_filtro = request.args.get('tipo_tarea')
    query = ParteTrabajo.query
    tipo_tarea_normalizado = normalize_role(tipo_tarea_filtro) if tipo_tarea_filtro else ""

    from sqlalchemy import or_ as _or
    if not _can_manage_all_partes():
        current_user_id = int(get_jwt_identity())
        current_role = normalize_role(_current_role())
        # Empleados ven sus propios partes + todos los pendientes (para poder tomarlos)
        if estado == 'pendiente':
            pass  # sin filtro de empleado: todos los pendientes son visibles
        elif estado in ('en_proceso', 'en_pausa'):
            # Si filtra por su propio rol/tipo, permitimos ver activos de su rol
            # para coordinar trabajos en el mismo coche entre varios empleados.
            if tipo_tarea_normalizado and tipo_tarea_normalizado == current_role:
                pass
            else:
                query = query.filter(ParteTrabajo.empleado_id == current_user_id)
        else:
            query = query.filter(
                _or(
                    ParteTrabajo.empleado_id == current_user_id,
                    ParteTrabajo.estado == EstadoParte.pendiente,
                )
            )

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
    if tipo_tarea_filtro:
        tipo_normalizado = tipo_tarea_normalizado
        if tipo_normalizado == 'tapicero':
            # Compatibilidad con registros legacy que guardaron "tapiceria".
            query = query.filter(ParteTrabajo.tipo_tarea.in_(['tapicero', 'tapiceria']))
        else:
            query = query.filter(ParteTrabajo.tipo_tarea == tipo_normalizado)
    partes = query.all()
    include_sensitive = _can_manage_all_partes()
    return jsonify([_serialize_parte(p, include_sensitive=include_sensitive) for p in partes])


@bp.route('/parte_trabajo/<int:parte_id>', methods=['PUT'])
@role_required('administrador', 'calidad', 'encargado')
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


@bp.route('/parte_trabajo/<int:parte_id>', methods=['DELETE'])
@role_required('administrador', 'calidad', 'encargado')
def eliminar_parte_trabajo(parte_id):
    parte = ParteTrabajo.query.get_or_404(parte_id)

    try:
        db.session.delete(parte)
        db.session.commit()
        return jsonify({'msg': 'Parte eliminado correctamente'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'msg': f'No se pudo eliminar el parte: {str(e)}'}), 400

# Cambiar estado de parte de trabajo
@bp.route('/parte_trabajo/<int:parte_id>/estado', methods=['PUT'])
@jwt_required()
def cambiar_estado_parte(parte_id):
    data = request.get_json() or {}
    parte = ParteTrabajo.query.get_or_404(parte_id)
    current_user_id = int(get_jwt_identity())
    if not _can_manage_all_partes():
        if parte.empleado_id is None:
            # Parte sin asignar: el empleado que lo inicia se lo auto-asigna
            parte.empleado_id = current_user_id
        elif parte.empleado_id != current_user_id:
            return jsonify({'msg': 'Acceso denegado'}), 403

    nuevo_estado = data['estado']
    if nuevo_estado == 'en_proceso':
        parte.iniciar_trabajo()
    elif nuevo_estado == 'finalizado':
        if parte.estado == EstadoParte.en_pausa:
            pausas = json.loads(parte.pausas) if parte.pausas else []
            for pausa in reversed(pausas):
                if pausa[1] is None:
                    pausa[1] = now_madrid().isoformat()
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
        inicio_pausa = now_madrid().isoformat()
        # Guardar pausa
        pausas = json.loads(parte.pausas) if parte.pausas else []
        pausas.append([inicio_pausa, None])
        parte.pausas = json.dumps(pausas)
        parte.estado = EstadoParte.en_pausa
    elif nuevo_estado == 'pendiente':
        parte.estado = EstadoParte.pendiente
    db.session.commit()
    return jsonify({'estado': parte.estado.value})


@bp.route('/parte_trabajo/<int:parte_id>/tomar', methods=['PUT'])
@jwt_required()
def tomar_parte_trabajo(parte_id):
    parte = ParteTrabajo.query.get_or_404(parte_id)
    current_user_id = int(get_jwt_identity())

    if parte.estado != EstadoParte.pendiente:
        if parte.empleado_id == current_user_id:
            return jsonify({'ok': True, 'msg': 'Parte ya asignado a ti'}), 200
        return jsonify({'msg': 'Solo se pueden tomar partes pendientes'}), 409

    if parte.empleado_id != current_user_id:
        parte.empleado_id = current_user_id
        db.session.commit()

    return jsonify({'ok': True, 'empleado_id': parte.empleado_id}), 200

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
                pausa[1] = now_madrid().isoformat()
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


@bp.route('/parte_trabajo/reporte_empleados', methods=['GET'])
@role_required('administrador', 'calidad')
def reporte_empleados():
    """Tiempo trabajado por empleado con detalle de coche y tipo de tarea."""
    from collections import defaultdict
    fecha_inicio = request.args.get('fecha_inicio')
    fecha_fin = request.args.get('fecha_fin')
    query = ParteTrabajo.query.filter(ParteTrabajo.empleado_id.isnot(None))
    if fecha_inicio:
        dt = _parse_query_datetime(fecha_inicio)
        if dt:
            query = query.filter(ParteTrabajo.fecha_inicio >= dt)
    if fecha_fin:
        dt = _parse_query_datetime(fecha_fin, end_of_day=True)
        if dt:
            query = query.filter(ParteTrabajo.fecha_inicio <= dt)
    partes = query.all()
    por_empleado = defaultdict(list)
    for p in partes:
        por_empleado[p.empleado_id].append(p)
    resultado = []
    for emp_id, lista in por_empleado.items():
        emp = User.query.get(emp_id)
        nombre = emp.nombre if emp else f'ID {emp_id}'
        rol = getattr(emp, 'rol', '') if emp else ''
        total_minutos = sum(int(round(p.duracion_total() * 60)) for p in lista)
        total_minutos_interno = sum(
            int(round(p.duracion_total() * 60))
            for p in lista
            if bool(getattr(p, 'es_tarea_interna', False))
        )
        total_minutos_coche = max(total_minutos - total_minutos_interno, 0)
        detalle = []
        for p in lista:
            coche = p.coche
            es_interno = bool(getattr(p, 'es_tarea_interna', False))
            detalle.append({
                'parte_id': p.id,
                'coche_id': p.coche_id,
                'matricula': coche.matricula if coche else None,
                'marca': coche.marca if coche else None,
                'modelo': coche.modelo if coche else None,
                'tipo_tarea': p.tipo_tarea,
                'es_tarea_interna': es_interno,
                'estado': p.estado.value,
                'duracion_minutos': int(round(p.duracion_total() * 60)),
                'tiempo_estimado_minutos': int(p.tiempo_estimado_minutos or 0),
                'fecha_inicio': p.fecha_inicio.isoformat() if p.fecha_inicio else None,
                'fecha_fin': p.fecha_fin.isoformat() if p.fecha_fin else None,
            })
        resultado.append({
            'empleado_id': emp_id,
            'nombre': nombre,
            'rol': rol,
            'total_partes': len(lista),
            'total_minutos': total_minutos,
            'total_minutos_coche': total_minutos_coche,
            'total_minutos_interno': total_minutos_interno,
            'partes': detalle,
        })
    resultado.sort(key=lambda x: x['total_minutos'], reverse=True)
    return jsonify(resultado)
