from models import db, Salida
from flask import Flask

app = Flask(__name__)
app.config.from_object("config.Config")
db.init_app(app)

with app.app_context():
    print("Actualizando modelo de Salida...")
    print("IMPORTANTE: Asegúrate de que el servidor Flask esté detenido")
    input("Presiona Enter para continuar...")
    
    try:
        # Recrear la tabla con la nueva definición
        print("Eliminando tabla antigua...")
        db.session.execute(db.text("DROP TABLE IF EXISTS salida_backup"))
        db.session.execute(db.text("ALTER TABLE salida RENAME TO salida_backup"))
        
        print("Creando nueva tabla...")
        Salida.__table__.create(db.engine)
        
        print("Copiando datos...")
        db.session.execute(db.text("""
            INSERT INTO salida (id, fecha, created_at, producto_id, producto_nombre, 
                               usuario_id, cantidad, precio_unitario, precio_total, observaciones)
            SELECT id, fecha, created_at, producto_id, producto_nombre, 
                   usuario_id, cantidad, precio_unitario, precio_total, observaciones
            FROM salida_backup
        """))
        
        print("Eliminando backup...")
        db.session.execute(db.text("DROP TABLE salida_backup"))
        
        db.session.commit()
        print("✅ Tabla actualizada correctamente - ahora los precios pueden ser NULL")
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error: {e}")
        print("\nRestaurando backup...")
        try:
            db.session.execute(db.text("DROP TABLE IF EXISTS salida"))
            db.session.execute(db.text("ALTER TABLE salida_backup RENAME TO salida"))
            db.session.commit()
            print("✅ Backup restaurado")
        except:
            print("❌ Error al restaurar backup")
