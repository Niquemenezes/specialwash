import os
from datetime import timedelta

class Config:
    # Claves (usar variables de entorno en producción)
    SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_key")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt_secret_key")
    
    # Duración del token JWT (2 horas)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=2)

    # Base de datos (usa SQLite local)
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(BASE_DIR, 'instance', 'specialwash.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # CORS - Lista separada por comas. Ejemplo:
    # FRONTEND_URLS=http://localhost:3000,https://mi-codespace-3000.app.github.dev
    CORS_ORIGINS = os.getenv("FRONTEND_URLS") or os.getenv("FRONTEND_URL", "http://localhost:3000")

    # OpenAI (asistente de redaccion premium de actas)
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
