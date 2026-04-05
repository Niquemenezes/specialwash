from sqlalchemy import inspect, text

from extensions import db


def ensure_parte_trabajo_schema():
    """Agrega columnas nuevas de parte_trabajo si la base ya existia."""
    engine = db.engine
    inspector = inspect(engine)

    if not inspector.has_table("parte_trabajo"):
        return

    existing = {col["name"] for col in inspector.get_columns("parte_trabajo")}

    with engine.begin() as conn:
        if "inspeccion_id" not in existing:
            conn.execute(text("ALTER TABLE parte_trabajo ADD COLUMN inspeccion_id INTEGER"))
        if "servicio_catalogo_id" not in existing:
            conn.execute(text("ALTER TABLE parte_trabajo ADD COLUMN servicio_catalogo_id INTEGER"))
        if "es_tarea_interna" not in existing:
            conn.execute(text("ALTER TABLE parte_trabajo ADD COLUMN es_tarea_interna BOOLEAN DEFAULT 0"))
