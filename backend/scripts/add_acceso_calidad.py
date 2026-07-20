"""Añade de forma idempotente el permiso adicional de calidad a usuarios."""
from sqlalchemy import inspect, text

from app import app
from models import db


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
