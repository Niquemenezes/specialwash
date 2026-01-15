"""
Script para actualizar la tabla salida - permitir precios NULL
"""
import sys
import os

# Importar directamente desde app.py
import app as app_module
from models import db

app = app_module.app

with app.app_context():
    print("Actualizando tabla 'salida' para permitir precios NULL...")
    
    # Ejecutar comando SQL para alterar las columnas
    try:
        db.session.execute(db.text("""
            ALTER TABLE salida 
            ALTER COLUMN precio_unitario DROP NOT NULL;
        """))
        
        db.session.execute(db.text("""
            ALTER TABLE salida 
            ALTER COLUMN precio_total DROP NOT NULL;
        """))
        
        db.session.commit()
        print("✅ Tabla actualizada correctamente")
        print("   - precio_unitario ahora puede ser NULL")
        print("   - precio_total ahora puede ser NULL")
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error: {e}")
        print("\nSi el error persiste, puedes:")
        print("1. Ejecutar manualmente en tu base de datos:")
        print("   ALTER TABLE salida ALTER COLUMN precio_unitario DROP NOT NULL;")
        print("   ALTER TABLE salida ALTER COLUMN precio_total DROP NOT NULL;")
