from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from zoneinfo import ZoneInfo

db = SQLAlchemy()

# Declarative base para modelos
from sqlalchemy.ext.declarative import declarative_base
Base = declarative_base()

TZ_MADRID = ZoneInfo("Europe/Madrid")


def iso(dt):
    if not dt:
        return None
    try:
        return dt.isoformat()
    except Exception:
        return str(dt)


def now_madrid():
    """Retorna datetime naive en hora de Madrid para almacenamiento en SQLite."""
    return datetime.now(TZ_MADRID).replace(tzinfo=None)


def attach_madrid(naive_dt):
    """Adjunta timezone de Madrid a un datetime naive leído de SQLite."""
    if naive_dt is None:
        return None
    if naive_dt.tzinfo is not None:
        return naive_dt
    return naive_dt.replace(tzinfo=TZ_MADRID)
