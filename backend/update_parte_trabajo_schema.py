#!/usr/bin/env python
"""Actualiza la tabla parte_trabajo agregando columnas faltantes si no existen."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"

COLUMNS = {
    "tiempo_estimado_minutos": "INTEGER NOT NULL DEFAULT 0",
    "lote_uid": "TEXT",
    "tipo_tarea": "TEXT",
    "fase": "TEXT",
    "pausas": "TEXT",
    "inspeccion_id": "INTEGER",
    "servicio_catalogo_id": "INTEGER",
    "es_tarea_interna": "INTEGER NOT NULL DEFAULT 0",
}


def ensure_parte_trabajo_schema(db_path: Path = DB_PATH) -> bool:
    """Retorna True si agregó al menos una columna, False si no hubo cambios."""
    if not db_path.exists():
        return False

    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(parte_trabajo)")
        existing = {row[1] for row in cur.fetchall()}

        updated = False
        for column_name, column_def in COLUMNS.items():
            if column_name in existing:
                continue
            cur.execute(f"ALTER TABLE parte_trabajo ADD COLUMN {column_name} {column_def}")
            updated = True
            print(f"  + Columna añadida: {column_name}")

        if updated:
            # Índice para lote_uid si no existe
            cur.execute(
                "CREATE INDEX IF NOT EXISTS idx_parte_trabajo_lote_uid ON parte_trabajo(lote_uid)"
            )
            conn.commit()
        return updated
    finally:
        conn.close()


def main():
    if not DB_PATH.exists():
        print(f"No existe la base de datos en: {DB_PATH}")
        return

    updated = ensure_parte_trabajo_schema(DB_PATH)
    if updated:
        print("Actualización completada.")
    else:
        print("Esquema al día, no se agregaron columnas.")


if __name__ == "__main__":
    main()
