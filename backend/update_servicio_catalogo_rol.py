#!/usr/bin/env python
"""Script para agregar el campo rol_responsable a la tabla servicios_catalogo"""
import sys
import os

# Ir al directorio del script
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.getcwd())

# Cargar las variables de entorno
from dotenv import load_dotenv
load_dotenv()

# Importar Flask y configuración
from flask import Flask
from config import Config
from models import db
from sqlalchemy import text

# Crear aplicación
app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

with app.app_context():
    try:
        # Verificar si la columna ya existe
        result = db.session.execute(
            text("PRAGMA table_info(servicios_catalogo)")
        ).fetchall()
        column_names = [col[1] for col in result]
        
        if "rol_responsable" not in column_names:
            print("Agregando columna rol_responsable...")
            db.session.execute(
                text("ALTER TABLE servicios_catalogo ADD COLUMN rol_responsable VARCHAR(50)")
            )
            db.session.commit()
            print("✓ Columna rol_responsable agregada correctamente")
        else:
            print("✓ La columna rol_responsable ya existe")
            
    except Exception as e:
        print(f"✗ Error al actualizar la tabla: {str(e)}")
        sys.exit(1)
