import os
from flask import abort, has_request_context, request
from flask_admin import Admin
from flask_admin.contrib.sqla import ModelView
from flask_jwt_extended import get_jwt, verify_jwt_in_request
from wtforms.fields import PasswordField
from models import (
    db, User, Producto, ProductoCodigoBarras, Proveedor, Entrada, Salida, 
    Maquinaria, Cliente, Coche, Servicio, ServicioCatalogo, ServicioCliente, 
    InspeccionRecepcion, GastoEmpresa, ActaEntrega, ParteTrabajo, Cita
)


def _is_production():
    return os.getenv("FLASK_ENV", "development").strip().lower() == "production"


def _is_local_request():
    if not has_request_context():
        return False
    host = (request.host or "").split(":")[0].strip().lower()
    return host in {"127.0.0.1", "localhost"}


def _admin_enabled():
    """
    Panel de admin habilitado por defecto en desarrollo y deshabilitado
    por defecto en producción, salvo que ENABLE_ADMIN=1 lo fuerce.
    """
    default = "0" if _is_production() else "1"
    raw = str(os.getenv("ENABLE_ADMIN", default)).strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _current_user_is_admin():
    """Devuelve True si hay un JWT válido con rol 'administrador'."""
    try:
        verify_jwt_in_request()
        claims = get_jwt() or {}
        from utils.auth_utils import normalize_role
        return normalize_role(claims.get("rol")) == "administrador"
    except Exception:
        return False


# === Clases personalizadas para mejorar apariencia y seguridad ===
class SecureModelView(ModelView):
    can_view_details = True          # permite ver detalle sin editar
    can_export = True                # exportar CSV
    page_size = 20                   # paginación
    column_display_pk = False        # oculta id si no es necesario
    column_exclude_list = ('password_hash',)  # 🔒 ocultar hashes de contraseñas
    column_default_sort = ('id', True)

    form_excluded_columns = ('password_hash',)  # no editable
    create_modal = True
    edit_modal = True

    # Estilo más legible en formularios
    form_widget_args = {
        'nombre': {'style': 'width: 50%;'},
        'email': {'style': 'width: 50%;'},
    }

    def is_accessible(self):
        if not _admin_enabled():
            return False
        return True

    def inaccessible_callback(self, name, **kwargs):
        if not _admin_enabled():
            abort(404)
        abort(403)


class UserAdmin(SecureModelView):
    form_extra_fields = {
        'password': PasswordField('Nueva contraseña')
    }

    def on_model_change(self, form, model, is_created):
        """Cifra contraseña si se introduce."""
        from werkzeug.security import generate_password_hash
        if form.password.data:
            model.password_hash = generate_password_hash(form.password.data)


class ServicioCatalogoAdmin(SecureModelView):
    # Mantener solo columnas existentes en el modelo sincronizado desde producción.
    column_list = (
        "nombre",
        "descripcion",
        "precio_base",
        "tiempo_estimado_minutos",
        "activo",
        "created_at",
    )
    form_columns = (
        "nombre",
        "descripcion",
        "precio_base",
        "tiempo_estimado_minutos",
        "activo",
    )


class ParteTrabajoAdmin(SecureModelView):
    # Exponer campos clave para seguimiento operativo y tareas internas.
    column_list = (
        "id",
        "coche_id",
        "empleado_id",
        "tipo_tarea",
        "estado",
        "fecha_inicio",
        "fecha_fin",
        "tiempo_estimado_minutos",
    )
    form_columns = (
        "coche_id",
        "empleado_id",
        "tipo_tarea",
        "observaciones",
        "estado",
        "fecha_inicio",
        "fecha_fin",
        "tiempo_estimado_minutos",
    )


def setup_admin(app):
    # 🔐 Configuración básica
    if not app.secret_key:
        # Evita fallback inseguro; usa solo claves reales de entorno si no hay una ya configurada.
        app.secret_key = os.environ.get("FLASK_APP_KEY") or os.environ.get("SECRET_KEY")
    if not app.secret_key:
        raise RuntimeError(
            "[SECURITY] Flask secret_key no está configurada. "
            "Define SECRET_KEY o FLASK_APP_KEY en el entorno antes de arrancar."
        )
    app.config['FLASK_ADMIN_SWATCH'] = 'flatly'   # 🌙 Tema moderno y limpio

    admin = Admin(
        app,
        name="SpecialWash Admin",
        url="/admin"
    )

    # === Secciones ===
    # GESTIÓN DE USUARIOS
    admin.add_view(UserAdmin(User, db.session, name="👤 Usuarios"))
    
    # INVENTARIO
    admin.add_view(SecureModelView(Producto, db.session, name="📦 Productos"))
    admin.add_view(SecureModelView(ProductoCodigoBarras, db.session, name="🏷️ Códigos Barras"))
    
    # PROVEEDORES Y COMPRAS
    admin.add_view(SecureModelView(Proveedor, db.session, name="🤝 Proveedores"))
    admin.add_view(SecureModelView(Entrada, db.session, name="📥 Entradas"))
    admin.add_view(SecureModelView(Salida, db.session, name="📤 Salidas"))
    
    # RECURSOS
    admin.add_view(SecureModelView(Maquinaria, db.session, name="🔧 Maquinaria"))
    admin.add_view(SecureModelView(GastoEmpresa, db.session, name="💸 Gastos Empresa"))
    
    # CLIENTES Y COCHES
    admin.add_view(SecureModelView(Cliente, db.session, name="👥 Clientes"))
    admin.add_view(SecureModelView(Coche, db.session, name="🚗 Coches"))
    admin.add_view(SecureModelView(Cita, db.session, name="📅 Citas"))
    
    # SERVICIOS
    admin.add_view(ServicioCatalogoAdmin(ServicioCatalogo, db.session, name="📋 Catálogo Servicios"))
    admin.add_view(SecureModelView(Servicio, db.session, name="🛠️ Servicios Realizados"))
    admin.add_view(SecureModelView(ServicioCliente, db.session, name="💰 Tarifas Personalizadas"))
    
    # PARTES DE TRABAJO
    admin.add_view(ParteTrabajoAdmin(ParteTrabajo, db.session, name="🧰 Partes Trabajo"))
    
    # INSPECCIONES Y ENTREGAS
    admin.add_view(SecureModelView(InspeccionRecepcion, db.session, name="🔍 Inspecciones"))
    admin.add_view(SecureModelView(ActaEntrega, db.session, name="📄 Actas Entrega"))

    # ⚠️ En producción, considera protegerlo con login o eliminarlo
    return admin

    
