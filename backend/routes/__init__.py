from api.inspeccion_routes import inspeccion_bp
from api.routes import api as core_api_bp
from routes.almacen_routes import almacen_bp
from routes.auth_routes import auth_bp
from routes.dashboard_routes import dashboard_bp
from routes.export_routes import export_bp
from routes.producto_routes import productos_bp
from routes.proveedor_routes import proveedores_bp
from routes.usuario_routes import usuarios_bp
from routes.parte_trabajo_routes import bp as parte_trabajo_bp
from routes.servicio_catalogo_routes import servicio_catalogo_bp
from routes.cita_routes import citas_bp
from routes.notificacion_routes import notificaciones_bp
from routes.horario_routes import horario_bp


def register_routes(app):
    """Register all API blueprints in one place."""
    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(usuarios_bp, url_prefix="/api")
    app.register_blueprint(productos_bp, url_prefix="/api")
    app.register_blueprint(proveedores_bp, url_prefix="/api")
    app.register_blueprint(almacen_bp, url_prefix="/api")
    app.register_blueprint(core_api_bp, url_prefix="/api")
    app.register_blueprint(inspeccion_bp)
    app.register_blueprint(parte_trabajo_bp, url_prefix="/api")
    app.register_blueprint(servicio_catalogo_bp, url_prefix="/api")
    app.register_blueprint(citas_bp, url_prefix="/api")
    app.register_blueprint(notificaciones_bp, url_prefix="/api")
    app.register_blueprint(horario_bp, url_prefix="/api")
    app.register_blueprint(dashboard_bp, url_prefix="")
    app.register_blueprint(export_bp, url_prefix="")