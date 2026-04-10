#!/usr/bin/env python
"""Actualiza la tabla inspeccion_recepcion agregando columnas faltantes si no existen."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"

COLUMNS = {
    "requiere_hoja_intervencion": "INTEGER NOT NULL DEFAULT 0",
}


def ensure_inspeccion_schema(db_path: Path = DB_PATH) -> bool:
    """Retorna True si agregó al menos una columna, False si no hubo cambios."""
    if not db_path.exists():
        return False

    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(inspeccion_recepcion)")
        existing = {row[1] for row in cur.fetchall()}

        updated = False
        for column_name, column_def in COLUMNS.items():
            if column_name in existing:
                continue
            cur.execute(f"ALTER TABLE inspeccion_recepcion ADD COLUMN {column_name} {column_def}")
            updated = True
            print(f"  + Columna añadida: {column_name}")

        if updated:
            conn.commit()
        return updated
    finally:
        conn.close()


def main():
    if not DB_PATH.exists():
        print(f"No existe la base de datos en: {DB_PATH}")
        return

    updated = ensure_inspeccion_schema(DB_PATH)
    if updated:
        print("Actualización completada.")
    else:
        print("Esquema al día, no se agregaron columnas.")


if __name__ == "__main__":
    main()
