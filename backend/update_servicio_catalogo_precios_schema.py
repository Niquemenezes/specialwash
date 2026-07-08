"""Migración: añade precio_turismo, precio_suv, precio_todoterreno a servicios_catalogo."""
import sqlite3
import os

DB_PATH = os.environ.get(
    "DATABASE_URL",
    "sqlite:////root/specialwash/backend/instance/specialwash.db"
).replace("sqlite:////", "/").replace("sqlite:///", "")

if not DB_PATH.startswith("/"):
    DB_PATH = os.path.join(os.path.dirname(__file__), "instance", "specialwash.db")

print(f"Base de datos: {DB_PATH}")
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute("PRAGMA table_info(servicios_catalogo)")
cols = {row[1] for row in cur.fetchall()}

added = []
for col, typedef in [
    ("precio_turismo", "FLOAT"),
    ("precio_suv", "FLOAT"),
    ("precio_todoterreno", "FLOAT"),
]:
    if col not in cols:
        cur.execute(f"ALTER TABLE servicios_catalogo ADD COLUMN {col} {typedef}")
        added.append(col)
        print(f"  + {col} añadida")
    else:
        print(f"  - {col} ya existe")

conn.commit()
conn.close()
print("Migración completada." if added else "Sin cambios necesarios.")
