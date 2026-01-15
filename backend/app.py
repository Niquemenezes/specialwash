from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from api.routes import api
from models import db
from admin import setup_admin


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
    JWTManager(app)

    db.init_app(app)
    setup_admin(app)

    app.register_blueprint(api, url_prefix="/api")

    with app.app_context():
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
  app.run(debug=True, host='0.0.0.0', port=5000)
