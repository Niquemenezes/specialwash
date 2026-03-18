#!/usr/bin/env python
"""Actualiza la tabla parte_trabajo agregando tiempo_estimado_minutos si falta."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"
COLUMN_NAME = "tiempo_estimado_minutos"
COLUMN_DEF = "INTEGER NOT NULL DEFAULT 0"


def ensure_parte_trabajo_schema(db_path: Path = DB_PATH) -> bool:
    """Retorna True si agrego la columna, False si ya existia o no aplica."""
    if not db_path.exists():
        return False

    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(parte_trabajo)")
        existing = {row[1] for row in cur.fetchall()}

        if COLUMN_NAME in existing:
            return False

        cur.execute(f"ALTER TABLE parte_trabajo ADD COLUMN {COLUMN_NAME} {COLUMN_DEF}")
        conn.commit()
        return True
    finally:
        conn.close()


def main():
    if not DB_PATH.exists():
        print(f"No existe la base de datos en: {DB_PATH}")
        return

    updated = ensure_parte_trabajo_schema(DB_PATH)
    if updated:
        print(f"Actualizacion completada. Columna agregada: {COLUMN_NAME}")
    else:
        print("Esquema al dia, no se agregaron columnas.")


if __name__ == "__main__":
    main()
