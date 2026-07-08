from app import create_app
from models import db


def main():
	app = create_app()
	ctx = app.app_context()
	ctx.push()
	db.create_all()
	print("Tabla creada OK")


if __name__ == '__main__':
	main()
