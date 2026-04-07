#!/usr/bin/env python
"""Actualiza la tabla servicios_catalogo agregando columnas faltantes."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"
COLUMNS = {
    "tiempo_estimado_minutos": "INTEGER",
    "rol_responsable": "VARCHAR(50)",
}


def ensure_servicio_catalogo_schema(db_path: Path = DB_PATH) -> bool:
    """Retorna True si agrego al menos una columna, False si no aplica."""
    if not db_path.exists():
        return False

    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(servicios_catalogo)")
        existing = {row[1] for row in cur.fetchall()}

        updated = False
        for column_name, column_def in COLUMNS.items():
            if column_name in existing:
                continue
            cur.execute(f"ALTER TABLE servicios_catalogo ADD COLUMN {column_name} {column_def}")
            updated = True

        if updated:
            conn.commit()
        return updated
    finally:
        conn.close()


def main():
    if not DB_PATH.exists():
        print(f"No existe la base de datos en: {DB_PATH}")
        return

    updated = ensure_servicio_catalogo_schema(DB_PATH)
    if updated:
        print("Actualizacion completada. Se agregaron columnas faltantes.")
    else:
        print("Esquema al dia, no se agregaron columnas.")


if __name__ == "__main__":
    main()
