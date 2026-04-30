from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from models.parte_trabajo import ParteTrabajo, EstadoParte
from models.parte_trabajo_colaborador import ParteTrabajoColaborador
from models.coche import Coche
from models.cliente import Cliente
from models.user import User
from models.notificacion import Notificacion
from models.servicio_catalogo import ServicioCatalogo
from extensions import db
from datetime import datetime
from uuid import uuid4
import json
from models.base import now_madrid, attach_madrid

from utils.auth_utils import WORKSHOP_ROLES, normalize_role, role_required, _dev_auth_bypass_enabled

bp = Blueprint('parte_trabajo', __name__)

FASES_PARTE = {'preparacion', 'pintura', 'montaje', 'limpieza'}


def _normalize_fase(value, *, default=None):
    raw = str(value or '').strip().lower()
    if not raw:
        return default
    if raw in {'preparacion', 'preparación', 'prep'}:
        return 'preparacion'
    if raw in {'pintura', 'pintar'}:
        return 'pintura'
    if raw in {'montaje', 'montar'}:
        return 'montaje'
    if raw in {'limpieza', 'limpiar'}:
        return 'limpieza'
    return default


def _default_fase_for_parte(*, es_tarea_interna=False):
    return None if es_tarea_interna else 'preparacion'


def _close_open_pause_if_needed(parte):
    if parte.estado != EstadoParte.en_pausa:
        return
    pausas = json.loads(parte.pausas) if parte.pausas else []
    for pausa in reversed(pausas):
        if len(pausa) > 1 and pausa[1] is None:
            pausa[1] = now_madrid().isoformat()
            break
    parte.pausas = json.dumps(pausas)


def _current_user_id():
    try:
        return int(get_jwt_identity())
    except (TypeError, ValueError):
        return None


def _serialize_colaborador(colaborador):
    duracion_horas = 0
    if colaborador.fecha_inicio:
        # Usar datetimes naive (como los almacena now_madrid) para evitar comparación naive vs aware
        inicio = colaborador.fecha_inicio if colaborador.fecha_inicio.tzinfo is None else colaborador.fecha_inicio.replace(tzinfo=None)
        fin_raw = colaborador.fecha_fin if colaborador.fecha_fin else now_madrid()
        fin = fin_raw if fin_raw.tzinfo is None else fin_raw.replace(tzinfo=None)
        if inicio and fin and fin >= inicio:
            duracion_horas = max((fin - inicio).total_seconds(), 0) / 3600

    return {
        'id': colaborador.id,
        'empleado_id': colaborador.empleado_id,
        'empleado_nombre': colaborador.empleado.nombre if colaborador.empleado else None,
        'estado': colaborador.estado.value if colaborador.estado else EstadoParte.pendiente.value,
        'fecha_inicio': attach_madrid(colaborador.fecha_inicio).isoformat() if colaborador.fecha_inicio else None,
        'fecha_fin': attach_madrid(colaborador.fecha_fin).isoformat() if colaborador.fecha_fin else None,
        'observaciones': (colaborador.observaciones or '').strip() or None,
        'pausas': colaborador.pausas,
        'duracion_horas': duracion_horas,
        'duracion_minutos': int(round(duracion_horas * 60)),
    }


def _painting_part_supports_collaboration(parte):
    # El flujo completo de pintura se trabaja por coche y por fase.
    return _parte_usa_flujo_pintura(parte) and not bool(getattr(parte, 'es_tarea_interna', False))


def _find_my_colaborador(parte, user_id):
    if not parte or not user_id:
        return None
    return (
        ParteTrabajoColaborador.query.filter_by(parte_id=parte.id, empleado_id=user_id)
        .order_by(ParteTrabajoColaborador.id.desc())
        .first()
    )


def _get_or_create_colaborador(parte, user_id, *, observaciones=None):
    colaborador = _find_my_colaborador(parte, user_id)
    if colaborador:
        if observaciones is not None and not (colaborador.observaciones or '').strip():
            colaborador.observaciones = (observaciones or '').strip() or None
        return colaborador

    estado_inicial = (
        EstadoParte.en_proceso
        if getattr(parte, 'estado', None) == EstadoParte.en_proceso
        else EstadoParte.pendiente
    )
    colaborador = ParteTrabajoColaborador(
        parte_id=parte.id,
        empleado_id=user_id,
        estado=estado_inicial,
        fecha_inicio=now_madrid() if estado_inicial == EstadoParte.en_proceso else None,
        observaciones=(observaciones or '').strip() or None,
    )
    db.session.add(colaborador)
    db.session.flush()
    return colaborador


def _set_colaborador_en_proceso(colaborador):
    colaborador.estado = EstadoParte.en_proceso
    if not colaborador.fecha_inicio:
        colaborador.fecha_inicio = now_madrid()


def _set_colaborador_en_pausa(colaborador):
    pausas = json.loads(colaborador.pausas) if colaborador.pausas else []
    pausas.append([now_madrid().isoformat(), None])
    colaborador.pausas = json.dumps(pausas)
    colaborador.estado = EstadoParte.en_pausa


