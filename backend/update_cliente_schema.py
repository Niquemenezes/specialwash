"""Actualiza la tabla clientes agregando columnas faltantes si no existen."""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"

COLUMNS = {
    "nombre_fiscal": "TEXT",
}


def ensure_cliente_schema(db_path: Path = DB_PATH) -> bool:
    if not db_path.exists():
        return False
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(clientes)")
        existing = {row[1] for row in cur.fetchall()}
        updated = False
        for column_name, column_def in COLUMNS.items():
            if column_name in existing:
                continue
            cur.execute(f"ALTER TABLE clientes ADD COLUMN {column_name} {column_def}")
            updated = True
            print(f"  + Columna añadida a clientes: {column_name}")
        if updated:
            conn.commit()
        return updated
    finally:
        conn.close()


if __name__ == "__main__":
    updated = ensure_cliente_schema(DB_PATH)
    print("Actualización completada." if updated else "Esquema al día.")
