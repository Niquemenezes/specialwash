#!/usr/bin/env python
"""Actualiza la tabla servicios_cliente agregando descuento_porcentaje si falta."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"
COLUMN_NAME = "descuento_porcentaje"
COLUMN_DEF = "REAL NOT NULL DEFAULT 0"


def main():
    if not DB_PATH.exists():
        print(f"No existe la base de datos en: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("PRAGMA table_info(servicios_cliente)")
    existing = {row[1] for row in cur.fetchall()}

    if COLUMN_NAME in existing:
        print("Esquema al dia, no se agregaron columnas.")
        conn.close()
        return

    sql = f"ALTER TABLE servicios_cliente ADD COLUMN {COLUMN_NAME} {COLUMN_DEF}"
    cur.execute(sql)
    conn.commit()
    conn.close()

    print(f"Actualizacion completada. Columna agregada: {COLUMN_NAME}")


if __name__ == "__main__":
    main()
