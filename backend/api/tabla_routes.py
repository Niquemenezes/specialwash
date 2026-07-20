from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import logging
from datetime import datetime

from models import db
from models.inspeccion_recepcion import InspeccionRecepcion
from utils.inspeccion_helpers import role_required, _servicios_label, _fmt_fecha

tabla_bp = Blueprint('tabla', __name__, url_prefix='/api')


@tabla_bp.route("/tabla-registros", methods=["GET"])
@jwt_required()
def get_tabla_registros():
    """Devuelve las inspecciones del mes/año indicado en formato tabla."""
    mes = request.args.get("mes", type=int, default=datetime.now().month)
    anio = request.args.get("anio", type=int, default=datetime.now().year)

    inicio = datetime(anio, mes, 1)
    fin = datetime(anio + 1, 1, 1) if mes == 12 else datetime(anio, mes + 1, 1)

    inspecciones = (
        InspeccionRecepcion.query
        .filter(InspeccionRecepcion.fecha_inspeccion >= inicio,
                InspeccionRecepcion.fecha_inspeccion < fin)
        .order_by(InspeccionRecepcion.fecha_inspeccion.asc())
        .all()
    )

    result = []
    for i in inspecciones:
        precio = float(i.cobro_importe_pagado or 0)
        metodo = (i.cobro_metodo or "").capitalize()
        iva = round(precio * 0.21, 2) if metodo.lower() == "factura" and precio > 0 else 0

        estado = i.tabla_estado or ("Entregado" if i.entregado else "")

        result.append({
            "id": i.id,
            "fecha": _fmt_fecha(i.fecha_inspeccion),
            "modelo": i.coche_descripcion or "",
            "cliente": i.cliente_nombre or "",
            "matricula": i.matricula or "",
            "servicios": _servicios_label(i.servicios_aplicados),
            "precio": precio if precio > 0 else None,
            "iva": iva if iva > 0 else None,
            "metodo": metodo,
            "fecha_entrega": _fmt_fecha(i.fecha_entrega),
            "observaciones": i.averias_notas or "",
            "estado": estado,
            "es_concesionario": i.es_concesionario,
            "entregado": i.entregado,
        })

    return jsonify(result), 200


@tabla_bp.route("/tabla-registros/<int:inspeccion_id>", methods=["PATCH"])
@jwt_required()
@role_required("administrador", "calidad", "detailing")
def patch_tabla_registro(inspeccion_id):
    """Actualiza campos editables de la fila en la tabla de registros."""
    inspeccion = InspeccionRecepcion.query.get(inspeccion_id)
    if not inspeccion:
        return jsonify({"msg": "No encontrado"}), 404

    data = request.get_json() or {}
    campos_actualizados = []

    if "precio" in data:
        try:
            inspeccion.cobro_importe_pagado = float(data["precio"] or 0)
            campos_actualizados.append("precio")
        except (ValueError, TypeError):
            return jsonify({"msg": "Precio inválido"}), 400

    if "metodo" in data:
        inspeccion.cobro_metodo = (data["metodo"] or "").lower() or None
        campos_actualizados.append("metodo")

    if "observaciones" in data:
        inspeccion.averias_notas = data["observaciones"] or None
        campos_actualizados.append("observaciones")

    if "estado" in data:
        inspeccion.tabla_estado = data["estado"] or None
        campos_actualizados.append("estado")

    if "fecha_entrega" in data:
        fecha_str = (data["fecha_entrega"] or "").strip()
        if fecha_str:
            try:
                from dateutil import parser as dateparser
                inspeccion.fecha_entrega = dateparser.parse(fecha_str, dayfirst=True)
            except Exception:
                try:
                    inspeccion.fecha_entrega = datetime.strptime(fecha_str, "%d/%m/%Y")
                except Exception:
                    return jsonify({"msg": "Formato de fecha inválido (dd/mm/yyyy)"}), 400
        else:
            inspeccion.fecha_entrega = None
        campos_actualizados.append("fecha_entrega")

    db.session.commit()

    # Sincronizar con Google Sheets
    try:
        from services.google_sheets_service import actualizar_tabla_inspeccion as _sheets_tabla
        _sheets_tabla(inspeccion, campos_actualizados)
    except Exception as e:
        logging.warning(f"[Google Sheets] Error sync tabla: {e}")

    precio = float(inspeccion.cobro_importe_pagado or 0)
    metodo = (inspeccion.cobro_metodo or "").capitalize()
    iva = round(precio * 0.21, 2) if metodo.lower() == "factura" and precio > 0 else 0
    estado = inspeccion.tabla_estado or ("Entregado" if inspeccion.entregado else "")

    return jsonify({
        "id": inspeccion.id,
        "precio": precio if precio > 0 else None,
        "iva": iva if iva > 0 else None,
        "metodo": metodo,
        "fecha_entrega": _fmt_fecha(inspeccion.fecha_entrega),
        "observaciones": inspeccion.averias_notas or "",
        "estado": estado,
    }), 200
