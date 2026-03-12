#!/usr/bin/env python
"""Crea la tabla citas si no existe en SQLite."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"


def ensure_cita_schema(db_path: Path = DB_PATH) -> bool:
    """Retorna True si creó la tabla, False si ya existía o no hay BD."""
    if not db_path.exists():
        return False

    conn = sqlite3.connect(db_path)
    changed = False
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='citas'"
        )
        exists = cur.fetchone() is not None

        if not exists:
            cur.execute(
                """
                CREATE TABLE citas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cliente_id INTEGER NOT NULL,
                    coche_id INTEGER NULL,
                    fecha_hora DATETIME NOT NULL,
                    motivo VARCHAR(300) NOT NULL,
                    notas TEXT NULL,
                    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
                    creada_en DATETIME NULL,
                    creada_por_id INTEGER NULL,
                    FOREIGN KEY(cliente_id) REFERENCES clientes(id),
                    FOREIGN KEY(coche_id) REFERENCES coches(id),
                    FOREIGN KEY(creada_por_id) REFERENCES user(id)
                )
                """
            )
            cur.execute("CREATE INDEX IF NOT EXISTS ix_citas_cliente_id ON citas (cliente_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS ix_citas_coche_id ON citas (coche_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS ix_citas_fecha_hora ON citas (fecha_hora)")
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

    if ensure_cita_schema(DB_PATH):
        print("Actualizacion completada. Tabla citas creada.")
    else:
        print("Esquema citas al dia, sin cambios.")


if __name__ == "__main__":
    main()
