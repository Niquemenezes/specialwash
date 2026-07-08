import importlib.util
from pathlib import Path

app_path = Path(__file__).resolve().parent / "app.py"
spec = importlib.util.spec_from_file_location("specialwash_app_main", app_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
app = module.app
from flask_jwt_extended import create_access_token
from models.user import User

with app.app_context():
    user = User.query.filter_by(email="m@m").first() or User.query.first()
    if not user:
        print("NO_USER")
    else:
        token = create_access_token(
            identity=str(user.id),
            additional_claims={
                "rol": (user.rol or "administrador"),
                "email": (user.email or ""),
            },
        )
        print(f"USER_ID={user.id}")
        print(f"USER_EMAIL={user.email}")
        print(f"USER_ROLE={user.rol}")
        print(f"TOKEN={token}")
