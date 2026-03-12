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
    return datetime.now(TZ_MADRID)
