from models import db, ServicioCliente
from flask import Flask

app = Flask(__name__)
app.config.from_object("config.Config")
db.init_app(app)

with app.app_context():
    print("Creando tabla 'servicios_cliente'...")
    print("IMPORTANTE: Asegúrate de que el servidor Flask esté detenido")
    input("Presiona Enter para continuar...")
    
    try:
        # Crear la tabla
        ServicioCliente.__table__.create(db.engine, checkfirst=True)
        db.session.commit()
        print("✅ Tabla 'servicios_cliente' creada correctamente")
        print("   Esta tabla permite crear servicios personalizados por cliente")
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error: {e}")
