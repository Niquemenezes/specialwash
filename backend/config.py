import os

class Config:
    # Claves
    SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_key")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt_secret_key")

    # Base de datos (usa SQLite local)
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'specialwash.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
