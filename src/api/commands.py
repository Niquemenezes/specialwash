import click
from api.models import db, Usuario

def setup_commands(app):
    @app.cli.command("insert-test-usuarios")
    @click.argument("count")
    def insert_test_usuarios(count):
        print("Creando usuarios de prueba...")
        for x in range(1, int(count) + 1):
            usuario = Usuario(
                nombre=f"Usuario {x}",
                email=f"test_user{x}@test.com",
                rol="empleado"
            )
            usuario.set_password("123456")
            db.session.add(usuario)
        db.session.commit()
        print(f"{count} usuarios creados exitosamente.")

    @app.cli.command("insert-test-data")
    def insert_test_data():
        print("Aquí puedes insertar datos personalizados si lo necesitas.")
