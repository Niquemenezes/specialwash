#!/usr/bin/env python
"""
Hace empleado_id nullable en parte_trabajo para soportar partes sin asignar.
El empleado se auto-asigna al hacer clic en "Iniciar trabajo" desde su página.
"""

import re
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"


def make_empleado_nullable(db_path: Path = DB_PATH) -> bool:
    """Retorna True si hizo la migración, False si ya estaba ok."""
    if not db_path.exists():
        print(f"No existe la BD en: {db_path}")
        return False

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    try:
        # ── 1. Verificar si ya es nullable ──────────────────────────────────
        cur.execute("PRAGMA table_info(parte_trabajo)")
        cols_info = cur.fetchall()
        col_map = {row["name"]: row for row in cols_info}

        emp_col = col_map.get("empleado_id")
        if emp_col is None:
            print("WARN: Columna empleado_id no encontrada en parte_trabajo.")
            return False

        if emp_col["notnull"] == 0:
            print("OK: empleado_id ya es nullable. Sin cambios.")
            return False

        print("Migrando empleado_id → nullable ...")

        # ── 2. Obtener SQL original + índices (antes de DROP) ───────────────
        cur.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='parte_trabajo'"
        )
        table_row = cur.fetchone()
        if not table_row:
            print("ERROR: Tabla parte_trabajo no encontrada en sqlite_master.")
            return False
        original_sql = table_row["sql"]

        cur.execute(
            "SELECT sql FROM sqlite_master "
            "WHERE type='index' AND tbl_name='parte_trabajo' AND sql IS NOT NULL"
        )
        index_sqls = [row["sql"] for row in cur.fetchall()]

        # ── 3. Modificar SQL: quitar NOT NULL de empleado_id ────────────────
        new_sql = re.sub(
            r"(empleado_id\s+\w+(?:\([^)]*\))?)\s+NOT\s+NULL",
            r"\1",
            original_sql,
            flags=re.IGNORECASE,
        )

        if new_sql == original_sql:
            print(f"WARN: No se encontró 'NOT NULL' para empleado_id.")
            print(f"  SQL original: {original_sql}")
            return False

        # SQL para tabla temporal
        temp_sql = re.sub(
            r"\bparte_trabajo\b",
            "parte_trabajo_migration_tmp",
            new_sql,
            count=1,
        )

        col_names = [row["name"] for row in sorted(cols_info, key=lambda x: x["cid"])]
        cols_str = ", ".join(col_names)

        # ── 4. Ejecutar migración ────────────────────────────────────────────
        conn.execute("PRAGMA foreign_keys = OFF")
        conn.commit()

        try:
            cur.execute(temp_sql)
            cur.execute(
                f"INSERT INTO parte_trabajo_migration_tmp ({cols_str}) "
                f"SELECT {cols_str} FROM parte_trabajo"
            )
            cur.execute("DROP TABLE parte_trabajo")
            cur.execute(
                "ALTER TABLE parte_trabajo_migration_tmp RENAME TO parte_trabajo"
            )

            for idx_sql in index_sqls:
                try:
                    cur.execute(idx_sql)
                except Exception as e:
                    print(f"  Advertencia al recrear índice: {e}")

            conn.commit()
            print("✓ Migración completada: empleado_id ahora acepta NULL.")
            return True

        except Exception as e:
            conn.rollback()
            print(f"ERROR en migración: {e}")
            raise

    finally:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.commit()
        conn.close()


def main():
    make_empleado_nullable()


if __name__ == "__main__":
    main()
