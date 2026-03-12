from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import os
from config import Config
from extensions import db
from routes import register_routes
from admin import setup_admin
from update_producto_schema import ensure_producto_schema
from update_producto_codigos_schema import ensure_producto_codigos_schema
from update_servicio_cliente_schema import ensure_servicio_cliente_schema
from update_user_schema import ensure_user_schema
from update_cita_schema import ensure_cita_schema
from update_notificacion_schema import ensure_notificacion_schema


load_dotenv()


def _db_bootstrap_enabled():
  raw = str(os.getenv("ENABLE_DB_BOOTSTRAP", "1")).strip().lower()
  return raw in {"1", "true", "yes", "on"}


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Límite de subida definido en config; no sobreescribir aquí
    # (ya está en Config.MAX_CONTENT_LENGTH como 20 MB)

    # CORS: en producción solo los orígenes configurados vía FRONTEND_URLS/FRONTEND_URL.
    # En desarrollo se añaden localhost y patrones de Codespaces.
    is_production = os.getenv("FLASK_ENV", "development").strip().lower() == "production"

    if is_production:
        # Producción: solo los orígenes explícitamente configurados
        configured = getattr(Config, "CORS_ORIGINS", "http://localhost:3000")
        cors_origins = [o.strip() for o in configured.split(",") if o.strip()] if isinstance(configured, str) else list(configured)
    else:
        # Desarrollo: orígenes locales + Codespaces + los configurados
        cors_origins = [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "capacitor://localhost",
            "ionic://localhost",
            r"https://.*-3000\.app\.github\.dev",
        ]
        configured = getattr(Config, "CORS_ORIGINS", "")
        if configured:
            if isinstance(configured, str):
                cors_origins.extend([o.strip() for o in configured.split(",") if o.strip()])
            else:
                cors_origins.extend([str(o).strip() for o in configured if str(o).strip()])

    CORS(
      app,
      resources={r"/api/*": {"origins": cors_origins}},
      supports_credentials=True,
      methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allow_headers=["Content-Type", "Authorization"],
    )
    JWTManager(app)

    db.init_app(app)
    setup_admin(app)

    register_routes(app)

    with app.app_context():
      if _db_bootstrap_enabled():
        # Mantiene compatibilidad con cambios de esquema en Producto.
        ensure_producto_schema()
        ensure_producto_codigos_schema()
        # Mantiene compatibilidad con bases SQLite antiguas sin migraciones formales.
        ensure_servicio_cliente_schema()
        ensure_user_schema()
        ensure_cita_schema()
        ensure_notificacion_schema()
        db.create_all()  # crea las tablas

    # === Página raíz ===
    @app.route("/")
    def index():
        return """
        <html>
          <head><title>SpecialWash Backend</title></head>
          <body style='background-color:#111; color:#f5d76e; font-family:Arial; text-align:center; padding-top:50px'>
            <h1>🚗 SpecialWash Backend</h1>
            <p>Servidor Flask funcionando correctamente.</p>
            <p><a href='/admin/' style='color:#f5d76e; text-decoration:none;'>Ir al panel de administración</a></p>
          </body>
        </html>
        """

    return app


app = create_app()

if __name__ == "__main__":
  debug_mode = str(getattr(Config, "FLASK_DEBUG", "0")).strip().lower() in {"1", "true", "yes", "on"}
  app.run(debug=debug_mode, host='0.0.0.0', port=5000)
