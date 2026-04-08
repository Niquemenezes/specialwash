"""
cleanup_clientes.py
-------------------
Borra todos los datos operativos de prueba:
  acta_entrega, parte_trabajo, citas, inspeccion_recepcion,
  clientes  →  (cascade) coches, servicios, servicios_cliente

Conserva: usuarios, catalogo de servicios, productos, maquinaria,
          proveedores, gastos, registro_horario, notificaciones.

Uso (desde /var/www/specialwash/app/backend):
    python cleanup_clientes.py
"""

import sys
import os

# Asegurar que se carga el módulo correcto
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from extensions import db
from models.acta_entrega import ActaEntrega
from models.parte_trabajo import ParteTrabajo
from models.cita import Cita
from models.inspeccion_recepcion import InspeccionRecepcion
from models.cliente import Cliente

app = create_app()

with app.app_context():
    # ── Conteo previo ────────────────────────────────────────────────
    prev = {
        "actas":        ActaEntrega.query.count(),
        "partes":       ParteTrabajo.query.count(),
        "citas":        Cita.query.count(),
        "inspecciones": InspeccionRecepcion.query.count(),
        "clientes":     Cliente.query.count(),
    }
    print("\n── Registros ANTES del borrado ──")
    for k, v in prev.items():
        print(f"  {k:>15}: {v}")

    confirm = input("\n¿Confirmas borrar todos estos registros? [s/N] ").strip().lower()
    if confirm != "s":
        print("Operación cancelada.")
        sys.exit(0)

    # ── Borrado en orden de dependencias ────────────────────────────
    print("\nBorrando...")

    n_actas = ActaEntrega.query.delete()
    print(f"  acta_entrega:          {n_actas} eliminadas")

    n_partes = ParteTrabajo.query.delete()
    print(f"  parte_trabajo:         {n_partes} eliminados")

    n_citas = Cita.query.delete()
    print(f"  citas:                 {n_citas} eliminadas")

    n_inspecciones = InspeccionRecepcion.query.delete()
    print(f"  inspeccion_recepcion:  {n_inspecciones} eliminadas")

    # Clientes cascadea a: coches, servicios, servicios_cliente
    n_clientes = Cliente.query.delete()
    print(f"  clientes (+coches, servicios, servicios_cliente): {n_clientes} clientes eliminados")

    db.session.commit()
    print("\n✓ Limpieza completada y confirmada en base de datos.")
