def to_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def to_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def parse_decimal(value):
    """Convierte un string numérico (coma o punto) a float redondeado a 2 decimales.
    Soporta '1.234,56' (ES) y '1,234.56' (EN). Retorna None si no es parseable.
    """
    if value is None:
        return None
    candidate = str(value).strip().replace(" ", "")
    if not candidate:
        return None
    if "," in candidate and "." in candidate:
        candidate = candidate.replace(".", "").replace(",", ".")
    else:
        candidate = candidate.replace(",", ".")
    try:
        return round(float(candidate), 2)
    except ValueError:
        return None
