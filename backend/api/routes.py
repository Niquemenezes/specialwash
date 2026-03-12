from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    jwt_required, get_jwt_identity
)
from sqlalchemy import func, desc
from datetime import datetime, timedelta
import re

from models import db, User, Producto, Proveedor, Entrada, Salida, Maquinaria, Cliente, Coche, Servicio, ServicioCliente, InspeccionRecepcion, GastoEmpresa
from models.base import now_madrid
from utils.auth_utils import role_required

api = Blueprint("api", __name__)

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


def _extract_maquinaria_ocr_fields(raw_text):
    text = raw_text or ""
    compact = " ".join(text.split())

    def first_match(patterns):
        for pattern in patterns:
            match = re.search(pattern, compact, flags=re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None

    nombre = first_match([
        r"(?:maquina|maquinaria|equipo|nombre)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\s\-_/]{2,80})",
    ])
    marca = first_match([
        r"(?:marca)\s*[:#-]?\s*([A-Z0-9\-]{2,40})",
    ])
    modelo = first_match([
        r"(?:modelo)\s*[:#-]?\s*([A-Z0-9\-_/]{2,40})",
    ])
    numero_serie = first_match([
        r"(?:n(?:um(?:ero)?)?\s*(?:de\s*)?serie|s\/n|serial)\s*[:#-]?\s*([A-Z0-9\-/]{3,60})",
    ])
    fecha_compra = first_match([
        r"(?:fecha\s*(?:de\s*)?(?:compra|factura)|f\.)\s*[:#-]?\s*(\d{4}-\d{2}-\d{2})",
        r"(?:fecha\s*(?:de\s*)?(?:compra|factura)|f\.)\s*[:#-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})",
    ])
    precio_sin_iva_raw = first_match([
        r"(?:precio\s*sin\s*iva|base\s*imponible|subtotal)\s*[:#-]?\s*(\d{1,10}(?:[\.,]\d{1,4})?)",
    ])
    iva_raw = first_match([
        r"(?:iva|i\.v\.a\.)\s*[:#-]?\s*(\d{1,2}(?:[\.,]\d{1,2})?)\s*%",
    ])
    cantidad_raw = first_match([
        r"(?:cantidad|uds?|unidades)\s*[:#-]?\s*(\d{1,5})",
    ])

    if fecha_compra and "/" in fecha_compra:
        dd, mm, yyyy = fecha_compra.split("/")
        fecha_compra = f"{yyyy}-{mm}-{dd}"
    elif fecha_compra and re.match(r"\d{2}-\d{2}-\d{4}", fecha_compra):
        dd, mm, yyyy = fecha_compra.split("-")
        fecha_compra = f"{yyyy}-{mm}-{dd}"

    return {
        "nombre": nombre,
        "marca": marca,
        "modelo": modelo,
        "numero_serie": numero_serie,
        "fecha_compra": fecha_compra,
        "precio_sin_iva": _parse_decimal(precio_sin_iva_raw),
        "iva": _parse_decimal(iva_raw),
        "cantidad": int(cantidad_raw) if cantidad_raw else None,
        "texto_ocr": text[:4000],
    }

# =====================================================
# MAQUINARIA
# =====================================================

@api.route("/maquinaria", methods=["GET"])
@jwt_required()
def maquinaria_list():
    return jsonify([m.to_dict() for m in Maquinaria.query.order_by(Maquinaria.id.desc()).all()])


@api.route("/maquinaria", methods=["POST"])
@role_required("administrador")
def maquinaria_create():
    data = request.get_json() or {}
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return jsonify({"error": "El nombre es obligatorio"}), 400
    from datetime import date as dt_date
    m = Maquinaria(nombre=nombre)
    m.tipo = (data.get("tipo") or "").strip() or None
    m.marca = (data.get("marca") or "").strip() or None
    m.modelo = (data.get("modelo") or "").strip() or None
    m.numero_serie = (data.get("numero_serie") or "").strip() or None
    m.ubicacion = (data.get("ubicacion") or "").strip() or None
    m.estado = (data.get("estado") or "").strip() or None
    m.notas = (data.get("notas") or "").strip() or None
    # Campos de precio y cantidad
    m.precio_sin_iva = float(data.get("precio_sin_iva") or 0)
    m.iva = float(data.get("iva") or 0)
    m.precio_con_iva = float(data.get("precio_con_iva") or 0)
    m.cantidad = int(data.get("cantidad") or 1)
    fc = (data.get("fecha_compra") or "").strip()
    if fc:
        try:
            m.fecha_compra = dt_date.fromisoformat(fc)
        except ValueError:
            pass
    db.session.add(m)
    db.session.commit()
    return jsonify(m.to_dict()), 201


@api.route("/maquinaria/ocr-sugerencia", methods=["POST"])
@role_required("administrador")
def maquinaria_ocr_sugerencia():
    if pytesseract is None or Image is None:
        return jsonify({"msg": "OCR no disponible en el servidor"}), 503

    file = request.files.get("file")
    if not file:
        return jsonify({"msg": "Debe adjuntar una imagen"}), 400

    try:
        image = Image.open(file.stream)
        text = pytesseract.image_to_string(image, lang="spa+eng")
        return jsonify(_extract_maquinaria_ocr_fields(text)), 200
    except pytesseract.TesseractNotFoundError:
        return jsonify({"msg": "Tesseract OCR no esta instalado en el servidor"}), 503
    except Exception:
        return jsonify({"msg": "No se pudo procesar el documento OCR"}), 400


@api.route("/maquinaria/<int:mid>", methods=["PUT"])
@role_required("administrador")
def maquinaria_update(mid):
    m = Maquinaria.query.get_or_404(mid)
    data = request.get_json() or {}

    from datetime import date as dt_date
    m.nombre = data.get("nombre", m.nombre)
    m.tipo = data.get("tipo", m.tipo)
    m.marca = data.get("marca", m.marca)
    m.modelo = data.get("modelo", m.modelo)
    m.numero_serie = data.get("numero_serie", m.numero_serie)
    m.ubicacion = data.get("ubicacion", m.ubicacion)
    m.estado = data.get("estado", m.estado)
    m.notas = data.get("notas", m.notas)
    # Campos de precio y cantidad
    if "precio_sin_iva" in data:
        m.precio_sin_iva = float(data.get("precio_sin_iva") or 0)
    if "iva" in data:
        m.iva = float(data.get("iva") or 0)
    if "precio_con_iva" in data:
        m.precio_con_iva = float(data.get("precio_con_iva") or 0)
    if "cantidad" in data:
        m.cantidad = int(data.get("cantidad") or 1)
    fc = data.get("fecha_compra")
    if fc is not None:
        fc = fc.strip() if isinstance(fc, str) else ""
        if fc:
            try:
                m.fecha_compra = dt_date.fromisoformat(fc)
            except ValueError:
                pass
        else:
            m.fecha_compra = None

    db.session.commit()
    return jsonify(m.to_dict()), 200


@api.route("/maquinaria/<int:mid>", methods=["DELETE"])
@role_required("administrador")
def maquinaria_delete(mid):
    m = Maquinaria.query.get_or_404(mid)
    try:
        db.session.delete(m)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar la maquinaria"}), 400
    return jsonify({"msg": "Maquinaria eliminada"}), 200


# =====================================================
# PING
# =====================================================

@api.route("/hello", methods=["GET"])
def hello():
    return jsonify({"msg": "Hello SpecialWash API"}), 200


# =====================================================
# CLIENTES
# =====================================================

@api.route("/clientes", methods=["GET"])
@jwt_required()
def clientes_list():
    q = (request.args.get("q") or "").strip().lower()
    query = Cliente.query
    if q:
        query = query.filter(
            (Cliente.nombre.ilike(f"%{q}%")) |
            (Cliente.telefono.ilike(f"%{q}%")) |
            (Cliente.email.ilike(f"%{q}%"))
        )
    clientes = query.order_by(Cliente.nombre).all()
    return jsonify([
        {
            **c.to_dict(),
            "total_coches": len(c.coches or [])
        }
        for c in clientes
    ])


@api.route("/clientes", methods=["POST"])
@role_required("administrador", "encargado", "tecnico_comercial")
def clientes_create():
    data = request.get_json() or {}
    nombre = (data.get("nombre") or "").strip()
    if not nombre:
        return jsonify({"error": "El nombre es obligatorio"}), 400
    c = Cliente(
        nombre=nombre,
        cif=(data.get("cif") or "").strip() or None,
        telefono=(data.get("telefono") or "").strip() or None,
        email=(data.get("email") or "").strip() or None,
        direccion=(data.get("direccion") or "").strip() or None,
        notas=(data.get("notas") or "").strip() or None,
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@api.route("/clientes/<int:cid>", methods=["PUT"])
@role_required("administrador", "encargado", "tecnico_comercial")
def clientes_update(cid):
    c = Cliente.query.get_or_404(cid)
    data = request.get_json() or {}
    
    if "nombre" in data:
        nombre = (data.get("nombre") or "").strip()
        if not nombre:
            return jsonify({"error": "El nombre es obligatorio"}), 400
        c.nombre = nombre
    if "cif" in data:
        c.cif = (data.get("cif") or "").strip() or None
    if "telefono" in data:
        c.telefono = (data.get("telefono") or "").strip() or None
    if "email" in data:
        c.email = (data.get("email") or "").strip() or None
    if "direccion" in data:
        c.direccion = (data.get("direccion") or "").strip() or None
    if "notas" in data:
        c.notas = (data.get("notas") or "").strip() or None
    
    db.session.commit()
    return jsonify(c.to_dict()), 200


@api.route("/clientes/<int:cid>", methods=["DELETE"])
@role_required("administrador")
def clientes_delete(cid):
    c = Cliente.query.get_or_404(cid)

    # Guardamos IDs de coches antes del borrado en cascada para poder desvincular inspecciones.
    coche_ids = [car.id for car in (c.coches or [])]

    try:
        inspecciones = InspeccionRecepcion.query.filter(
            (InspeccionRecepcion.cliente_id == cid) |
            (InspeccionRecepcion.coche_id.in_(coche_ids) if coche_ids else False)
        ).all()

        for insp in inspecciones:
            if insp.cliente_id == cid:
                insp.cliente_id = None
            if insp.coche_id in coche_ids:
                insp.coche_id = None

        db.session.delete(c)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": f"No se puede eliminar el cliente: {str(exc)}"}), 400
    return jsonify({"msg": "Cliente eliminado"}), 200


# =====================================================
# COCHES
# =====================================================

@api.route("/coches", methods=["GET"])
@jwt_required()
def coches_list():
    q = (request.args.get("q") or "").strip().lower()
    cliente_id = (request.args.get("cliente_id") or "").strip()
    query = Coche.query
    if cliente_id:
        try:
            query = query.filter(Coche.cliente_id == int(cliente_id))
        except ValueError:
            return jsonify({"error": "cliente_id inválido"}), 400
    if q:
        query = query.filter(
            (Coche.matricula.ilike(f"%{q}%")) |
            (Coche.marca.ilike(f"%{q}%")) |
            (Coche.modelo.ilike(f"%{q}%"))
        )
    return jsonify([c.to_dict() for c in query.order_by(Coche.matricula).all()])


@api.route("/coches", methods=["POST"])
@role_required("administrador", "encargado", "tecnico_comercial")
def coches_create():
    data = request.get_json() or {}
    
    # Verificar que la matrícula no exista
    matricula = data.get("matricula", "").strip().upper()
    if not matricula:
        return jsonify({"error": "La matrícula es obligatoria"}), 400
    if Coche.query.filter_by(matricula=matricula).first():
        return jsonify({"error": "Ya existe un coche con esa matrícula"}), 400
    cliente_id = data.get("cliente_id")
    cliente = Cliente.query.get(cliente_id) if cliente_id else None
    if not cliente:
        return jsonify({"error": "Cliente no encontrado"}), 404
    
    c = Coche(
        matricula=matricula,
        marca=(data.get("marca") or "").strip() or None,
        modelo=(data.get("modelo") or "").strip() or None,
        color=(data.get("color") or "").strip() or None,
        cliente_id=int(cliente_id),
        notas=(data.get("notas") or "").strip() or None,
    )
    db.session.add(c)
    db.session.commit()
    return jsonify(c.to_dict()), 201


@api.route("/coches/<int:cid>", methods=["PUT"])
@role_required("administrador", "encargado", "tecnico_comercial")
def coches_update(cid):
    c = Coche.query.get_or_404(cid)
    data = request.get_json() or {}
    
    # Verificar matrícula si se cambia
    if "matricula" in data:
        nueva_matricula = data.get("matricula", "").strip().upper()
        if nueva_matricula != c.matricula:
            if Coche.query.filter_by(matricula=nueva_matricula).first():
                return jsonify({"error": "Ya existe un coche con esa matrícula"}), 400
            c.matricula = nueva_matricula
    
    if "marca" in data:
        c.marca = (data.get("marca") or "").strip() or None
    if "modelo" in data:
        c.modelo = (data.get("modelo") or "").strip() or None
    if "color" in data:
        c.color = (data.get("color") or "").strip() or None
    if "cliente_id" in data:
        cliente = Cliente.query.get(data.get("cliente_id"))
        if not cliente:
            return jsonify({"error": "Cliente no encontrado"}), 404
        c.cliente_id = int(data.get("cliente_id"))
    if "notas" in data:
        c.notas = (data.get("notas") or "").strip() or None
    
    db.session.commit()
    return jsonify(c.to_dict()), 200


@api.route("/coches/<int:cid>", methods=["DELETE"])
@role_required("administrador")
def coches_delete(cid):
    c = Coche.query.get_or_404(cid)
    try:
        db.session.delete(c)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar: el coche tiene servicios asociados"}), 400
    return jsonify({"msg": "Coche eliminado"}), 200


# =====================================================
# SERVICIOS
# =====================================================

@api.route("/servicios", methods=["GET"])
@jwt_required()
def servicios_list():
    q = (request.args.get("q") or "").strip().lower()
    coche_id = request.args.get("coche_id")
    
    query = Servicio.query
    if coche_id:
        query = query.filter_by(coche_id=int(coche_id))
    if q:
        query = query.join(Coche).filter(
            (Coche.matricula.ilike(f"%{q}%")) |
            (Servicio.tipo_servicio.ilike(f"%{q}%"))
        )
    return jsonify([s.to_dict() for s in query.order_by(Servicio.fecha.desc()).all()])


@api.route("/servicios", methods=["POST"])
@jwt_required()
def servicios_create():
    data = request.get_json() or {}
    usuario_id = int(get_jwt_identity())

    coche_id = data.get("coche_id")
    tipo_servicio = (data.get("tipo_servicio") or "").strip()

    if not coche_id:
        return jsonify({"msg": "coche_id es obligatorio"}), 400
    if not tipo_servicio:
        return jsonify({"msg": "tipo_servicio es obligatorio"}), 400

    try:
        coche_id = int(coche_id)
    except (TypeError, ValueError):
        return jsonify({"msg": "coche_id invalido"}), 400

    try:
        precio = float(data.get("precio", 0))
    except (TypeError, ValueError):
        return jsonify({"msg": "precio invalido"}), 400
    if precio < 0:
        return jsonify({"msg": "precio debe ser mayor o igual a 0"}), 400

    if not Coche.query.get(coche_id):
        return jsonify({"msg": "Coche no encontrado"}), 404

    s = Servicio(
        fecha=datetime.utcnow(),
        coche_id=coche_id,
        tipo_servicio=tipo_servicio,
        precio=precio,
        observaciones=data.get("observaciones"),
        usuario_id=usuario_id
    )
    db.session.add(s)
    db.session.commit()
    return jsonify(s.to_dict()), 201


@api.route("/servicios/<int:sid>", methods=["PUT"])
@role_required("administrador")
def servicios_update(sid):
    s = Servicio.query.get_or_404(sid)
    data = request.get_json() or {}

    if "coche_id" in data:
        try:
            coche_id = int(data.get("coche_id"))
        except (TypeError, ValueError):
            return jsonify({"msg": "coche_id invalido"}), 400
        if not Coche.query.get(coche_id):
            return jsonify({"msg": "Coche no encontrado"}), 404
        s.coche_id = coche_id
    s.tipo_servicio = data.get("tipo_servicio", s.tipo_servicio)
    if "precio" in data:
        try:
            precio = float(data.get("precio"))
        except (TypeError, ValueError):
            return jsonify({"msg": "precio invalido"}), 400
        if precio < 0:
            return jsonify({"msg": "precio debe ser mayor o igual a 0"}), 400
        s.precio = precio
    s.observaciones = data.get("observaciones", s.observaciones)

    db.session.commit()
    return jsonify(s.to_dict()), 200


@api.route("/servicios/<int:sid>", methods=["DELETE"])
@role_required("administrador")
def servicios_delete(sid):
    s = Servicio.query.get_or_404(sid)
    try:
        db.session.delete(s)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar el servicio"}), 400
    return jsonify({"msg": "Servicio eliminado"}), 200


# =====================================================
# SERVICIOS PERSONALIZADOS POR CLIENTE
# =====================================================

@api.route("/clientes/<int:cliente_id>/servicios", methods=["GET"])
@role_required("administrador")
def get_servicios_cliente(cliente_id):
    """Obtener todos los servicios personalizados de un cliente"""
    servicios = ServicioCliente.query.filter_by(cliente_id=cliente_id).all()
    return jsonify([s.to_dict() for s in servicios]), 200


@api.route("/clientes/<int:cliente_id>/servicios", methods=["POST"])
@role_required("administrador")
def create_servicio_cliente(cliente_id):
    """Crear un servicio personalizado para un cliente"""
    cliente = Cliente.query.get_or_404(cliente_id)
    data = request.get_json() or {}
    
    nombre = data.get("nombre", "").strip()
    precio = data.get("precio")
    descuento_porcentaje = float(data.get("descuento_porcentaje") or 0)
    
    if not nombre:
        return jsonify({"msg": "El nombre del servicio es obligatorio"}), 400
    
    if precio is None or float(precio) < 0:
        return jsonify({"msg": "El precio debe ser un valor válido"}), 400

    if descuento_porcentaje < 0 or descuento_porcentaje > 100:
        return jsonify({"msg": "El descuento debe estar entre 0 y 100"}), 400
    
    servicio = ServicioCliente(
        cliente_id=cliente_id,
        nombre=nombre,
        precio=float(precio),
        descuento_porcentaje=descuento_porcentaje,
        descripcion=data.get("descripcion", "").strip(),
        activo=data.get("activo", True)
    )
    
    db.session.add(servicio)
    db.session.commit()
    
    return jsonify(servicio.to_dict()), 201


@api.route("/clientes/<int:cliente_id>/servicios/<int:servicio_id>", methods=["PUT"])
@role_required("administrador")
def update_servicio_cliente(cliente_id, servicio_id):
    """Actualizar un servicio personalizado de un cliente"""
    servicio = ServicioCliente.query.filter_by(id=servicio_id, cliente_id=cliente_id).first_or_404()
    data = request.get_json() or {}
    
    if "nombre" in data:
        nombre = data["nombre"].strip()
        if not nombre:
            return jsonify({"msg": "El nombre no puede estar vacío"}), 400
        servicio.nombre = nombre
    
    if "precio" in data:
        precio = float(data["precio"])
        if precio < 0:
            return jsonify({"msg": "El precio debe ser mayor o igual a 0"}), 400
        servicio.precio = precio

    if "descuento_porcentaje" in data:
        descuento = float(data["descuento_porcentaje"])
        if descuento < 0 or descuento > 100:
            return jsonify({"msg": "El descuento debe estar entre 0 y 100"}), 400
        servicio.descuento_porcentaje = descuento
    
    if "descripcion" in data:
        servicio.descripcion = data["descripcion"].strip()
    
    if "activo" in data:
        servicio.activo = bool(data["activo"])
    
    db.session.commit()
    return jsonify(servicio.to_dict()), 200


@api.route("/clientes/<int:cliente_id>/servicios/<int:servicio_id>", methods=["DELETE"])
@role_required("administrador")
def delete_servicio_cliente(cliente_id, servicio_id):
    """Eliminar un servicio personalizado de un cliente"""
    servicio = ServicioCliente.query.filter_by(id=servicio_id, cliente_id=cliente_id).first_or_404()
    try:
        db.session.delete(servicio)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "No se puede eliminar el servicio personalizado"}), 400
    return jsonify({"msg": "Servicio eliminado"}), 200


