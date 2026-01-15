import sys
sys.path.insert(0, '.')

import app
from models import Salida

with app.app.app_context():
    salidas = Salida.query.order_by(Salida.fecha.desc()).limit(5).all()
    print(f'Total salidas en DB: {len(Salida.query.all())}')
    print('\nÚltimas 5 salidas:')
    for s in salidas:
        print(f'  - ID {s.id}: {s.producto_nombre}, Cant: {s.cantidad}, Fecha: {s.fecha}')
