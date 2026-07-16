"""Reconciliar inspecciones de una fecha con Google Sheets.

Uso:
  python scripts/reconciliar_inspecciones_sheets.py --date 2026-07-16
  python scripts/reconciliar_inspecciones_sheets.py --dry-run

Comportamiento:
  - Busca inspecciones en BD para la fecha indicada (por defecto, hoy).
  - Comprueba si ya existen en la pestaña del mes por (fecha, matricula).
  - Si faltan, las registra en Google Sheets con registrar_inspeccion().
"""

from __future__ import annotations

import argparse
from datetime import date, datetime

from app import create_app
from models.inspeccion_recepcion import InspeccionRecepcion
from services import google_sheets_service as sheets


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reconciliar inspecciones con Google Sheets")
    parser.add_argument(
        "--date",
        dest="target_date",
        default=date.today().isoformat(),
        help="Fecha objetivo en formato YYYY-MM-DD (por defecto: hoy)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="No escribe en Sheets; solo muestra qué faltaría registrar",
    )
    return parser.parse_args()


def _load_sheet_pairs_for_date(target_date: date) -> set[tuple[str, str]]:
    fecha_str = target_date.strftime("%d/%m/%Y")
    ws = sheets._get_worksheet(month=target_date.month)
    vals = ws.get("A1:D2000")
    seen: set[tuple[str, str]] = set()
    for row in vals:
        if len(row) < 4:
            continue
        fecha = (row[0] or "").strip()
        matricula = (row[3] or "").strip().upper()
        if fecha == fecha_str and matricula:
            seen.add((fecha, matricula))
    return seen


def main() -> int:
    args = _parse_args()
    try:
        target_date = datetime.strptime(args.target_date, "%Y-%m-%d").date()
    except ValueError:
        print("ERROR: --date debe ir en formato YYYY-MM-DD")
        return 2

    app = create_app()

    with app.app_context():
        inspecciones = (
            InspeccionRecepcion.query
            .filter(InspeccionRecepcion.fecha_inspeccion >= datetime.combine(target_date, datetime.min.time()))
            .filter(InspeccionRecepcion.fecha_inspeccion < datetime.combine(target_date, datetime.max.time()))
            .order_by(InspeccionRecepcion.id.asc())
            .all()
        )

        if not inspecciones:
            print(f"No hay inspecciones en BD para {target_date.isoformat()}")
            return 0

        existentes = _load_sheet_pairs_for_date(target_date)

        faltantes = []
        for insp in inspecciones:
            fecha_str = insp.fecha_inspeccion.strftime("%d/%m/%Y") if insp.fecha_inspeccion else ""
            mat = (insp.matricula or "").strip().upper()
            key = (fecha_str, mat)
            if fecha_str and mat and key not in existentes:
                faltantes.append(insp)

        print(f"Inspecciones BD ({target_date.isoformat()}): {len(inspecciones)}")
        print(f"Ya en Sheets ({target_date.isoformat()}): {len(existentes)}")
        print(f"Faltantes detectadas: {len(faltantes)}")

        if args.dry_run:
            for insp in faltantes:
                print(f"  DRY-RUN -> id={insp.id} mat={insp.matricula} cliente={insp.cliente_nombre}")
            return 0

        for insp in faltantes:
            ok = sheets.registrar_inspeccion(insp, servicios_aplicados_raw=insp.servicios_aplicados)
            if ok:
                print(f"  OK -> id={insp.id} mat={insp.matricula}")
            else:
                print(f"  ERROR -> id={insp.id} mat={insp.matricula}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
