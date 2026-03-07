from datetime import datetime, timedelta
import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import desc, func

from models import Entrada, Producto, Proveedor, Salida, db
from services.stock_service import (
    actualizar_stock_entrada,
    actualizar_stock_salida,
    calcular_precio_salida_desde_ultima_entrada,
    calcular_totales_entrada,
    revertir_stock_entrada,
    revertir_stock_salida,
)
from utils.auth_utils import role_required

almacen_bp = Blueprint("almacen_routes", __name__)

try:
    from PIL import Image
    import pytesseract
except Exception:  # pragma: no cover - optional dependency
    Image = None
    pytesseract = None


def _parse_decimal(value):
    if value is None:
        return None
    candidate = value.strip().replace(" ", "")
    if not candidate:
        return None
    if "," in candidate and "." in candidate:
        candidate = candidate.replace(".", "").replace(",", ".")
    else:
        candidate = candidate.replace(",", ".")
    try:
        return round(float(candidate), 2)
    except ValueError:
        return None


def _extract_ocr_fields(raw_text):
    text = raw_text or ""
    compact = " ".join(text.split())

    def first_match(patterns):
        for pattern in patterns:
            match = re.search(pattern, compact, flags=re.IGNORECASE)
            if match:
                return match.group(1)
        return None

    numero_doc = first_match([
        r"(?:albaran|albarán|factura|num(?:ero)?\.?|n[ºo])\s*[:#-]?\s*([A-Z0-9\-/]{3,})",
    ])
    cantidad_raw = first_match([
        r"(?:cantidad|uds?|unidades)\s*[:#-]?\s*(\d{1,6})",
    ])
    iva_raw = first_match([
        r"(?:iva|i\.v\.a\.)\s*[:#-]?\s*(\d{1,2}(?:[\.,]\d{1,2})?)\s*%",
    ])
    precio_raw = first_match([
        r"(?:precio\s*unit(?:ario)?|p\.?u\.?)\s*[:#-]?\s*(\d{1,8}(?:[\.,]\d{1,4})?)",
        r"(?:€/ud|eur/ud)\s*[:#-]?\s*(\d{1,8}(?:[\.,]\d{1,4})?)",
    ])

    return {
        "numero_albaran": numero_doc,
        "cantidad": int(cantidad_raw) if cantidad_raw else None,
        "porcentaje_iva": _parse_decimal(iva_raw),
        "precio_unitario": _parse_decimal(precio_raw),
        "texto_ocr": text[:4000],
    }


@almacen_bp.route("/registro-entrada", methods=["POST"])
@role_required("administrador")
def registrar_entrada():
    data = request.get_json() or {}

    producto_id = data.get("producto_id")
    cantidad = int(data.get("cantidad", 0))

    if not producto_id or cantidad <= 0:
        return jsonify({"msg": "Datos inválidos"}), 400

    producto = Producto.query.get_or_404(producto_id)
    actualizar_stock_entrada(producto, cantidad)

    precio_unitario = float(data.get("precio_unitario") or 0)
    porcentaje_iva = float(data.get("porcentaje_iva") or 21)
    descuento_pct = float(data.get("descuento_porcentaje") or 0)
    totales = calcular_totales_entrada(cantidad, precio_unitario, porcentaje_iva, descuento_pct)

    if precio_unitario > 0:
        producto.precio_referencia = precio_unitario

    entrada = Entrada(
        producto_id=producto.id,
        producto_nombre=producto.nombre,
        proveedor_id=data.get("proveedor_id"),
        cantidad=cantidad,
        numero_albaran=data.get("numero_albaran"),
        precio_sin_iva=totales["precio_sin_iva"],
        porcentaje_iva=totales["porcentaje_iva"],
        valor_iva=totales["valor_iva"],
        precio_con_iva=totales["precio_con_iva"],
    )

    db.session.add(entrada)
    db.session.commit()

    return jsonify({"msg": "Entrada registrada", "producto": producto.to_dict()}), 201


@almacen_bp.route("/registro-entrada/ocr-sugerencia", methods=["POST"])
@role_required("administrador")
def ocr_sugerencia_entrada():
    if pytesseract is None or Image is None:
        return jsonify({"msg": "OCR no disponible en el servidor"}), 503

    file = request.files.get("file")
    if not file:
        return jsonify({"msg": "Debe adjuntar una imagen"}), 400

    try:
        image = Image.open(file.stream)
        text = pytesseract.image_to_string(image, lang="spa+eng")
        sugerencia = _extract_ocr_fields(text)
        return jsonify(sugerencia), 200
    except pytesseract.TesseractNotFoundError:
        return jsonify({"msg": "Tesseract OCR no esta instalado en el servidor"}), 503
    except Exception:
        return jsonify({"msg": "No se pudo procesar el documento OCR"}), 400


