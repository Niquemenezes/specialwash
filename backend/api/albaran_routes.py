"""Rutas para gestión de albaranes y configuración de empresa."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from datetime import datetime
import json
import logging

from models import db
from models.inspeccion_recepcion import InspeccionRecepcion
from models.empresa_config import EmpresaConfig
from models.cliente import Cliente
from models.servicio_catalogo import ServicioCatalogo
from utils.inspeccion_helpers import role_required

albaran_bp = Blueprint("albaran", __name__, url_prefix="/api")


def _get_or_create_config():
    cfg = EmpresaConfig.query.get(1)
    if not cfg:
        cfg = EmpresaConfig(
            id=1,
            nombre="Special Wash Car Solutions, S.R.L.",
            nombre_comercial="SW Studio",
            cif="B21816566",
            direccion="Calle Salvador Dalí, 22, 29700, Vélez-Málaga, ES",
            email="alejandro@specialwash.es",
            telefono="645811313",
            albaran_prefijo="SW",
            albaran_siguiente_numero=1,
        )
        db.session.add(cfg)
        db.session.commit()
    return cfg


def _generar_numero_albaran(cfg):
    anio = datetime.now().year
    num = cfg.albaran_siguiente_numero
    return f"{cfg.albaran_prefijo}{anio}-{num:05d}"


def _serialize_albaran(inspeccion):
    """Devuelve los datos completos de un albarán para el documento."""
    cfg = _get_or_create_config()
    cliente = Cliente.query.get(inspeccion.cliente_id) if inspeccion.cliente_id else None

    nombre_cliente = (
        (cliente.nombre_fiscal or cliente.nombre) if cliente
        else inspeccion.cliente_nombre
    )

    return {
        "id": inspeccion.id,
        "albaran_numero": inspeccion.albaran_numero,
        "albaran_fecha": inspeccion.albaran_fecha.strftime("%d/%m/%Y") if inspeccion.albaran_fecha else "",
        "cliente": {
            "nombre": nombre_cliente,
            "nombre_comercial": cliente.nombre if cliente else inspeccion.cliente_nombre,
            "cif": cliente.cif if cliente else "",
            "telefono": cliente.telefono if cliente else inspeccion.cliente_telefono,
            "email": cliente.email if cliente else "",
            "direccion": cliente.direccion if cliente else "",
        },
        "empresa": cfg.to_dict(),
        "vehiculo": {
            "modelo": inspeccion.coche_descripcion or "",
            "matricula": inspeccion.matricula or "",
        },
        "lineas": json.loads(inspeccion.albaran_precios) if inspeccion.albaran_precios else [],
    }


@albaran_bp.route("/albaranes/pendientes", methods=["GET"])
@jwt_required()
@role_required("administrador")
def get_albaranes_pendientes():
    """Inspecciones de concesionarios sin albarán emitido."""
    q = request.args.get("q", "").strip().lower()
    inspecciones = (
        InspeccionRecepcion.query
        .filter(InspeccionRecepcion.es_concesionario.is_(True))
        .filter(InspeccionRecepcion.albaran_numero.is_(None))
        .order_by(InspeccionRecepcion.fecha_inspeccion.desc())
        .all()
    )

    result = []
    for i in inspecciones:
        if q and q not in (i.cliente_nombre or "").lower() and q not in (i.matricula or "").lower():
            continue
        try:
            servicios = json.loads(i.servicios_aplicados or "[]")
        except Exception:
            servicios = []
        result.append({
            "id": i.id,
            "fecha": i.fecha_inspeccion.strftime("%d/%m/%Y") if i.fecha_inspeccion else "",
            "cliente_nombre": i.cliente_nombre or "",
            "cliente_id": i.cliente_id,
            "matricula": i.matricula or "",
            "modelo": i.coche_descripcion or "",
            "entregado": i.entregado,
            "servicios": [
                {
                    "nombre": (s.get("nombre") or s.get("descripcion") or "").strip(),
                    "servicio_id": s.get("id") or s.get("servicio_catalogo_id"),
                }
                for s in servicios if isinstance(s, dict)
            ],
        })

    return jsonify(result), 200


@albaran_bp.route("/albaranes/emitidos", methods=["GET"])
@jwt_required()
@role_required("administrador")
def get_albaranes_emitidos():
    """Inspecciones con albarán emitido."""
    q = request.args.get("q", "").strip().lower()
    inspecciones = (
        InspeccionRecepcion.query
        .filter(InspeccionRecepcion.albaran_numero.isnot(None))
        .order_by(InspeccionRecepcion.albaran_fecha.desc())
        .all()
    )

    result = []
    for i in inspecciones:
        if q and q not in (i.cliente_nombre or "").lower() \
                and q not in (i.matricula or "").lower() \
                and q not in (i.albaran_numero or "").lower():
            continue

        lineas = json.loads(i.albaran_precios or "[]")
        base = sum(float(l.get("precio_base", 0)) for l in lineas)
        iva = round(base * 0.21, 2)

        result.append({
            "id": i.id,
            "albaran_numero": i.albaran_numero,
            "albaran_fecha": i.albaran_fecha.strftime("%d/%m/%Y") if i.albaran_fecha else "",
            "cliente_nombre": i.cliente_nombre or "",
            "matricula": i.matricula or "",
            "modelo": i.coche_descripcion or "",
            "base_imponible": base,
            "iva": iva,
            "total": round(base + iva, 2),
        })

    return jsonify(result), 200


@albaran_bp.route("/albaranes/<int:inspeccion_id>", methods=["GET"])
@jwt_required()
@role_required("administrador")
def get_albaran(inspeccion_id):
    """Datos completos del albarán para el documento."""
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion or not inspeccion.albaran_numero:
        return jsonify({"msg": "Albarán no encontrado"}), 404
    return jsonify(_serialize_albaran(inspeccion)), 200


@albaran_bp.route("/albaranes/precios/<int:inspeccion_id>", methods=["GET"])
@jwt_required()
@role_required("administrador")
def get_precios_sugeridos(inspeccion_id):
    """Devuelve los servicios de la inspección con precios del catálogo para el modal de creación."""
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404

    try:
        servicios = json.loads(inspeccion.servicios_aplicados or "[]")
    except Exception:
        servicios = []

    lineas = []
    for s in servicios:
        if not isinstance(s, dict):
            continue
        nombre = (s.get("nombre") or s.get("descripcion") or "").strip()
        if not nombre:
            continue
        servicio_id = s.get("id") or s.get("servicio_catalogo_id")
        precio_base = 0.0
        if servicio_id:
            cat = ServicioCatalogo.query.get(servicio_id)
            if cat:
                precio_base = float(cat.precio_base or 0)

        lineas.append({
            "nombre": nombre,
            "servicio_id": servicio_id,
            "precio_base": precio_base,
            "subtitulo": f"{inspeccion.coche_descripcion or ''} - {inspeccion.matricula or ''}".strip(" -"),
        })

    return jsonify(lineas), 200


@albaran_bp.route("/albaranes/<int:inspeccion_id>", methods=["POST"])
@jwt_required()
@role_required("administrador")
def crear_albaran(inspeccion_id):
    """Genera el albarán para una inspección."""
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion:
        return jsonify({"msg": "Inspección no encontrada"}), 404
    if inspeccion.albaran_numero:
        return jsonify({"msg": f"Esta inspección ya tiene el albarán {inspeccion.albaran_numero}"}), 400

    data = request.get_json() or {}
    lineas = data.get("lineas", [])
    if not lineas:
        return jsonify({"msg": "Debes incluir al menos una línea de servicio con precio"}), 400

    cfg = _get_or_create_config()
    numero = _generar_numero_albaran(cfg)

    lineas_guardadas = []
    for l in lineas:
        nombre = (l.get("nombre") or "").strip()
        if not nombre:
            continue
        precio_base = float(l.get("precio_base") or 0)
        subtitulo = (l.get("subtitulo") or f"{inspeccion.coche_descripcion or ''} - {inspeccion.matricula or ''}").strip(" -")
        lineas_guardadas.append({
            "nombre": nombre,
            "subtitulo": subtitulo,
            "cantidad": 1,
            "precio_base": precio_base,
            "iva_pct": 21,
            "precio_total": round(precio_base * 1.21, 2),
        })

    inspeccion.albaran_numero = numero
    inspeccion.albaran_fecha = datetime.now()
    inspeccion.albaran_precios = json.dumps(lineas_guardadas)

    cfg.albaran_siguiente_numero += 1
    db.session.commit()

    logging.info(f"[Albarán] {numero} creado para inspección {inspeccion_id} ({inspeccion.matricula})")
    return jsonify(_serialize_albaran(inspeccion)), 201


@albaran_bp.route("/albaranes/<int:inspeccion_id>", methods=["DELETE"])
@jwt_required()
@role_required("administrador")
def anular_albaran(inspeccion_id):
    """Anula un albarán (solo admin)."""
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion or not inspeccion.albaran_numero:
        return jsonify({"msg": "Albarán no encontrado"}), 404

    numero = inspeccion.albaran_numero
    inspeccion.albaran_numero = None
    inspeccion.albaran_fecha = None
    inspeccion.albaran_precios = None
    db.session.commit()

    logging.info(f"[Albarán] {numero} anulado")
    return jsonify({"ok": True, "numero": numero}), 200


# ── Empresa Config ────────────────────────────────────────────────────────────

@albaran_bp.route("/empresa-config", methods=["GET"])
@jwt_required()
@role_required("administrador")
def get_empresa_config():
    cfg = _get_or_create_config()
    return jsonify(cfg.to_dict()), 200


@albaran_bp.route("/empresa-config", methods=["PUT"])
@jwt_required()
@role_required("administrador")
def update_empresa_config():
    cfg = _get_or_create_config()
    data = request.get_json() or {}
    campos = ["nombre", "nombre_comercial", "cif", "direccion", "email", "telefono",
              "albaran_prefijo", "albaran_siguiente_numero", "logo_url"]
    for campo in campos:
        if campo in data:
            setattr(cfg, campo, data[campo])
    db.session.commit()
    return jsonify(cfg.to_dict()), 200
