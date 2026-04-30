#!/usr/bin/env python
"""Actualiza la tabla maquinaria agregando columnas faltantes para facturas."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"

NEW_COLUMNS = {
    "facturas_cloudinary": "TEXT DEFAULT '[]'",
}


def ensure_maquinaria_schema(db_path: Path = DB_PATH) -> bool:
    """Retorna True si aplico cambios de columnas en maquinaria."""
    if not db_path.exists():
        return False

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    changed = False
    try:
        cur.execute("PRAGMA table_info(maquinaria)")
        existing = {row[1] for row in cur.fetchall()}

        for col_name, col_type in NEW_COLUMNS.items():
            if col_name in existing:
                continue
            sql = f"ALTER TABLE maquinaria ADD COLUMN {col_name} {col_type}"
            cur.execute(sql)
            changed = True
            print(f"+ Columna agregada: {col_name}")

        if changed:
            conn.commit()
        return changed
    finally:
        conn.close()


def main():
    if not DB_PATH.exists():
        print(f"No existe la base de datos en: {DB_PATH}")
        return

    if not ensure_maquinaria_schema(DB_PATH):
        print("Esquema maquinaria al dia, no se agregaron columnas.")
    else:
        print("Actualizacion completada. Se agregaron columnas faltantes en maquinaria.")


if __name__ == "__main__":
    main()
