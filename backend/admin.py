import os
from flask import abort
from flask_admin import Admin
from flask_admin.contrib.sqla import ModelView
from wtforms.fields import PasswordField
from models import (
    db, User, Producto, ProductoCodigoBarras, Proveedor, Entrada, Salida, 
    Maquinaria, Cliente, Coche, Servicio, ServicioCatalogo, ServicioCliente, 
    InspeccionRecepcion, GastoEmpresa, ActaEntrega, ParteTrabajo, Cita
)


def _is_production():
    return os.getenv("FLASK_ENV", "development").strip().lower() == "production"


def _admin_enabled():
    # Mantener panel admin visible para recuperar el comportamiento anterior.
    return True


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
        return _admin_enabled()

    def inaccessible_callback(self, name, **kwargs):
        return abort(403)


class UserAdmin(SecureModelView):
    form_extra_fields = {
        'password': PasswordField('Nueva contraseña')
    }

    def on_model_change(self, form, model, is_created):
        """Cifra contraseña si se introduce."""
        from werkzeug.security import generate_password_hash
        if form.password.data:
            model.password_hash = generate_password_hash(form.password.data)


def setup_admin(app):
    # 🔐 Configuración básica
    if not app.secret_key:
        # Evita fallback inseguro; usa solo claves reales de entorno si no hay una ya configurada.
        app.secret_key = os.environ.get("FLASK_APP_KEY") or os.environ.get("SECRET_KEY")
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
    admin.add_view(SecureModelView(ServicioCatalogo, db.session, name="📋 Catálogo Servicios"))
    admin.add_view(SecureModelView(Servicio, db.session, name="🛠️ Servicios Realizados"))
    admin.add_view(SecureModelView(ServicioCliente, db.session, name="💰 Tarifas Personalizadas"))
    
    # PARTES DE TRABAJO
    admin.add_view(SecureModelView(ParteTrabajo, db.session, name="🧰 Partes Trabajo"))
    
    # INSPECCIONES Y ENTREGAS
    admin.add_view(SecureModelView(InspeccionRecepcion, db.session, name="🔍 Inspecciones"))
    admin.add_view(SecureModelView(ActaEntrega, db.session, name="📄 Actas Entrega"))

    # ⚠️ En producción, considera protegerlo con login o eliminarlo
    return admin

    