# =====================================================
# GASTOS EMPRESA (SOLO ADMIN)
# =====================================================

@api.route("/gastos-empresa", methods=["GET"])
@role_required("administrador")
def gastos_empresa_list():
    desde = request.args.get("desde")
    hasta = request.args.get("hasta")
    categoria = (request.args.get("categoria") or "").strip().lower()
    q = (request.args.get("q") or "").strip().lower()

    query = GastoEmpresa.query

    if desde:
        try:
            fecha_desde_dt = datetime.strptime(desde, "%Y-%m-%d")
            query = query.filter(GastoEmpresa.fecha >= fecha_desde_dt)
        except ValueError:
            pass

    if hasta:
        try:
            fecha_hasta_dt = datetime.strptime(hasta, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(GastoEmpresa.fecha < fecha_hasta_dt)
        except ValueError:
            pass

    if categoria:
        query = query.filter(func.lower(GastoEmpresa.categoria) == categoria)

    if q:
        query = query.filter(
            (GastoEmpresa.concepto.ilike(f"%{q}%")) |
            (GastoEmpresa.proveedor.ilike(f"%{q}%")) |
            (GastoEmpresa.observaciones.ilike(f"%{q}%"))
        )

    items = query.order_by(GastoEmpresa.fecha.desc()).all()
    total = round(sum(float(i.importe or 0) for i in items), 2)

    return jsonify({
        "items": [i.to_dict() for i in items],
        "total": total,
        "count": len(items),
        "desde": desde,
        "hasta": hasta,
        "categoria": categoria or None,
        "q": q or None,
    }), 200


@api.route("/gastos-empresa", methods=["POST"])
@role_required("administrador")
def gastos_empresa_create():
    data = request.get_json() or {}

    concepto = (data.get("concepto") or "").strip()
    categoria = (data.get("categoria") or "general").strip().lower()
    proveedor = (data.get("proveedor") or "").strip() or None
    observaciones = (data.get("observaciones") or "").strip() or None

    if not concepto:
        return jsonify({"msg": "El concepto es obligatorio"}), 400

    try:
        importe = float(data.get("importe"))
        if importe < 0:
            return jsonify({"msg": "El importe debe ser mayor o igual a 0"}), 400
    except (TypeError, ValueError):
        return jsonify({"msg": "El importe debe ser un numero valido"}), 400

    fecha = now_madrid()
    fecha_raw = data.get("fecha")
    if fecha_raw:
        try:
            fecha = datetime.strptime(fecha_raw, "%Y-%m-%d")
        except ValueError:
            return jsonify({"msg": "Formato de fecha invalido. Usa YYYY-MM-DD"}), 400

    gasto = GastoEmpresa(
        fecha=fecha,
        concepto=concepto,
        categoria=categoria,
        importe=importe,
        proveedor=proveedor,
        observaciones=observaciones,
    )

    db.session.add(gasto)
    db.session.commit()
    return jsonify(gasto.to_dict()), 201


@api.route("/gastos-empresa/<int:gid>", methods=["PUT"])
@role_required("administrador")
def gastos_empresa_update(gid):
    gasto = GastoEmpresa.query.get_or_404(gid)
    data = request.get_json() or {}

    if "concepto" in data:
        concepto = (data.get("concepto") or "").strip()
        if not concepto:
            return jsonify({"msg": "El concepto no puede estar vacio"}), 400
        gasto.concepto = concepto

    if "categoria" in data:
        gasto.categoria = (data.get("categoria") or "general").strip().lower()

    if "importe" in data:
        try:
            importe = float(data.get("importe"))
            if importe < 0:
                return jsonify({"msg": "El importe debe ser mayor o igual a 0"}), 400
            gasto.importe = importe
        except (TypeError, ValueError):
            return jsonify({"msg": "El importe debe ser un numero valido"}), 400

    if "fecha" in data:
        fecha_raw = (data.get("fecha") or "").strip()
        if not fecha_raw:
            gasto.fecha = now_madrid()
        else:
            try:
                gasto.fecha = datetime.strptime(fecha_raw, "%Y-%m-%d")
            except ValueError:
                return jsonify({"msg": "Formato de fecha invalido. Usa YYYY-MM-DD"}), 400

    if "proveedor" in data:
        gasto.proveedor = (data.get("proveedor") or "").strip() or None

    if "observaciones" in data:
        gasto.observaciones = (data.get("observaciones") or "").strip() or None

    db.session.commit()
    return jsonify(gasto.to_dict()), 200


@api.route("/gastos-empresa/<int:gid>", methods=["DELETE"])
@role_required("administrador")
def gastos_empresa_delete(gid):
    gasto = GastoEmpresa.query.get_or_404(gid)
    db.session.delete(gasto)
    db.session.commit()
    return jsonify({"msg": "Gasto eliminado"}), 200


# =====================================================
# REPORTES
# =====================================================

@api.route("/reportes/clientes", methods=["GET"])
@jwt_required()
def reporte_clientes():
    """
    Reporte de ingresos por cliente y coche en un período.
    Parámetros: fecha_desde, fecha_hasta (opcional)
    """
    fecha_desde = request.args.get("fecha_desde")
    fecha_hasta = request.args.get("fecha_hasta")
    
    query = db.session.query(
        Cliente.id.label("cliente_id"),
        Cliente.nombre.label("cliente_nombre"),
        Cliente.cif.label("cliente_cif"),
        Coche.id.label("coche_id"),
        Coche.matricula.label("coche_matricula"),
        Coche.marca.label("coche_marca"),
        Coche.modelo.label("coche_modelo"),
        func.count(Servicio.id).label("total_servicios"),
        func.sum(Servicio.precio).label("total_pagado")
    ).join(Coche, Cliente.id == Coche.cliente_id
    ).join(Servicio, Coche.id == Servicio.coche_id)
    
    # Filtros de fecha
    if fecha_desde:
        try:
            fecha_desde_dt = datetime.strptime(fecha_desde, "%Y-%m-%d")
            query = query.filter(Servicio.fecha >= fecha_desde_dt)
        except ValueError:
            pass
    
    if fecha_hasta:
        try:
            fecha_hasta_dt = datetime.strptime(fecha_hasta, "%Y-%m-%d")
            # Incluir todo el día hasta
            fecha_hasta_dt = fecha_hasta_dt + timedelta(days=1)
            query = query.filter(Servicio.fecha < fecha_hasta_dt)
        except ValueError:
            pass
    
    query = query.group_by(
        Cliente.id, Cliente.nombre, Cliente.cif,
        Coche.id, Coche.matricula, Coche.marca, Coche.modelo
    ).order_by(Cliente.nombre, Coche.matricula)
    
    resultados = query.all()
    
    # Agrupar por cliente
    clientes_dict = {}
    for r in resultados:
        cliente_id = r.cliente_id
        if cliente_id not in clientes_dict:
            clientes_dict[cliente_id] = {
                "cliente_id": cliente_id,
                "cliente_nombre": r.cliente_nombre,
                "cliente_cif": r.cliente_cif,
                "coches": [],
                "total_cliente": 0
            }
        
        coche_info = {
            "coche_id": r.coche_id,
            "matricula": r.coche_matricula,
            "marca": r.coche_marca,
            "modelo": r.coche_modelo,
            "total_servicios": r.total_servicios,
            "total_pagado": round(float(r.total_pagado or 0), 2)
        }
        
        clientes_dict[cliente_id]["coches"].append(coche_info)
        clientes_dict[cliente_id]["total_cliente"] += coche_info["total_pagado"]
    
    # Redondear totales de cliente
    for cliente_id in clientes_dict:
        clientes_dict[cliente_id]["total_cliente"] = round(clientes_dict[cliente_id]["total_cliente"], 2)
    
    return jsonify({
        "clientes": list(clientes_dict.values()),
        "fecha_desde": fecha_desde,
        "fecha_hasta": fecha_hasta
    }), 200



