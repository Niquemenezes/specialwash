import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__)))

from flask import Flask, request, jsonify, send_from_directory
from flask_migrate import Migrate
from flask_swagger import swagger
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from api.utils import APIException, generate_sitemap
from api.models import db
from api.routes import api
from api.admin import setup_admin
from api.commands import setup_commands



# Configuración del entorno
ENV = os.getenv("FLASK_ENV", "development")

# Directorio de archivos estáticos: CAMBIADO A "dist"
static_file_dir = os.path.join(os.path.dirname(os.path.realpath(__file__)), '../dist/')

# Inicializar Flask app con carpeta de estáticos "dist"
app = Flask(__name__, static_folder="../dist", static_url_path="")
app.url_map.strict_slashes = False

# Habilitar CORS
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"],
     expose_headers=["Authorization"])


# JWT
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "super-secret-key")
jwt = JWTManager(app)

# Base de datos
db_url = os.getenv("DATABASE_URL")
if db_url:
    app.config['SQLALCHEMY_DATABASE_URI'] = db_url.replace("postgres://", "postgresql://")
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = "sqlite:////tmp/test.db"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
MIGRATE = Migrate(app, db, compare_type=True)
db.init_app(app)

# Admin y comandos CLI
setup_admin(app)
setup_commands(app)

# Rutas de la API
app.register_blueprint(api, url_prefix='/api')

# Manejo de errores
@app.errorhandler(APIException)
def handle_invalid_usage(error):
    return jsonify(error.to_dict()), error.status_code

# Sitemap en modo desarrollo
@app.route('/')
def sitemap():
    if ENV == "development":
        return generate_sitemap(app)
    return send_from_directory(app.static_folder, 'index.html')

# Archivos estáticos (React)
@app.route('/<path:path>', methods=['GET'])
def serve_any_other_file(path):
    file_path = os.path.join(static_file_dir, path)
    if not os.path.isfile(file_path):
        path = 'index.html'
    response = send_from_directory(static_file_dir, path)
    response.cache_control.max_age = 0
    return response

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

# Ejecutar localmente
if __name__ == '__main__':
    PORT = int(os.environ.get('PORT', 3001))
    app.run(host='0.0.0.0', port=PORT, debug=True)