def _quitar_pausa_colaborador(colaborador):
    pausas = json.loads(colaborador.pausas) if colaborador.pausas else []
    for pausa in reversed(pausas):
        if pausa and len(pausa) >= 2 and pausa[1] is None:
            pausa[1] = now_madrid().isoformat()
            break
    colaborador.pausas = json.dumps(pausas)
    colaborador.estado = EstadoParte.en_proceso


def _close_open_pause_colaborador_if_needed(colaborador):
    if colaborador.estado != EstadoParte.en_pausa:
        return
    pausas = json.loads(colaborador.pausas) if colaborador.pausas else []
    for pausa in reversed(pausas):
        if pausa and len(pausa) >= 2 and pausa[1] is None:
            pausa[1] = now_madrid().isoformat()
            break
    colaborador.pausas = json.dumps(pausas)


def _set_colaborador_finalizado(colaborador):
    _close_open_pause_colaborador_if_needed(colaborador)
    colaborador.estado = EstadoParte.finalizado
    colaborador.fecha_fin = now_madrid()


def _sync_estado_parte_con_colaboradores(parte):
    colaboradores = ParteTrabajoColaborador.query.filter_by(parte_id=parte.id).all()
    if not colaboradores:
        return

    estados = [c.estado for c in colaboradores if c.estado]
    if any(estado == EstadoParte.en_proceso for estado in estados):
        parte.estado = EstadoParte.en_proceso
        if not parte.fecha_inicio:
            parte.fecha_inicio = now_madrid()
        return
    if any(estado == EstadoParte.en_pausa for estado in estados):
        parte.estado = EstadoParte.en_pausa
        if not parte.fecha_inicio:
            parte.fecha_inicio = now_madrid()
        return
    if any(estado == EstadoParte.pendiente for estado in estados):
        parte.estado = EstadoParte.pendiente
        return

    parte.estado = EstadoParte.finalizado
    if not parte.fecha_fin:
        parte.fecha_fin = now_madrid()


def _find_existing_next_phase_parte(parte, next_fase, *, observaciones_override=None):
    query = ParteTrabajo.query.filter(
        ParteTrabajo.coche_id == parte.coche_id,
        ParteTrabajo.id != parte.id,
        ParteTrabajo.estado != EstadoParte.finalizado,
        ParteTrabajo.es_tarea_interna == bool(getattr(parte, 'es_tarea_interna', False)),
        ParteTrabajo.fase == next_fase,
    )
    lote_uid = getattr(parte, 'lote_uid', None)
    observaciones = (observaciones_override if observaciones_override is not None else getattr(parte, 'observaciones', '')) or ''
    observaciones = observaciones.strip()
    if lote_uid:
        query = query.filter(ParteTrabajo.lote_uid == lote_uid)
        if observaciones:
            query = query.filter(ParteTrabajo.observaciones == observaciones)
        elif getattr(parte, 'servicio_catalogo_id', None) is not None:
            query = query.filter(ParteTrabajo.servicio_catalogo_id == parte.servicio_catalogo_id)
    elif observaciones:
        query = query.filter(ParteTrabajo.observaciones == observaciones)
    elif getattr(parte, 'servicio_catalogo_id', None) is not None:
        query = query.filter(ParteTrabajo.servicio_catalogo_id == parte.servicio_catalogo_id)
    return query.order_by(ParteTrabajo.id.desc()).first()


def _crear_o_recuperar_parte_siguiente_fase(parte, next_fase, *, observaciones_override=None, force_new=False):
    if not force_new:
        existente = _find_existing_next_phase_parte(parte, next_fase, observaciones_override=observaciones_override)
        if existente:
            if next_fase == 'pintura' and existente.tipo_tarea != 'pintura':
                existente.tipo_tarea = 'pintura'
            return existente

    next_tipo_tarea = 'pintura' if next_fase == 'pintura' else parte.tipo_tarea
    observaciones = (observaciones_override if observaciones_override is not None else parte.observaciones) or ''
    observaciones = observaciones.strip() or parte.observaciones

    nuevo = ParteTrabajo(
        coche_id=parte.coche_id,
        inspeccion_id=parte.inspeccion_id,
        servicio_catalogo_id=parte.servicio_catalogo_id,
        empleado_id=None,
        estado=EstadoParte.pendiente,
        observaciones=observaciones,
        tiempo_estimado_minutos=int(parte.tiempo_estimado_minutos or 0),
        lote_uid=parte.lote_uid or str(uuid4()),
        tipo_tarea=next_tipo_tarea,
        fase=next_fase,
        es_tarea_interna=bool(getattr(parte, 'es_tarea_interna', False)),
    )
    db.session.add(nuevo)
    db.session.flush()
    return nuevo


def _parte_usa_flujo_pintura(parte):
    return normalize_role(getattr(parte, 'tipo_tarea', '') or '') == 'pintura'


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


