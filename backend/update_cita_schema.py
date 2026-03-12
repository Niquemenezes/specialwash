#!/usr/bin/env python
"""Asegura esquema de citas en SQLite (tabla, columnas e higiene de datos)."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"
ESTADOS_VALIDOS = ("pendiente", "confirmada", "cancelada", "completada")


def ensure_cita_schema(db_path: Path = DB_PATH) -> bool:
    """Retorna True si realizó cambios de esquema o datos, False si no hay cambios."""
    if not db_path.exists():
        return False

    conn = sqlite3.connect(db_path)
    changed = False
    try:
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='citas'")
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
        else:
            cur.execute("PRAGMA table_info('citas')")
            existing = {row[1] for row in cur.fetchall()}

            if "estado" not in existing:
                cur.execute("ALTER TABLE citas ADD COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'")
                changed = True
            if "creada_en" not in existing:
                cur.execute("ALTER TABLE citas ADD COLUMN creada_en DATETIME NULL")
                changed = True
            if "creada_por_id" not in existing:
                cur.execute("ALTER TABLE citas ADD COLUMN creada_por_id INTEGER NULL")
                changed = True

            cur.execute("CREATE INDEX IF NOT EXISTS ix_citas_cliente_id ON citas (cliente_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS ix_citas_coche_id ON citas (coche_id)")
            cur.execute("CREATE INDEX IF NOT EXISTS ix_citas_fecha_hora ON citas (fecha_hora)")

            # Corrige estados legados/inválidos para evitar 500 al mapear enum.
            estados_sql = ", ".join(f"'{estado}'" for estado in ESTADOS_VALIDOS)
            cur.execute(
                f"""
                UPDATE citas
                SET estado = 'pendiente'
                WHERE estado IS NULL OR TRIM(LOWER(estado)) NOT IN ({estados_sql})
                """
            )
            if cur.rowcount and cur.rowcount > 0:
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
