#!/usr/bin/env python
"""Actualiza la tabla servicios_catalogo agregando tiempo_estimado_minutos si falta."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"
COLUMN_NAME = "tiempo_estimado_minutos"
COLUMN_DEF = "INTEGER"


def ensure_servicio_catalogo_schema(db_path: Path = DB_PATH) -> bool:
    """Retorna True si agrego la columna, False si ya existia o no aplica."""
    if not db_path.exists():
        return False

    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(servicios_catalogo)")
        existing = {row[1] for row in cur.fetchall()}

        if COLUMN_NAME in existing:
            return False

        cur.execute(f"ALTER TABLE servicios_catalogo ADD COLUMN {COLUMN_NAME} {COLUMN_DEF}")
        conn.commit()
        return True
    finally:
        conn.close()


def main():
    if not DB_PATH.exists():
        print(f"No existe la base de datos en: {DB_PATH}")
        return

    updated = ensure_servicio_catalogo_schema(DB_PATH)
    if updated:
        print(f"Actualizacion completada. Columna agregada: {COLUMN_NAME}")
    else:
        print("Esquema al dia, no se agregaron columnas.")


if __name__ == "__main__":
    main()