@almacen_bp.route("/registro-entrada", methods=["GET"])
@jwt_required()
def entradas_list():
    query = Entrada.query

    desde = request.args.get("desde")
    if desde:
        try:
            fecha_desde = datetime.strptime(desde, "%Y-%m-%d")
            query = query.filter(Entrada.fecha >= fecha_desde)
        except ValueError:
            pass

    hasta = request.args.get("hasta")
    if hasta:
        try:
            fecha_hasta = datetime.strptime(hasta, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(Entrada.fecha < fecha_hasta)
        except ValueError:
            pass

    proveedor_id = request.args.get("proveedor_id")
    if proveedor_id:
        try:
            query = query.filter(Entrada.proveedor_id == int(proveedor_id))
        except (TypeError, ValueError):
            pass

    producto_id = request.args.get("producto_id")
    if producto_id:
        try:
            query = query.filter(Entrada.producto_id == int(producto_id))
        except (TypeError, ValueError):
            pass

    q = request.args.get("q")
    if q:
        search = f"%{q.strip()}%"
        producto_ids = [p.id for p in Producto.query.filter(Producto.nombre.ilike(search)).all()]
        proveedor_ids = [p.id for p in Proveedor.query.filter(Proveedor.nombre.ilike(search)).all()]

        query = query.filter(
            db.or_(
                Entrada.producto_id.in_(producto_ids) if producto_ids else False,
                Entrada.proveedor_id.in_(proveedor_ids) if proveedor_ids else False,
                Entrada.numero_albaran.ilike(search),
                Entrada.numero_documento.ilike(search),
            )
        )

    return jsonify([e.to_dict() for e in query.order_by(Entrada.fecha.desc()).all()])


@almacen_bp.route("/registro-entrada/<int:eid>", methods=["PUT"])
@role_required("administrador")
def entrada_update(eid):
    entrada = Entrada.query.get_or_404(eid)
    data = request.get_json() or {}

    nuevo_producto_id = data.get("producto_id")
    cantidad_original = entrada.cantidad
    nueva_cantidad = int(data.get("cantidad", cantidad_original))
    cambio_cantidad = nueva_cantidad != cantidad_original

    if nuevo_producto_id and nuevo_producto_id != entrada.producto_id:
        producto_anterior = Producto.query.get(entrada.producto_id)
        if producto_anterior:
            revertir_stock_entrada(producto_anterior, entrada.cantidad)

        nuevo_producto = Producto.query.get_or_404(nuevo_producto_id)
        actualizar_stock_entrada(nuevo_producto, nueva_cantidad)
        entrada.producto_id = nuevo_producto_id
        entrada.producto_nombre = nuevo_producto.nombre
    elif cambio_cantidad:
        producto = Producto.query.get(entrada.producto_id)
        if producto:
            diferencia = nueva_cantidad - cantidad_original
            actualizar_stock_entrada(producto, diferencia)

    entrada.proveedor_id = data.get("proveedor_id", entrada.proveedor_id)
    entrada.cantidad = nueva_cantidad
    entrada.numero_albaran = data.get("numero_albaran", entrada.numero_albaran)

    if "precio_unitario" in data:
        precio_unitario = float(data.get("precio_unitario") or 0)
        porcentaje_iva = float(data.get("porcentaje_iva") or 21)
        descuento_pct = float(data.get("descuento_porcentaje") or 0)
        totales = calcular_totales_entrada(nueva_cantidad, precio_unitario, porcentaje_iva, descuento_pct)
        entrada.precio_sin_iva = totales["precio_sin_iva"]
        entrada.porcentaje_iva = totales["porcentaje_iva"]
        entrada.valor_iva = totales["valor_iva"]
        entrada.precio_con_iva = totales["precio_con_iva"]
    elif "precio_sin_iva" in data:
        precio_sin_iva = float(data.get("precio_sin_iva") or 0)
        porcentaje_iva = float(data.get("porcentaje_iva") or 21)
        valor_iva = round(precio_sin_iva * (porcentaje_iva / 100), 2)
        precio_con_iva = round(precio_sin_iva + valor_iva, 2)

        entrada.precio_sin_iva = precio_sin_iva
        entrada.porcentaje_iva = porcentaje_iva
        entrada.valor_iva = valor_iva
        entrada.precio_con_iva = precio_con_iva
    elif cambio_cantidad:
        if entrada.precio_sin_iva and cantidad_original > 0:
            precio_unitario_original = entrada.precio_sin_iva / cantidad_original
            porcentaje_iva = entrada.porcentaje_iva or 21
            nuevo_precio_sin_iva = round(precio_unitario_original * nueva_cantidad, 2)
            nuevo_valor_iva = round(nuevo_precio_sin_iva * (porcentaje_iva / 100), 2)
            nuevo_precio_con_iva = round(nuevo_precio_sin_iva + nuevo_valor_iva, 2)

            entrada.precio_sin_iva = nuevo_precio_sin_iva
            entrada.valor_iva = nuevo_valor_iva
            entrada.precio_con_iva = nuevo_precio_con_iva

    db.session.commit()
    return jsonify(entrada.to_dict()), 200


@almacen_bp.route("/registro-entrada/<int:eid>", methods=["DELETE"])
@role_required("administrador")
def entrada_delete(eid):
    entrada = Entrada.query.get_or_404(eid)

    producto = Producto.query.get(entrada.producto_id)
    if producto:
        revertir_stock_entrada(producto, entrada.cantidad)

    try:
        db.session.delete(entrada)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar la entrada"}), 400
    return jsonify({"msg": "Entrada eliminada"}), 200


@almacen_bp.route("/registro-salida", methods=["POST"])
@role_required("administrador", "empleado")
def registrar_salida():
    data = request.get_json() or {}

    producto_id = data.get("producto_id")
    cantidad = int(data.get("cantidad", 0))

    if not producto_id or cantidad <= 0:
        return jsonify({"msg": "Datos inválidos"}), 400

    producto = Producto.query.get(producto_id)
    if not producto:
        return jsonify({"msg": "Producto no encontrado"}), 404

    if producto.stock_actual < cantidad:
        return jsonify({"msg": "Stock insuficiente"}), 400

    uid = int(data.get("usuario_id") or get_jwt_identity())
    precio_unitario = calcular_precio_salida_desde_ultima_entrada(producto.id)
    precio_total = round(precio_unitario * cantidad, 2) if precio_unitario is not None else None

    actualizar_stock_salida(producto, cantidad)

    salida = Salida(
        producto_id=producto.id,
        producto_nombre=producto.nombre,
        usuario_id=uid,
        cantidad=cantidad,
        observaciones=data.get("observaciones"),
        precio_unitario=precio_unitario,
        precio_total=precio_total,
    )

    db.session.add(salida)
    db.session.commit()

    return jsonify({**salida.to_dict(), "producto": producto.to_dict()}), 201


@almacen_bp.route("/salidas", methods=["GET"])
@jwt_required()
def salidas_list():
    return jsonify([s.to_dict() for s in Salida.query.order_by(Salida.fecha.desc()).all()])


@almacen_bp.route("/registro-salida/<int:sid>", methods=["PUT"])
@role_required("administrador")
def salida_update(sid):
    salida = Salida.query.get_or_404(sid)
    data = request.get_json() or {}

    nuevo_producto_id = data.get("producto_id")
    cantidad_original = salida.cantidad
    nueva_cantidad = int(data.get("cantidad", cantidad_original))
    cambio_cantidad = nueva_cantidad != cantidad_original

    if nuevo_producto_id and nuevo_producto_id != salida.producto_id:
        producto_anterior = Producto.query.get(salida.producto_id)
        if producto_anterior:
            revertir_stock_salida(producto_anterior, salida.cantidad)

        nuevo_producto = Producto.query.get_or_404(nuevo_producto_id)
        actualizar_stock_salida(nuevo_producto, nueva_cantidad)
        salida.producto_id = nuevo_producto_id
        salida.producto_nombre = nuevo_producto.nombre
    elif cambio_cantidad:
        producto = Producto.query.get(salida.producto_id)
        if producto:
            diferencia = cantidad_original - nueva_cantidad
            actualizar_stock_entrada(producto, diferencia)

    salida.cantidad = nueva_cantidad
    salida.observaciones = data.get("observaciones", salida.observaciones)

    if "precio_unitario" in data:
        precio_unit = data.get("precio_unitario")
        if precio_unit is not None:
            salida.precio_unitario = float(precio_unit)
            salida.precio_total = round(salida.precio_unitario * nueva_cantidad, 2)
        else:
            salida.precio_unitario = None
            salida.precio_total = None
    elif cambio_cantidad and salida.precio_unitario:
        salida.precio_total = round(salida.precio_unitario * nueva_cantidad, 2)

    db.session.commit()
    return jsonify(salida.to_dict()), 200


@almacen_bp.route("/registro-salida/<int:sid>", methods=["DELETE"])
@role_required("administrador")
def salida_delete(sid):
    salida = Salida.query.get_or_404(sid)

    producto = Producto.query.get(salida.producto_id)
    if producto:
        revertir_stock_salida(producto, salida.cantidad)

    try:
        db.session.delete(salida)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar la salida"}), 400
    return jsonify({"msg": "Salida eliminada"}), 200


@almacen_bp.route("/salidas/resumen-mensual", methods=["GET"])
@role_required("administrador")
def resumen_mensual():
    data = (
        db.session.query(
            Producto.nombre.label("producto"),
            func.strftime("%Y-%m", Salida.fecha).label("mes"),
            func.sum(Salida.precio_total).label("gasto"),
        )
        .join(Producto, Producto.id == Salida.producto_id)
        .group_by("mes", Producto.id)
        .order_by(desc("mes"))
        .all()
    )

    return jsonify(
        [
            {"producto": r.producto, "mes": r.mes, "gasto": round(r.gasto, 2)}
            for r in data
        ]
    )