def _role_tarea_values(role):
    normalized = normalize_role(role)
    if not normalized:
        return []
    if normalized == 'tapicero':
        return ['tapicero', 'tapiceria']
    return [normalized]


def _employee_pending_visibility_filter(role):
    role_values = _role_tarea_values(role)
    if not role_values:
        return None

    from sqlalchemy import and_ as _and
    return _and(
        ParteTrabajo.empleado_id.is_(None),
        ParteTrabajo.estado == EstadoParte.pendiente,
        ParteTrabajo.tipo_tarea.in_(role_values),
    )


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


def _crear_notificacion_repaso_si_corresponde(parte, nombre_empleado='Empleado'):
    """Avisa cuando ya no quedan partes pendientes para el coche y pasa a repaso."""
    coche_id = getattr(parte, 'coche_id', None)
    if not coche_id:
        return

    partes_pendientes = (
        ParteTrabajo.query.filter(
            ParteTrabajo.coche_id == coche_id,
            ParteTrabajo.id != parte.id,
            ParteTrabajo.estado != EstadoParte.finalizado,
        ).count()
    )
    if partes_pendientes > 0:
        return

    ref_id = parte.inspeccion_id or coche_id
    existente = (
        Notificacion.query.filter_by(tipo='repaso', ref_id=ref_id, leida=False)
        .order_by(Notificacion.created_at.desc())
        .first()
    )
    if existente:
        return

    coche = Coche.query.get(coche_id)
    matricula = coche.matricula if coche else f'coche #{coche_id}'
    cliente_nombre = (
        ((coche.cliente.nombre or '').strip())
        if coche and getattr(coche, 'cliente', None)
        else ''
    ) or 'Sin cliente'

    notif = Notificacion(
        tipo='repaso',
        titulo=f'🔔 Vehículo listo para repasar: {matricula}',
        cuerpo=(
            f'Cliente: {cliente_nombre} · '
            f'Todos los trabajos están terminados · '
            f'Calidad ya puede repasarlo · '
            f'Último cierre: {nombre_empleado}'
        ),
        ref_id=ref_id,
    )
    db.session.add(notif)


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
        'fecha_inicio': attach_madrid(parte.fecha_inicio).isoformat() if parte.fecha_inicio else None,
        'fecha_fin': attach_madrid(parte.fecha_fin).isoformat() if parte.fecha_fin else None,
        'observaciones': parte.observaciones,
        'tipo_tarea': getattr(parte, 'tipo_tarea', None),
        'fase': _normalize_fase(getattr(parte, 'fase', None), default=_default_fase_for_parte(es_tarea_interna=bool(getattr(parte, 'es_tarea_interna', False)))),
        'es_tarea_interna': bool(getattr(parte, 'es_tarea_interna', False)),
        'lote_uid': getattr(parte, 'lote_uid', None),
        'pausas': parte.pausas,
        'duracion_horas': duracion_horas,
        'tiempo_estimado_minutos': tiempo_estimado,
        'prioridad': int(getattr(parte, 'prioridad', 0) or 0),
    }
    colaboradores = []
    if _painting_part_supports_collaboration(parte):
        colaboradores = [_serialize_colaborador(c) for c in getattr(parte, 'colaboradores', [])]
    payload['colaboradores'] = colaboradores
    # Total labour hours = sum of each collaborator's individual time.
    # Different from duracion_horas (wall-clock elapsed), which measures how long the car was in this phase.
    horas_trabajadas_total = sum(c.get('duracion_horas', 0) for c in colaboradores) if colaboradores else duracion_horas
    payload['horas_trabajadas_total'] = round(horas_trabajadas_total, 4)
    payload['minutos_trabajados_total'] = int(round(horas_trabajadas_total * 60))
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
        fase=_default_fase_for_parte(es_tarea_interna=True),
        es_tarea_interna=True,
    )
    db.session.add(parte)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al guardar en base de datos"}), 500
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

    current_user_id = _current_user_id()
    if not current_user_id:
        return jsonify({'msg': 'Usuario inválido'}), 401

    parte_pintura_compartida = (
        ParteTrabajo.query.filter(
            ParteTrabajo.coche_id == coche_id,
            ParteTrabajo.es_tarea_interna == False,
            ParteTrabajo.tipo_tarea == 'pintura',
            ParteTrabajo.estado != EstadoParte.finalizado,
        )
        .order_by(ParteTrabajo.id.desc())
        .first()
    )
    if parte_pintura_compartida:
        colaborador = _get_or_create_colaborador(
            parte_pintura_compartida,
            current_user_id,
            observaciones=observaciones,
        )
        if colaborador.estado == EstadoParte.finalizado:
            colaborador.fecha_fin = None
        _set_colaborador_en_proceso(colaborador)
        _sync_estado_parte_con_colaboradores(parte_pintura_compartida)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            return jsonify({"msg": "Error al guardar en base de datos"}), 500
        return jsonify(_serialize_parte(parte_pintura_compartida, include_sensitive=True)), 200

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
        fase=_default_fase_for_parte(es_tarea_interna=False),
        es_tarea_interna=False,
    )
    db.session.add(parte)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al guardar en base de datos"}), 500
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
    fase = _normalize_fase(data.get('fase'), default=_default_fase_for_parte(es_tarea_interna=False))
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
            item_fase = _normalize_fase(item.get('fase'), default=fase)
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
                fase=item_fase,
            )
            db.session.add(parte_item)
            partes_creados.append(parte_item)

        if not partes_creados:
            return jsonify({'msg': 'Debes incluir al menos un servicio/tarea válido'}), 400

        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            return jsonify({"msg": "Error al guardar en base de datos"}), 500
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
        fase=fase,
    )
    db.session.add(parte)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al guardar en base de datos"}), 500
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
        own_filter = ParteTrabajo.empleado_id == current_user_id
        pending_visible_filter = _employee_pending_visibility_filter(current_role)
        shared_paint_filter = None
        if current_role == 'pintura':
            from sqlalchemy import and_ as _and
            shared_paint_filter = _and(
                ParteTrabajo.tipo_tarea == 'pintura',
                ParteTrabajo.es_tarea_interna == False,
            )
        allowed_role_values = set(_role_tarea_values(current_role))

        if tipo_tarea_filtro and allowed_role_values and tipo_tarea_normalizado not in allowed_role_values:
            return jsonify({'msg': 'Solo puedes ver trabajos de tu rol'}), 403

        if estado == 'pendiente':
            if pending_visible_filter is not None:
                filtros = [own_filter, pending_visible_filter]
                if shared_paint_filter is not None:
                    filtros.append(shared_paint_filter)
                query = query.filter(_or(*filtros))
            else:
                query = query.filter(_or(own_filter, shared_paint_filter) if shared_paint_filter is not None else own_filter)
        elif estado in ('en_proceso', 'en_pausa'):
            if shared_paint_filter is not None and (not tipo_tarea_normalizado or tipo_tarea_normalizado == 'pintura'):
                # Include own partes (any fase) AND shared painting partes in fase=pintura.
                # Without own_filter, a pintura parte in fase=preparacion disappears after being started.
                query = query.filter(_or(own_filter, shared_paint_filter))
            elif tipo_tarea_normalizado and tipo_tarea_normalizado in allowed_role_values:
                query = query.filter(ParteTrabajo.tipo_tarea.in_(list(allowed_role_values)))
            else:
                query = query.filter(own_filter)
        else:
            if pending_visible_filter is not None:
                filtros = [own_filter, pending_visible_filter]
                if shared_paint_filter is not None:
                    filtros.append(shared_paint_filter)
                query = query.filter(_or(*filtros))
            else:
                query = query.filter(_or(own_filter, shared_paint_filter) if shared_paint_filter is not None else own_filter)

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

    # Filtrar partes base "fantasma" de pintura: pendiente + sin empleado + sin fecha_inicio
    # que corresponden a servicios contratados nunca asignados individualmente.
    # Si ya hay partes finalizados de pintura para ese coche, el trabajo está hecho → ocultarlos.
    if estado == 'pendiente':
        coche_ids_base = {
            p.coche_id for p in partes
            if p.coche_id
            and not p.empleado_id
            and not p.fecha_inicio
            and not p.es_tarea_interna
        }
        if coche_ids_base:
            finalizados_pintura = ParteTrabajo.query.filter(
                ParteTrabajo.coche_id.in_(coche_ids_base),
                ParteTrabajo.tipo_tarea == 'pintura',
                ParteTrabajo.estado == EstadoParte.finalizado,
                ParteTrabajo.es_tarea_interna == False,
                ParteTrabajo.empleado_id.isnot(None),
            ).with_entities(ParteTrabajo.coche_id).distinct().all()
            coches_finalizados = {row[0] for row in finalizados_pintura}
            if coches_finalizados:
                partes = [
                    p for p in partes
                    if not (
                        p.coche_id in coches_finalizados
                        and not p.empleado_id
                        and not p.fecha_inicio
                        and p.estado == EstadoParte.pendiente
                        and not p.es_tarea_interna
                        and not p.fase  # solo partes base sin fase explícita en BD
                    )
                ]

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

    if 'tipo_tarea' in data:
        tipo = normalize_role(data.get('tipo_tarea') or '')
        if not tipo:
            return jsonify({'msg': 'tipo_tarea inválido'}), 400
        parte.tipo_tarea = tipo

    if 'fase' in data:
        fase = _normalize_fase(data.get('fase'))
        if not fase and not bool(getattr(parte, 'es_tarea_interna', False)):
            return jsonify({'msg': 'fase inválida'}), 400
        parte.fase = fase

    if 'observaciones' in data:
        parte.observaciones = (data.get('observaciones') or '').strip()

    if 'tiempo_estimado_minutos' in data:
        try:
            parte.tiempo_estimado_minutos = _parse_tiempo_estimado_minutos(data.get('tiempo_estimado_minutos'))
        except ValueError as e:
            return jsonify({'msg': str(e)}), 400

    if 'prioridad' in data:
        try:
            p = int(data['prioridad'])
            if p not in (0, 1, 2):
                raise ValueError()
            parte.prioridad = p
        except (TypeError, ValueError):
            return jsonify({'msg': 'prioridad debe ser 0, 1 o 2'}), 400

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al guardar en base de datos"}), 500

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
    siguiente = None
    current_user_id = _current_user_id()
    if not current_user_id:
        return jsonify({'msg': 'Usuario inválido'}), 401
    if not _can_manage_all_partes():
        if _painting_part_supports_collaboration(parte):
            if parte.empleado_id is None:
                parte.empleado_id = current_user_id
        else:
            if parte.empleado_id is None:
                # Parte sin asignar: el empleado que lo inicia se lo auto-asigna
                parte.empleado_id = current_user_id
            elif parte.empleado_id != current_user_id:
                return jsonify({'msg': 'Acceso denegado'}), 403

    nuevo_estado = data['estado']
    observaciones_estado = (data.get('observaciones') or '').strip()
    fase_actual = _normalize_fase(getattr(parte, 'fase', None), default=_default_fase_for_parte(es_tarea_interna=bool(getattr(parte, 'es_tarea_interna', False))))
    if _painting_part_supports_collaboration(parte) and nuevo_estado != 'pasar_a_pintura':
        colaborador = _get_or_create_colaborador(
            parte,
            current_user_id,
            observaciones=observaciones_estado,
        )
        if nuevo_estado == 'en_proceso':
            if observaciones_estado:
                parte.observaciones = observaciones_estado
            if parte.empleado_id is None:
                parte.empleado_id = current_user_id
            _set_colaborador_en_proceso(colaborador)
            if not parte.fecha_inicio:
                parte.fecha_inicio = now_madrid()
            _sync_estado_parte_con_colaboradores(parte)
        elif nuevo_estado == 'en_pausa':
            if colaborador.estado != EstadoParte.en_proceso:
                return jsonify({'msg': 'Solo puedes pausar tu trabajo en curso'}), 400
            _set_colaborador_en_pausa(colaborador)
            _sync_estado_parte_con_colaboradores(parte)
        elif nuevo_estado in {'finalizado', 'finalizar_y_siguiente'}:
            if colaborador.estado not in {EstadoParte.en_proceso, EstadoParte.en_pausa}:
                return jsonify({'msg': 'Solo puedes finalizar tu participación si está activa o en pausa'}), 400
            _set_colaborador_finalizado(colaborador)
            _sync_estado_parte_con_colaboradores(parte)
            if parte.estado == EstadoParte.finalizado:
                fase_actual = _normalize_fase(
                    parte.fase,
                    default=_default_fase_for_parte(es_tarea_interna=bool(getattr(parte, 'es_tarea_interna', False)))
                )
                if nuevo_estado == 'finalizar_y_siguiente':
                    siguiente_fase = _normalize_fase(data.get('siguiente_fase'))
                    if not siguiente_fase:
                        return jsonify({'msg': 'Debes indicar la siguiente fase'}), 400
                    siguiente_observaciones = (data.get('siguiente_observaciones') or '').strip()
                    if not siguiente_observaciones:
                        return jsonify({'msg': 'Describe lo que falta por hacer'}), 400
                    siguiente = _crear_o_recuperar_parte_siguiente_fase(
                        parte,
                        siguiente_fase,
                        observaciones_override=siguiente_observaciones,
                        force_new=True,
                    )
                else:
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
                        _crear_notificacion_repaso_si_corresponde(parte, nombre_empleado=nombre_empleado)
                    except Exception:
                        pass
        else:
            return jsonify({'msg': f'Estado inválido para colaboración: {nuevo_estado}'}), 400
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            return jsonify({"msg": "Error al guardar en base de datos"}), 500
        return jsonify({
            'estado': parte.estado.value,
            'colaboradores': [_serialize_colaborador(c) for c in getattr(parte, 'colaboradores', [])],
            'siguiente_fase': siguiente.fase if siguiente else None,
            'siguiente_parte_id': siguiente.id if siguiente else None,
        })
    if nuevo_estado == 'pasar_a_pintura':
        return jsonify({'msg': 'El flujo antiguo ya no está disponible. Usa "Coche listo" o "Queda trabajo" al finalizar la fase.'}), 400
    if nuevo_estado == 'en_proceso':
        parte.iniciar_trabajo()
    elif nuevo_estado in {'finalizado', 'finalizar_y_siguiente'}:
        _close_open_pause_if_needed(parte)
        parte.finalizar_trabajo()
        if nuevo_estado == 'finalizar_y_siguiente':
            siguiente_fase = _normalize_fase(data.get('siguiente_fase'))
            if not siguiente_fase:
                return jsonify({'msg': 'Debes indicar la siguiente fase'}), 400
            siguiente_observaciones = (data.get('siguiente_observaciones') or '').strip()
            if not siguiente_observaciones:
                return jsonify({'msg': 'Describe lo que falta por hacer'}), 400
            siguiente = _crear_o_recuperar_parte_siguiente_fase(
                parte,
                siguiente_fase,
                observaciones_override=siguiente_observaciones,
                force_new=True,
            )
        else:
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
                _crear_notificacion_repaso_si_corresponde(parte, nombre_empleado=nombre_empleado)
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
        parte.fecha_fin = None
        parte.empleado_id = None
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"msg": "Error al guardar en base de datos"}), 500
    return jsonify({
        'estado': parte.estado.value,
        'siguiente_fase': siguiente.fase if siguiente else None,
        'siguiente_parte_id': siguiente.id if siguiente else None,
    })


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
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            return jsonify({"msg": "Error al guardar en base de datos"}), 500

    return jsonify({'ok': True, 'empleado_id': parte.empleado_id}), 200

