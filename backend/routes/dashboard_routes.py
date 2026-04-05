from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from extensions import db
from models import Cliente, Coche, GastoEmpresa, InspeccionRecepcion, Servicio
from utils.auth_utils import role_required

dashboard_bp = Blueprint("dashboard", __name__)


def _mes_label(anio, mes):
    nombres = [
        "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ]
    return nombres[mes] if 1 <= mes <= 12 else f"{anio}-{mes:02d}"


@dashboard_bp.route("/api/dashboard", methods=["GET"])
@role_required("administrador")
def get_dashboard():
    """
    Devuelve un resumen completo para el dashboard:
      - KPIs del mes actual y del año
      - Facturación mensual (12 meses)
      - Top clientes por facturación
      - Top servicios más solicitados
      - Cobros pendientes
      - Alertas de entrega
    Parámetros opcionales:
      ?anio=2026   (por defecto el año actual)
    """
    anio = request.args.get("anio", datetime.now().year, type=int)
    hoy = datetime.now()
    mes_actual = hoy.month

    # ── 1. Facturación mensual del año ──────────────────────────────────────
    rows_servicios = (
        db.session.query(
            func.strftime("%m", Servicio.fecha).label("mes"),
            func.sum(Servicio.precio).label("total"),
            func.count(Servicio.id).label("count"),
        )
        .filter(func.strftime("%Y", Servicio.fecha) == str(anio))
        .group_by(func.strftime("%m", Servicio.fecha))
        .all()
    )

    facturacion_mensual = []
    totales_por_mes = {int(r.mes): {"total": float(r.total or 0), "count": int(r.count)} for r in rows_servicios}

    for m in range(1, 13):
        facturacion_mensual.append({
            "mes": m,
            "mes_label": _mes_label(anio, m),
            "total": totales_por_mes.get(m, {}).get("total", 0),
            "trabajos": totales_por_mes.get(m, {}).get("count", 0),
        })

    # ── 2. KPIs globales del año ─────────────────────────────────────────────
    total_anio = sum(m["total"] for m in facturacion_mensual)
    trabajos_anio = sum(m["trabajos"] for m in facturacion_mensual)

    # KPIs del mes actual
    mes_data = totales_por_mes.get(mes_actual, {"total": 0, "count": 0})
    total_mes = mes_data["total"]
    trabajos_mes = mes_data["count"]

    # Mes anterior para comparativa
    mes_ant = mes_actual - 1 if mes_actual > 1 else 12
    anio_ant = anio if mes_actual > 1 else anio - 1
    mes_ant_data = (
        db.session.query(func.sum(Servicio.precio))
        .filter(
            func.strftime("%Y", Servicio.fecha) == str(anio_ant),
            func.strftime("%m", Servicio.fecha) == f"{mes_ant:02d}",
        )
        .scalar() or 0
    )
    variacion_mes = round(
        ((total_mes - float(mes_ant_data)) / float(mes_ant_data) * 100) if mes_ant_data else 0,
        1,
    )

    # ── 3. Top clientes ──────────────────────────────────────────────────────
    top_clientes_rows = (
        db.session.query(
            Cliente.id,
            Cliente.nombre,
            func.sum(Servicio.precio).label("total"),
            func.count(Servicio.id).label("trabajos"),
        )
        .join(Coche, Coche.cliente_id == Cliente.id)
        .join(Servicio, Servicio.coche_id == Coche.id)
        .filter(func.strftime("%Y", Servicio.fecha) == str(anio))
        .group_by(Cliente.id, Cliente.nombre)
        .order_by(func.sum(Servicio.precio).desc())
        .limit(8)
        .all()
    )

    top_clientes = [
        {
            "cliente_id": r.id,
            "nombre": r.nombre,
            "total": round(float(r.total or 0), 2),
            "trabajos": int(r.trabajos),
            "ticket_medio": round(float(r.total or 0) / int(r.trabajos), 2) if r.trabajos else 0,
            "porcentaje": round(float(r.total or 0) / total_anio * 100, 1) if total_anio else 0,
        }
        for r in top_clientes_rows
    ]

    # ── 4. Top servicios ─────────────────────────────────────────────────────
    top_servicios_rows = (
        db.session.query(
            Servicio.tipo_servicio,
            func.sum(Servicio.precio).label("total"),
            func.count(Servicio.id).label("count"),
        )
        .filter(func.strftime("%Y", Servicio.fecha) == str(anio))
        .group_by(Servicio.tipo_servicio)
        .order_by(func.count(Servicio.id).desc())
        .limit(8)
        .all()
    )

    top_servicios = [
        {
            "tipo_servicio": r.tipo_servicio,
            "total": round(float(r.total or 0), 2),
            "count": int(r.count),
            "precio_medio": round(float(r.total or 0) / int(r.count), 2) if r.count else 0,
        }
        for r in top_servicios_rows
    ]

    # ── 5. Cobros pendientes (InspeccionRecepcion) ───────────────────────────
    inspecciones_pendientes = (
        InspeccionRecepcion.query
        .filter(
            InspeccionRecepcion.entregado == True,
            InspeccionRecepcion.cobro_estado.in_(["pendiente", "parcial"]),
        )
        .order_by(InspeccionRecepcion.fecha_entrega.asc())
        .limit(20)
        .all()
    )

    cobros_pendientes = []
    total_pendiente = 0.0

    for insp in inspecciones_pendientes:
        # Calcular importe total desde servicios_aplicados
        try:
            import json
            servicios_aplicados = json.loads(insp.servicios_aplicados or "[]")
            importe_total = sum(float(s.get("precio", 0)) for s in servicios_aplicados if isinstance(s, dict))
        except Exception:
            importe_total = 0.0

        importe_pagado = float(insp.cobro_importe_pagado or 0)
        importe_pendiente = max(importe_total - importe_pagado, 0)
        total_pendiente += importe_pendiente

        cobros_pendientes.append({
            "inspeccion_id": insp.id,
            "cliente_nombre": insp.cliente_nombre,
            "matricula": insp.matricula,
            "fecha_entrega": insp.fecha_entrega.isoformat() if insp.fecha_entrega else None,
            "cobro_estado": insp.cobro_estado,
            "importe_total": round(importe_total, 2),
            "importe_pagado": round(importe_pagado, 2),
            "importe_pendiente": round(importe_pendiente, 2),
        })

    # ── 6. Alertas de entrega vencida ────────────────────────────────────────
    limite_vencido = hoy - timedelta(days=3)
    inspecciones_vencidas = (
        InspeccionRecepcion.query
        .filter(
            InspeccionRecepcion.entregado == False,
            InspeccionRecepcion.confirmado == True,
            InspeccionRecepcion.fecha_inspeccion < limite_vencido,
        )
        .order_by(InspeccionRecepcion.fecha_inspeccion.asc())
        .limit(15)
        .all()
    )

    alertas_entrega = [
        {
            "inspeccion_id": insp.id,
            "cliente_nombre": insp.cliente_nombre,
            "matricula": insp.matricula,
            "coche_descripcion": insp.coche_descripcion,
            "fecha_inspeccion": insp.fecha_inspeccion.isoformat() if insp.fecha_inspeccion else None,
            "dias_en_taller": (hoy - insp.fecha_inspeccion.replace(tzinfo=None)).days if insp.fecha_inspeccion else 0,
        }
        for insp in inspecciones_vencidas
    ]

    # ── 7. Gastos del año ────────────────────────────────────────────────────
    total_gastos = (
        db.session.query(func.sum(GastoEmpresa.importe))
        .filter(func.strftime("%Y", GastoEmpresa.fecha) == str(anio))
        .scalar() or 0
    )

    # ── Respuesta final ──────────────────────────────────────────────────────
    return jsonify({
        "anio": anio,
        "generado_at": hoy.isoformat(),
        "kpis": {
            "total_anio": round(total_anio, 2),
            "trabajos_anio": trabajos_anio,
            "total_mes_actual": round(total_mes, 2),
            "trabajos_mes_actual": trabajos_mes,
            "mes_actual_label": _mes_label(anio, mes_actual),
            "variacion_vs_mes_anterior": variacion_mes,
            "total_gastos_anio": round(float(total_gastos), 2),
            "beneficio_estimado": round(total_anio - float(total_gastos), 2),
            "total_pendiente_cobro": round(total_pendiente, 2),
            "alertas_entrega_count": len(alertas_entrega),
        },
        "facturacion_mensual": facturacion_mensual,
        "top_clientes": top_clientes,
        "top_servicios": top_servicios,
        "cobros_pendientes": cobros_pendientes,
        "alertas_entrega": alertas_entrega,
    }), 200
