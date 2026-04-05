from sqlalchemy import inspect, text

from extensions import db


def ensure_servicio_catalogo_schema():
    """Agrega columnas nuevas del catalogo si la base ya existia."""
    engine = db.engine
    inspector = inspect(engine)

    if not inspector.has_table("servicios_catalogo"):
        return

    existing = {col["name"] for col in inspector.get_columns("servicios_catalogo")}

    with engine.begin() as conn:
        if "rol_responsable" not in existing:
            conn.execute(text("ALTER TABLE servicios_catalogo ADD COLUMN rol_responsable VARCHAR(30)"))
        # Backfill seguro para filas antiguas sin rol.
        conn.execute(text("UPDATE servicios_catalogo SET rol_responsable = 'otro' WHERE rol_responsable IS NULL OR TRIM(rol_responsable) = ''"))