# Quitar pausa (empleado vuelve a en_proceso)
@bp.route('/parte_trabajo/<int:parte_id>/quitar_pausa', methods=['PUT'])
@jwt_required()
def quitar_pausa(parte_id):
    parte = ParteTrabajo.query.get_or_404(parte_id)
    current_user_id = _current_user_id()
    if not current_user_id:
        return jsonify({'msg': 'Usuario inválido'}), 401

    if _painting_part_supports_collaboration(parte):
        colaborador = _find_my_colaborador(parte, current_user_id)
        if not colaborador and not _can_manage_all_partes():
            return jsonify({'msg': 'Acceso denegado'}), 403
        if colaborador and colaborador.estado == EstadoParte.en_pausa:
            _quitar_pausa_colaborador(colaborador)
            _sync_estado_parte_con_colaboradores(parte)
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
                return jsonify({"msg": "Error al guardar en base de datos"}), 500
        return jsonify({'estado': parte.estado.value})

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
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            return jsonify({"msg": "Error al guardar en base de datos"}), 500
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


def _colab_minutos_individuales(colab):
    """Minutos reales que trabajó este colaborador (descontando pausas propias)."""
    if not colab.fecha_inicio:
        return 0
    def _naive(dt):
        if dt is None:
            return None
        return dt.replace(tzinfo=None) if dt.tzinfo is not None else dt

    inicio = _naive(colab.fecha_inicio)
    fin = _naive(colab.fecha_fin) if colab.fecha_fin else now_madrid()
    if not inicio or not fin or fin <= inicio:
        return 0
    total_seg = max((fin - inicio).total_seconds(), 0)
    pausas = json.loads(colab.pausas) if colab.pausas else []
    for pausa in pausas:
        if not pausa or len(pausa) < 2 or not pausa[0]:
            continue
        try:
            p_inicio = _naive(datetime.fromisoformat(pausa[0]))
            p_fin = _naive(datetime.fromisoformat(pausa[1])) if pausa[1] else now_madrid()
            if p_inicio and p_fin and p_fin > p_inicio:
                total_seg -= (p_fin - p_inicio).total_seconds()
        except (ValueError, TypeError):
            pass
    return int(round(max(total_seg, 0) / 60))


