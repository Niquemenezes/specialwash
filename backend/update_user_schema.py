#!/usr/bin/env python
"""Actualiza la tabla user agregando columnas faltantes en SQLite."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"


def ensure_user_schema(db_path: Path = DB_PATH) -> bool:
    """Retorna True si agrego alguna columna, False si no hizo cambios."""
    if not db_path.exists():
        return False

    conn = sqlite3.connect(db_path)
    changed = False
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info('user')")
        existing = {row[1] for row in cur.fetchall()}

        if "activo" not in existing:
            cur.execute("ALTER TABLE user ADD COLUMN activo BOOLEAN NOT NULL DEFAULT 1")
            changed = True

        if changed:
            conn.commit()
        return changed
    finally:
        conn.close()


def main():
    if not DB_PATH.exists():
        print(f"No existe la base de datos en: {DB_PATH}")
        return

    if ensure_user_schema(DB_PATH):
        print("Actualizacion completada. Tabla user ajustada.")
    else:
        print("Esquema user al dia, sin cambios.")


if __name__ == "__main__":
    main()
