"""Añade de forma idempotente el permiso adicional de calidad a usuarios."""
import importlib.util
from pathlib import Path

from sqlalchemy import inspect, text

from models import db


# Existe también el paquete ``app/``; cargar app.py por ruta evita que Linux
# resuelva ese paquete en lugar del punto de entrada Flask de producción.
app_path = Path(__file__).resolve().parents[1] / "app.py"
spec = importlib.util.spec_from_file_location("swstudio_app_main", app_path)
app_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app_module)
app = app_module.app


with app.app_context():
    columns = {column["name"] for column in inspect(db.engine).get_columns("user")}
    if "acceso_calidad" not in columns:
        with db.engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE user ADD COLUMN acceso_calidad BOOLEAN NOT NULL DEFAULT 0")
            )
        print("Columna acceso_calidad creada")
    else:
        print("Columna acceso_calidad ya existente")