@bp.route('/parte_trabajo/reporte_empleados', methods=['GET'])
@role_required('administrador', 'calidad')
def reporte_empleados():
    """Tiempo trabajado por empleado con detalle de coche y tipo de tarea.
    Para partes colaborativos (pintura) usa el tiempo individual de cada colaborador,
    no el tiempo de reloj del parte, para reflejar la aportación real de cada persona."""
    from collections import defaultdict
    fecha_inicio_param = request.args.get('fecha_inicio')
    fecha_fin_param = request.args.get('fecha_fin')
    query = ParteTrabajo.query
    if fecha_inicio_param:
        dt = _parse_query_datetime(fecha_inicio_param)
        if dt:
            query = query.filter(ParteTrabajo.fecha_inicio >= dt)
    if fecha_fin_param:
        dt = _parse_query_datetime(fecha_fin_param, end_of_day=True)
        if dt:
            query = query.filter(ParteTrabajo.fecha_inicio <= dt)
    partes = query.all()

    # emp_id -> list of detail dicts
    por_empleado = defaultdict(list)

    for p in partes:
        coche = p.coche
        es_interno = bool(getattr(p, 'es_tarea_interna', False))
        base = {
            'parte_id': p.id,
            'coche_id': p.coche_id,
            'matricula': coche.matricula if coche else None,
            'marca': coche.marca if coche else None,
            'modelo': coche.modelo if coche else None,
            'tipo_tarea': p.tipo_tarea,
            'fase': _normalize_fase(getattr(p, 'fase', None), default=_default_fase_for_parte(es_tarea_interna=es_interno)),
            'observaciones': (p.observaciones or '').strip() or None,
            'es_tarea_interna': es_interno,
            'estado': p.estado.value,
            'tiempo_estimado_minutos': int(p.tiempo_estimado_minutos or 0),
            # duracion_minutos_coche = reloj de pared del parte (para saber cuánto tardó el coche en esa fase)
            'duracion_minutos_coche': int(round(p.duracion_total() * 60)),
            'fecha_inicio': attach_madrid(p.fecha_inicio).isoformat() if p.fecha_inicio else None,
            'fecha_fin': attach_madrid(p.fecha_fin).isoformat() if p.fecha_fin else None,
        }

        if _painting_part_supports_collaboration(p):
            # Tiempo individual por colaborador
            colaboradores = getattr(p, 'colaboradores', []) or []
            for colab in colaboradores:
                if not colab.empleado_id:
                    continue
                mins = _colab_minutos_individuales(colab)
                entry = dict(base)
                entry['duracion_minutos'] = mins
                entry['fecha_inicio'] = attach_madrid(colab.fecha_inicio).isoformat() if colab.fecha_inicio else base['fecha_inicio']
                entry['fecha_fin'] = attach_madrid(colab.fecha_fin).isoformat() if colab.fecha_fin else base['fecha_fin']
                por_empleado[colab.empleado_id].append(entry)
        else:
            if not p.empleado_id:
                continue
            entry = dict(base)
            entry['duracion_minutos'] = int(round(p.duracion_total() * 60))
            por_empleado[p.empleado_id].append(entry)

    resultado = []
    for emp_id, detalle in por_empleado.items():
        emp = User.query.get(emp_id)
        nombre = emp.nombre if emp else f'ID {emp_id}'
        rol = getattr(emp, 'rol', '') if emp else ''
        total_minutos = sum(d['duracion_minutos'] for d in detalle)
        total_minutos_interno = sum(d['duracion_minutos'] for d in detalle if d['es_tarea_interna'])
        total_minutos_coche = max(total_minutos - total_minutos_interno, 0)
        detalle.sort(key=lambda item: item.get('fecha_inicio') or '')
        resultado.append({
            'empleado_id': emp_id,
            'nombre': nombre,
            'rol': rol,
            'total_partes': len(detalle),
            'total_minutos': total_minutos,
            'total_minutos_coche': total_minutos_coche,
            'total_minutos_interno': total_minutos_interno,
            'partes': detalle,
        })
    resultado.sort(key=lambda x: x['total_minutos'], reverse=True)
    return jsonify(resultado)


