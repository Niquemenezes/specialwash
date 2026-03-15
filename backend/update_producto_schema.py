#!/usr/bin/env python
"""Actualiza la tabla producto agregando columna codigo_barras en SQLite."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"


def ensure_producto_schema(db_path: Path = DB_PATH) -> bool:
    """Retorna True si hizo cambios, False si no hizo falta."""
    if not db_path.exists():
        return False

    conn = sqlite3.connect(db_path)
    changed = False
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info('producto')")
        existing = {row[1] for row in cur.fetchall()}

        if "codigo_barras" not in existing:
            cur.execute("ALTER TABLE producto ADD COLUMN codigo_barras TEXT")
            changed = True

        if "pedido_en_curso" not in existing:
            cur.execute("ALTER TABLE producto ADD COLUMN pedido_en_curso INTEGER DEFAULT 0")
            changed = True

        if "pedido_fecha" not in existing:
            cur.execute("ALTER TABLE producto ADD COLUMN pedido_fecha TEXT")
            changed = True

        if "pedido_cantidad" not in existing:
            cur.execute("ALTER TABLE producto ADD COLUMN pedido_cantidad INTEGER")
            changed = True

        if "pedido_canal" not in existing:
            cur.execute("ALTER TABLE producto ADD COLUMN pedido_canal TEXT")
            changed = True

        if "pedido_proveedor_id" not in existing:
            cur.execute("ALTER TABLE producto ADD COLUMN pedido_proveedor_id INTEGER")
            changed = True

        # Intentar crear indice unico para evitar duplicados.
        cur.execute("PRAGMA index_list('producto')")
        indexes = {row[1] for row in cur.fetchall()}
        if "idx_producto_codigo_barras" not in indexes:
            cur.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_producto_codigo_barras "
                "ON producto(codigo_barras) WHERE codigo_barras IS NOT NULL"
            )
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

    if ensure_producto_schema(DB_PATH):
        print("Actualizacion completada. Tabla producto ajustada con codigo_barras.")
    else:
        print("Esquema producto al dia, sin cambios.")


if __name__ == "__main__":
    main()
