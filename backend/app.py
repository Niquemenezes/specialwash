from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
from config import Config
from extensions import db
from routes import register_routes
from admin import setup_admin
from update_producto_schema import ensure_producto_schema
from update_producto_codigos_schema import ensure_producto_codigos_schema
from update_servicio_cliente_schema import ensure_servicio_cliente_schema
from update_user_schema import ensure_user_schema


load_dotenv()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Aumentar límite de subida de archivos a 200MB (para videos)
    app.config['MAX_CONTENT_LENGTH'] = 200 * 1024 * 1024  # 200 MB

    # CORS para frontend local y Codespaces. Con credenciales no debe usarse "*".
    cors_origins = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://194.164.164.78",
      r"https://.*-3000\.app\.github\.dev",
    ]

    # Permite sobreescribir/añadir orígenes desde FRONTEND_URLS o FRONTEND_URL.
    configured_origins = getattr(Config, "CORS_ORIGINS", None)
    if configured_origins:
      if isinstance(configured_origins, str):
        cors_origins.extend(
          [o.strip() for o in configured_origins.split(",") if o.strip()]
        )
      elif isinstance(configured_origins, (list, tuple, set)):
        cors_origins.extend([str(o).strip() for o in configured_origins if str(o).strip()])

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
      # Mantiene compatibilidad con cambios de esquema en Producto.
      ensure_producto_schema()
      ensure_producto_codigos_schema()
      # Mantiene compatibilidad con bases SQLite antiguas sin migraciones formales.
      ensure_servicio_cliente_schema()
      ensure_user_schema()
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
