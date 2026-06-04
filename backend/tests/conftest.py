import os
import sys
import importlib.util

# Set test environment BEFORE any app imports so Config picks up the right values.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["FLASK_ENV"] = "testing"
os.environ["ENABLE_DB_BOOTSTRAP"] = "0"
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-key")

_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, _backend_dir)

# app/ package shadows app.py — load app.py directly via importlib.
_spec = importlib.util.spec_from_file_location(
    "_app_main", os.path.join(_backend_dir, "app.py")
)
_app_main = importlib.util.module_from_spec(_spec)
sys.modules["_app_main"] = _app_main

from sqlalchemy.pool import StaticPool
from config import Config

Config.SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
Config.SQLALCHEMY_ENGINE_OPTIONS = {
    "connect_args": {"check_same_thread": False},
    "poolclass": StaticPool,
}

_spec.loader.exec_module(_app_main)
create_app = _app_main.create_app

import pytest
from werkzeug.security import generate_password_hash

from models.base import db as _db
from models.user import User


@pytest.fixture(scope="session")
def app():
    application = create_app()
    application.config["TESTING"] = True
    with application.app_context():
        _db.create_all()
        yield application
        _db.drop_all()


@pytest.fixture(autouse=True)
def db_cleanup(app):
    yield
    with app.app_context():
        _db.drop_all()
        _db.create_all()


@pytest.fixture(scope="function")
def client(app):
    return app.test_client()


@pytest.fixture(scope="function")
def admin_user(app):
    with app.app_context():
        user = User(
            nombre="Admin Test",
            email="admin@test.com",
            rol="administrador",
            password_hash=generate_password_hash("test123"),
            activo=True,
        )
        _db.session.add(user)
        _db.session.commit()
        return user.id


@pytest.fixture(scope="function")
def auth_headers(client, admin_user):
    from flask_jwt_extended import create_access_token

    with client.application.app_context():
        token = create_access_token(
            identity=str(admin_user),
            additional_claims={"rol": "administrador"},
        )
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="function")
def inspeccion_api(client, auth_headers):
    """Crea una inspección vía API y devuelve su id."""
    payload = {
        "cliente_nombre": "Fixture Cliente",
        "cliente_telefono": "600000001",
        "coche_descripcion": "Seat Ibiza",
        "matricula": "FXTSI1",
        "kilometros": 5000,
        "firma_cliente_recepcion": "data:image/png;base64,Zml4dHVyZQ==",
        "consentimiento_datos_recepcion": True,
        "servicios_aplicados": [{"nombre": "Lavado", "precio": 15, "tipo_tarea": "detailing"}],
    }
    resp = client.post("/api/inspeccion-recepcion", json=payload, headers=auth_headers)
    assert resp.status_code == 201, f"No se pudo crear inspección fixture: {resp.get_json()}"
    return resp.get_json()["id"]


@pytest.fixture(scope="function")
def inspeccion_db(app, admin_user):
    """Crea una inspección directamente en BD y devuelve su id."""
    with app.app_context():
        from models import InspeccionRecepcion, Cliente, Coche

        cliente = Cliente(nombre="DB Cliente", telefono="600000002")
        _db.session.add(cliente)
        _db.session.flush()

        coche = Coche(
            matricula="DBFIX1", marca="Honda", modelo="Civic", cliente_id=cliente.id
        )
        _db.session.add(coche)
        _db.session.flush()

        insp = InspeccionRecepcion(
            usuario_id=admin_user,
            cliente_id=cliente.id,
            coche_id=coche.id,
            cliente_nombre="DB Cliente",
            cliente_telefono="600000002",
            coche_descripcion="Honda Civic",
            matricula="DBFIX1",
            kilometros=5000,
            es_concesionario=False,
            firma_cliente_recepcion="data:image/png;base64,dGVzdA==",
            consentimiento_datos_recepcion=True,
            servicios_aplicados='[{"nombre": "Lavado", "precio": 15}]',
        )
        _db.session.add(insp)
        _db.session.commit()
        return insp.id


@pytest.fixture(scope="function")
def inspeccion_concesionario_repasada(app, admin_user):
    """Crea una inspección de concesionario con repaso completado."""
    with app.app_context():
        from models import InspeccionRecepcion, Cliente, Coche

        cliente = Cliente(nombre="Concesionario SA", telefono="600000003")
        _db.session.add(cliente)
        _db.session.flush()

        coche = Coche(
            matricula="CONCES1", marca="BMW", modelo="X5", cliente_id=cliente.id
        )
        _db.session.add(coche)
        _db.session.flush()

        insp = InspeccionRecepcion(
            usuario_id=admin_user,
            cliente_id=cliente.id,
            coche_id=coche.id,
            cliente_nombre="Concesionario SA",
            cliente_telefono="600000003",
            coche_descripcion="BMW X5",
            matricula="CONCES1",
            kilometros=0,
            es_concesionario=True,
            consentimiento_datos_recepcion=False,
            servicios_aplicados='[{"nombre": "Lavado completo", "precio": 100}]',
            repaso_completado=True,
        )
        _db.session.add(insp)
        _db.session.commit()
        return insp.id


@pytest.fixture(scope="function")
def inspeccion_entregada(app, admin_user):
    """Crea una inspección ya entregada."""
    with app.app_context():
        from models import InspeccionRecepcion, Cliente, Coche
        from models.base import now_madrid

        cliente = Cliente(nombre="Entregado SA", telefono="600000004")
        _db.session.add(cliente)
        _db.session.flush()

        coche = Coche(
            matricula="ENTREGA1", marca="Audi", modelo="A4", cliente_id=cliente.id
        )
        _db.session.add(coche)
        _db.session.flush()

        insp = InspeccionRecepcion(
            usuario_id=admin_user,
            cliente_id=cliente.id,
            coche_id=coche.id,
            cliente_nombre="Entregado SA",
            cliente_telefono="600000004",
            coche_descripcion="Audi A4",
            matricula="ENTREGA1",
            kilometros=15000,
            es_concesionario=False,
            firma_cliente_recepcion="data:image/png;base64,dGVzdA==",
            consentimiento_datos_recepcion=True,
            servicios_aplicados='[{"nombre": "Lavado", "precio": 15}]',
            entregado=True,
            fecha_entrega=now_madrid(),
            repaso_completado=True,
        )
        _db.session.add(insp)
        _db.session.commit()
        return insp.id
