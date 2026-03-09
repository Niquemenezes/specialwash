#!/usr/bin/env python
"""Crea la tabla producto_codigo_barras si no existe en SQLite."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"


def ensure_producto_codigos_schema(db_path: Path = DB_PATH) -> bool:
    if not db_path.exists():
        return False

    conn = sqlite3.connect(db_path)
    changed = False
    try:
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='producto_codigo_barras'")
        exists = cur.fetchone() is not None

        if not exists:
            cur.execute(
                """
                CREATE TABLE producto_codigo_barras (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    producto_id INTEGER NOT NULL,
                    codigo_barras TEXT NOT NULL UNIQUE,
                    marca TEXT,
                    created_at TEXT,
                    FOREIGN KEY(producto_id) REFERENCES producto(id) ON DELETE CASCADE
                )
                """
            )
            changed = True

        cur.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_producto_codigo_barras_codigo "
            "ON producto_codigo_barras(codigo_barras)"
        )

        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_producto_codigo_barras_producto "
            "ON producto_codigo_barras(producto_id)"
        )

        if changed:
            conn.commit()
        else:
            conn.commit()
        return changed
    finally:
        conn.close()


def main():
    if not DB_PATH.exists():
        print(f"No existe la base de datos en: {DB_PATH}")
        return

    if ensure_producto_codigos_schema(DB_PATH):
        print("Actualizacion completada. Tabla producto_codigo_barras creada.")
    else:
        print("Esquema producto_codigo_barras al dia, sin cambios.")


if __name__ == "__main__":
    main()
