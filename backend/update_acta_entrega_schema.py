#!/usr/bin/env python
"""Crea la tabla acta_entrega si no existe en SQLite."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"

CREATE_SQL = """
CREATE TABLE IF NOT EXISTS acta_entrega (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspeccion_id INTEGER NOT NULL UNIQUE,
    cliente_nombre TEXT NOT NULL,
    coche_descripcion TEXT NOT NULL,
    matricula TEXT NOT NULL,
    trabajos_realizados TEXT NOT NULL,
    entrega_observaciones TEXT,
    firma_cliente_entrega TEXT NOT NULL,
    firma_empleado_entrega TEXT,
    consentimiento_datos_entrega BOOLEAN NOT NULL DEFAULT 0,
    conformidad_revision_entrega BOOLEAN NOT NULL DEFAULT 0,
    fecha_entrega DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY(inspeccion_id) REFERENCES inspeccion_recepcion(id)
);
"""


def main():
    if not DB_PATH.exists():
        print(f"No existe la base de datos en: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(CREATE_SQL)
    conn.commit()
    conn.close()

    print("Verificacion completada: tabla acta_entrega disponible.")


if __name__ == "__main__":
    main()