@bp.route('/parte_trabajo/reporte_coches', methods=['GET'])
@role_required('administrador', 'calidad')
def reporte_coches():
    """Agrega tiempo de trabajo por vehículo.
    - minutos_persona: suma real de tiempo individual de cada trabajador (para saber cuánto costó en mano de obra)
    - minutos_reloj: tiempo de reloj de pared del coche en cada fase (para saber cuánto tardó el coche)
    """
    fecha_inicio_param = request.args.get('fecha_inicio')
    fecha_fin_param = request.args.get('fecha_fin')
    query = ParteTrabajo.query
    if fecha_inicio_param:
        dt = _parse_query_datetime(fecha_inicio_param)
        if dt:
            query = query.filter(ParteTrabajo.fecha_inicio >= dt)
    if fecha_fin_param:
        dt = _parse_query_datetime(fecha_fin_param, end_of_day=True)
        if dt:
            query = query.filter(ParteTrabajo.fecha_inicio <= dt)
    partes = query.all()

    coches = {}
    for p in partes:
        if not p.coche_id:
            continue
        cid = p.coche_id
        if cid not in coches:
            coche = p.coche
            cliente = getattr(coche, 'cliente', None) if coche else None
            coches[cid] = {
                'coche_id': cid,
                'matricula': coche.matricula if coche else None,
                'marca': coche.marca if coche else None,
                'modelo': coche.modelo if coche else None,
                'cliente_nombre': cliente.nombre if cliente else None,
                'minutos_persona': 0,
                'minutos_reloj': 0,
                'trabajadores': set(),
                'fases': set(),
            }

        es_interno = bool(getattr(p, 'es_tarea_interna', False))
        fase = _normalize_fase(
            getattr(p, 'fase', None),
            default=_default_fase_for_parte(es_tarea_interna=es_interno),
        )
        if fase:
            coches[cid]['fases'].add(fase)

        coches[cid]['minutos_reloj'] += int(round(p.duracion_total() * 60))

        if _painting_part_supports_collaboration(p):
            for colab in (getattr(p, 'colaboradores', []) or []):
                if not colab.empleado_id:
                    continue
                coches[cid]['minutos_persona'] += _colab_minutos_individuales(colab)
                coches[cid]['trabajadores'].add(colab.empleado_id)
        else:
            if p.empleado_id:
                coches[cid]['minutos_persona'] += p.duracion_total_minutos()
                coches[cid]['trabajadores'].add(p.empleado_id)

    resultado = []
    for cid, data in coches.items():
        resultado.append({
            'coche_id': cid,
            'matricula': data['matricula'],
            'marca': data['marca'],
            'modelo': data['modelo'],
            'cliente_nombre': data['cliente_nombre'],
            'minutos_persona': data['minutos_persona'],
            'horas_persona': round(data['minutos_persona'] / 60, 2),
            'minutos_reloj': data['minutos_reloj'],
            'horas_reloj': round(data['minutos_reloj'] / 60, 2),
            'num_trabajadores': len(data['trabajadores']),
            'fases': sorted(data['fases']),
        })

    resultado.sort(key=lambda x: (x['matricula'] or ''))
    return jsonify(resultado)


