#!/usr/bin/env python
"""Script para inicializar la base de datos"""
import sys
import os

# Ir al directorio del script
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.getcwd())

# Cargar las variables de entorno
from dotenv import load_dotenv
load_dotenv()

is_production = os.getenv("FLASK_ENV", "development").strip().lower() == "production"
bootstrap_enabled = str(os.getenv("ENABLE_DB_BOOTSTRAP", "0" if is_production else "1")).strip().lower() in {"1", "true", "yes", "on"}

if is_production and not bootstrap_enabled:
    raise SystemExit("Bootstrap de BD desactivado en producción. Usa ENABLE_DB_BOOTSTRAP=1 solo para una inicialización controlada.")

# Importar Flask y configuración
from flask import Flask
from config import Config
from models import db

# Importar todos los modelos para que SQLAlchemy los reconozca
from models.user import User
from models.producto import Producto
from models.proveedor import Proveedor
from models.entrada import Entrada
from models.salida import Salida
from models.maquinaria import Maquinaria
from models.cliente import Cliente
from models.coche import Coche
from models.servicio import Servicio
from models.inspeccion_recepcion import InspeccionRecepcion
from models.gasto_empresa import GastoEmpresa
from models.acta_entrega import ActaEntrega

# Crear aplicación
app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

# Crear todas las tablas
with app.app_context():
    db.create_all()
    print("✓ Base de datos inicializada correctamente")
    print(f"✓ Archivo: specialwash.db")
