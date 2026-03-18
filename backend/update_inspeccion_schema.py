#!/usr/bin/env python
"""Actualiza la tabla inspeccion_recepcion con columnas nuevas si faltan."""

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "instance" / "specialwash.db"

NEW_COLUMNS = {
    # Datos de respaldo (por si cliente o coche no existen aún)
    "cliente_id": "INTEGER",
    "coche_id": "INTEGER",
    "cliente_nombre": "VARCHAR(200) NOT NULL DEFAULT ''",
    "cliente_telefono": "VARCHAR(30) NOT NULL DEFAULT ''",
    "coche_descripcion": "VARCHAR(250) NOT NULL DEFAULT ''",
    "matricula": "VARCHAR(30)",
    "kilometros": "INTEGER",
    
    # Firmas de recepción
    "es_concesionario": "BOOLEAN NOT NULL DEFAULT 0",
    "firma_cliente_recepcion": "TEXT",
    "firma_empleado_recepcion": "TEXT",
    "consentimiento_datos_recepcion": "BOOLEAN NOT NULL DEFAULT 0",
    "fecha_inspeccion": "DATETIME",
    
    # Evidencias
    "fotos_cloudinary": "TEXT DEFAULT '[]'",
    "videos_cloudinary": "TEXT DEFAULT '[]'",
    
    # Observaciones / averias
    "averias_notas": "TEXT",
    "servicios_aplicados": "TEXT DEFAULT '[]'",
    
    # Datos de entrega / cierre
    "entregado": "BOOLEAN NOT NULL DEFAULT 0",
    "fecha_entrega": "DATETIME",
    "firma_cliente_entrega": "TEXT",
    "firma_empleado_entrega": "TEXT",
    "consentimiento_datos_entrega": "BOOLEAN NOT NULL DEFAULT 0",
    "conformidad_revision_entrega": "BOOLEAN NOT NULL DEFAULT 0",
    "trabajos_realizados": "TEXT",
    "entrega_observaciones": "TEXT",
    "cobro_estado": "VARCHAR(30) NOT NULL DEFAULT 'pendiente'",
    "cobro_importe_pagado": "FLOAT NOT NULL DEFAULT 0",
    "cobro_fecha_ultimo_pago": "DATETIME",
    "cobro_metodo": "VARCHAR(50)",
    "cobro_referencia": "VARCHAR(120)",
    "cobro_observaciones": "TEXT",
    
    # Repaso pre-entrega
    "repaso_checklist": "TEXT DEFAULT '{}'",
    "repaso_notas": "TEXT",
    "repaso_completado": "BOOLEAN NOT NULL DEFAULT 0",
    "repaso_completado_por_id": "INTEGER",
    "repaso_completado_por_nombre": "VARCHAR(120)",
    "repaso_completado_at": "DATETIME",
    
    # Estado
    "confirmado": "BOOLEAN NOT NULL DEFAULT 0",
    "created_at": "DATETIME",
    "updated_at": "DATETIME",
}


def ensure_inspeccion_schema(db_path: Path = DB_PATH) -> bool:
    """Retorna True si aplicó cambios de columnas en inspeccion_recepcion."""
    if not db_path.exists():
        return False

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    changed = False
    try:
        cur.execute("PRAGMA table_info(inspeccion_recepcion)")
        existing = {row[1] for row in cur.fetchall()}

        for col_name, col_type in NEW_COLUMNS.items():
            if col_name in existing:
                continue
            sql = f"ALTER TABLE inspeccion_recepcion ADD COLUMN {col_name} {col_type}"
            cur.execute(sql)
            changed = True
            print(f"+ Columna agregada: {col_name}")

        if changed:
            conn.commit()
        return changed
    finally:
        conn.close()


def main():
    if not DB_PATH.exists():
      print(f"No existe la base de datos en: {DB_PATH}")
      return

    if not ensure_inspeccion_schema(DB_PATH):
        print("Esquema al dia, no se agregaron columnas.")
    else:
        print("Actualizacion completada. Se agregaron columnas faltantes.")


if __name__ == "__main__":
    main()
