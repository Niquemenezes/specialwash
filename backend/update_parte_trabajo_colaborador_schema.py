"""Crea la tabla parte_trabajo_colaborador si no existe."""

import sqlite3
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "instance" / "specialwash.db"


def ensure_parte_trabajo_colaborador_schema(db_path: Path = DB_PATH) -> bool:
    if not Path(db_path).exists():
        return False

    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS parte_trabajo_colaborador (
                id INTEGER PRIMARY KEY,
                parte_id INTEGER NOT NULL,
                empleado_id INTEGER NOT NULL,
                estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
                fecha_inicio DATETIME,
                fecha_fin DATETIME,
                pausas TEXT,
                observaciones VARCHAR,
                created_at DATETIME,
                updated_at DATETIME,
                FOREIGN KEY(parte_id) REFERENCES parte_trabajo(id),
                FOREIGN KEY(empleado_id) REFERENCES user(id)
            )
            """
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_parte_trabajo_colab_parte_id ON parte_trabajo_colaborador(parte_id)"
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_parte_trabajo_colab_empleado_id ON parte_trabajo_colaborador(empleado_id)"
        )
        conn.commit()
        return True
    finally:
        conn.close()


if __name__ == "__main__":
    updated = ensure_parte_trabajo_colaborador_schema(DB_PATH)
    print("OK" if updated else "SKIPPED")

