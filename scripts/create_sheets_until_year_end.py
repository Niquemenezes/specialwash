from datetime import datetime
import logging
import os
import sys

# Asegurar que el directorio raíz del repo está en sys.path cuando se ejecuta el script
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.services.google_sheets_service import MESES_ES, SPREADSHEET_ID, CREDENTIALS_FILE, _get_worksheet

# Este script crea las hojas mensuales faltantes desde el mes actual hasta diciembre.
# Uso: python scripts/create_sheets_until_year_end.py


def main(year=None):
    now = datetime.now()
    year = year or now.year
    start_month = now.month

    # Conectar para comprobar qué hojas existen
    try:
        import os
        import gspread
        from google.oauth2.service_account import Credentials

        creds_path = os.path.abspath(CREDENTIALS_FILE)
        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(SPREADSHEET_ID)
    except Exception as e:
        print(f"Error al conectar con Google Sheets: {e}")
        return 1

    existing = {ws.title for ws in spreadsheet.worksheets()}

    created = []
    skipped = []

    for m in range(start_month, 13):
        name = MESES_ES[m - 1]
        if name in existing:
            skipped.append(name)
            print(f"Ya existe: {name}")
            continue
        try:
            _get_worksheet(month=m, year=year)
            created.append(name)
            print(f"Creada: {name}")
        except Exception as e:
            print(f"Error creando {name}: {e}")

    print("\nResumen:")
    print(f"Creadas: {len(created)} -> {created}")
    print(f"Existían: {len(skipped)} -> {skipped}")
    return 0


if __name__ == '__main__':
    exit(main())
