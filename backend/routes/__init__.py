from api.inspeccion_routes import inspeccion_bp
from api.routes import api as core_api_bp
from routes.almacen_routes import almacen_bp
from routes.auth_routes import auth_bp
from routes.producto_routes import productos_bp
from routes.proveedor_routes import proveedores_bp
from routes.usuario_routes import usuarios_bp


def register_routes(app):
    """Register all API blueprints in one place."""
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(usuarios_bp, url_prefix="/api")
    app.register_blueprint(productos_bp, url_prefix="/api")
    app.register_blueprint(proveedores_bp, url_prefix="/api")
    app.register_blueprint(almacen_bp, url_prefix="/api")
    app.register_blueprint(core_api_bp, url_prefix="/api")
    app.register_blueprint(inspeccion_bp)