@bp.route('/parte_trabajo/empleado', methods=['GET'])
@jwt_required()
def listar_partes_empleado():
    """Devuelve los partes del empleado autenticado.
    Para empleados operativos incluye también trabajos pendientes sin asignar de su propio rol."""
    current_user_id = int(get_jwt_identity())
    current_role = normalize_role(_current_role())
    empleado_id_param = request.args.get('empleado_id')
    estado_param = request.args.get('estado')

    if empleado_id_param:
        try:
            target_id = int(empleado_id_param)
        except (TypeError, ValueError):
            return jsonify({'msg': 'empleado_id inválido'}), 400
        if not _can_manage_all_partes() and target_id != current_user_id:
            return jsonify({'msg': 'Acceso denegado'}), 403
    else:
        target_id = current_user_id

    query = ParteTrabajo.query.filter(ParteTrabajo.empleado_id == target_id)
    if not _can_manage_all_partes() and target_id == current_user_id:
        pending_visible_filter = _employee_pending_visibility_filter(current_role)
        shared_paint_filter = None
        if current_role == 'pintura':
            from sqlalchemy import and_ as _and, or_ as _or
            shared_paint_filter = _and(
                ParteTrabajo.tipo_tarea == 'pintura',
                ParteTrabajo.es_tarea_interna == False,
            )
        if pending_visible_filter is not None:
            filtros = [
                ParteTrabajo.empleado_id == target_id,
                pending_visible_filter,
            ]
            if shared_paint_filter is not None:
                filtros.append(shared_paint_filter)
            query = ParteTrabajo.query.filter(_or(*filtros))
        elif shared_paint_filter is not None:
            query = ParteTrabajo.query.filter(
                _or(
                    ParteTrabajo.empleado_id == target_id,
                    shared_paint_filter,
                )
            )

    if estado_param:
        try:
            query = query.filter(ParteTrabajo.estado == EstadoParte(estado_param))
        except ValueError:
            return jsonify({'msg': f'Estado inválido: {estado_param}'}), 400

    partes = query.order_by(ParteTrabajo.id.desc()).all()
    include_sensitive = _can_manage_all_partes() or target_id == current_user_id
    return jsonify([_serialize_parte(p, include_sensitive=include_sensitive) for p in partes])


