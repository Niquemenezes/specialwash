from werkzeug.security import check_password_hash, generate_password_hash

from models import User, db
from utils.auth_utils import normalize_role


def crear_usuario(nombre, email, password, rol):
    user = User(
        nombre=(nombre or "").strip(),
        email=(email or "").strip().lower(),
        rol=normalize_role(rol),
        password_hash=generate_password_hash(password or ""),
        activo=True,
    )
    db.session.add(user)
    db.session.commit()
    return user


def validar_credenciales(email, password):
    user = User.query.filter_by(email=(email or "").strip().lower()).first()
    if not user or not user.password_hash:
        return None
    if not check_password_hash(user.password_hash, password or ""):
        return None
    return user
