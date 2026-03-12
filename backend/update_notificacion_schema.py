#!/usr/bin/env python
"""Crea la tabla notificaciones si no existe en SQLite."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"


def ensure_notificacion_schema(db_path: Path = DB_PATH) -> bool:
    """Retorna True si creó la tabla, False si ya existía o no hay BD."""
    if not db_path.exists():
        return False

    conn = sqlite3.connect(db_path)
    changed = False
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='notificaciones'"
        )
        exists = cur.fetchone() is not None

        if not exists:
            cur.execute(
                """
                CREATE TABLE notificaciones (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tipo VARCHAR(64) NOT NULL DEFAULT 'inspeccion',
                    titulo VARCHAR(200) NOT NULL,
                    cuerpo TEXT NULL,
                    leida BOOLEAN NOT NULL DEFAULT 0,
                    ref_id INTEGER NULL,
                    created_at DATETIME NULL
                )
                """
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS ix_notificaciones_leida_created_at ON notificaciones (leida, created_at)"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS ix_notificaciones_created_at ON notificaciones (created_at)"
            )
            changed = True

        if changed:
            conn.commit()
        return changed
    finally:
        conn.close()


def main() -> None:
    if not DB_PATH.exists():
        print(f"No existe la base de datos en: {DB_PATH}")
        return

    if ensure_notificacion_schema(DB_PATH):
        print("Actualizacion completada. Tabla notificaciones creada.")
    else:
        print("Esquema notificaciones al dia, sin cambios.")


if __name__ == "__main__":
    main()
