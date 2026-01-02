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

# Crear aplicación
app = Flask(__name__)
app.config.from_object(Config)
db.init_app(app)

# Crear todas las tablas
with app.app_context():
    db.create_all()
    print("✓ Base de datos inicializada correctamente")
    print(f"✓ Archivo: specialwash.db")
