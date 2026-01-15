import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import app
from models import Salida, Producto

with app.app_context():
    print("=" * 50)
    print("VERIFICANDO SALIDAS EN LA BASE DE DATOS")
    print("=" * 50)
    
    total = Salida.query.count()
    print(f"\nTotal de salidas: {total}")
    
    if total > 0:
        print("\nÚltimas 5 salidas:")
        salidas = Salida.query.order_by(Salida.fecha.desc()).limit(5).all()
        for s in salidas:
            print(f"\n  ID: {s.id}")
            print(f"  Producto: {s.producto_nombre}")
            print(f"  Cantidad: {s.cantidad}")
            print(f"  Precio total: {s.precio_total}")
            print(f"  Fecha: {s.fecha}")
    else:
        print("\n⚠️  No hay salidas registradas en la base de datos")
    
    print("\n" + "=" * 50)