@bp.route('/parte_trabajo/empleado/<int:empleado_id>/siguiente', methods=['GET'])
@jwt_required()
def siguiente_parte_empleado(empleado_id):
    """Devuelve el próximo parte pendiente para el empleado (sugerencia)."""
    current_user_id = int(get_jwt_identity())
    if not _can_manage_all_partes() and empleado_id != current_user_id:
        return jsonify({'msg': 'Acceso denegado'}), 403

    siguiente = ParteTrabajo.query.filter(
        ParteTrabajo.empleado_id == empleado_id,
        ParteTrabajo.estado == EstadoParte.pendiente,
    ).order_by(ParteTrabajo.prioridad.desc(), ParteTrabajo.id.asc()).first()

    if not siguiente and not _can_manage_all_partes():
        role_values = _role_tarea_values(_current_role())
        if role_values:
            siguiente = ParteTrabajo.query.filter(
                ParteTrabajo.empleado_id.is_(None),
                ParteTrabajo.estado == EstadoParte.pendiente,
                ParteTrabajo.tipo_tarea.in_(role_values),
            ).order_by(ParteTrabajo.prioridad.desc(), ParteTrabajo.id.asc()).first()

    if not siguiente:
        return jsonify(None), 200

    return jsonify(_serialize_parte(siguiente)), 200


@bp.route('/parte_trabajo/coche/<int:coche_id>/urgente', methods=['PUT'])
@role_required('administrador', 'calidad')
def set_coche_urgente(coche_id):
    data = request.get_json() or {}
    urgente = bool(data.get('urgente', False))
    prioridad_val = 2 if urgente else 0
    partes = ParteTrabajo.query.filter(
        ParteTrabajo.coche_id == coche_id,
        ParteTrabajo.estado != EstadoParte.finalizado,
    ).all()
    for p in partes:
        p.prioridad = prioridad_val
    db.session.commit()
    return jsonify({'ok': True, 'urgente': urgente, 'partes_actualizados': len(partes)})
