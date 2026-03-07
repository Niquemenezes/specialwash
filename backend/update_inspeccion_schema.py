#!/usr/bin/env python
"""Actualiza la tabla inspeccion_recepcion con columnas nuevas si faltan."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"

NEW_COLUMNS = {
    "kilometros": "INTEGER",
    "firma_cliente_recepcion": "TEXT",
    "firma_empleado_recepcion": "TEXT",
    "consentimiento_datos_recepcion": "BOOLEAN NOT NULL DEFAULT 0",
    "entregado": "BOOLEAN NOT NULL DEFAULT 0",
    "fecha_entrega": "DATETIME",
    "firma_cliente_entrega": "TEXT",
    "firma_empleado_entrega": "TEXT",
    "consentimiento_datos_entrega": "BOOLEAN NOT NULL DEFAULT 0",
    "conformidad_revision_entrega": "BOOLEAN NOT NULL DEFAULT 0",
    "trabajos_realizados": "TEXT",
    "entrega_observaciones": "TEXT",
}


def main():
    if not DB_PATH.exists():
      print(f"No existe la base de datos en: {DB_PATH}")
      return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("PRAGMA table_info(inspeccion_recepcion)")
    existing = {row[1] for row in cur.fetchall()}

    applied = 0
    for col_name, col_type in NEW_COLUMNS.items():
        if col_name in existing:
            continue
        sql = f"ALTER TABLE inspeccion_recepcion ADD COLUMN {col_name} {col_type}"
        cur.execute(sql)
        applied += 1
        print(f"+ Columna agregada: {col_name}")

    conn.commit()
    conn.close()

    if applied == 0:
        print("Esquema al dia, no se agregaron columnas.")
    else:
        print(f"Actualizacion completada. Columnas agregadas: {applied}")


if __name__ == "__main__":
    main()
