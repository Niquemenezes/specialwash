"""
Añade la inspección del Cupra 6234NNK (Seat, 01/06/2026) a la pestaña Junio de Google Sheets.
Es concesionario → no aplica color (no está entregado aún).
"""
import os, sys, json

SPREADSHEET_ID = "1snVAvnfJ39abubFXGFZ2be566G0QEiEsBjSTS9tcf6M"
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "..", "google_credentials.json")

# Datos de la inspección 78
FECHA = "01/06/2026"
COCHE = "Cupra"
CLIENTE = "Seat"
MATRICULA = "6234NNK"
SERVICIOS = "Limpieza interior exterior"

def main():
    import gspread
    from google.oauth2.service_account import Credentials

    creds = Credentials.from_service_account_file(
        os.path.abspath(CREDENTIALS_FILE),
        scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(SPREADSHEET_ID)

    try:
        worksheet = spreadsheet.worksheet("Junio")
        print("Pestaña Junio encontrada.")
    except gspread.WorksheetNotFound:
        print("ERROR: pestaña Junio no encontrada.")
        sys.exit(1)

    # Verificar si ya existe
    col_d = worksheet.col_values(4)
    for idx, val in enumerate(col_d):
        if str(val).strip().upper() == MATRICULA.strip().upper():
            print(f"  Matrícula {MATRICULA} ya existe en fila {idx+1}. No se añade duplicado.")
            sys.exit(0)

    fila = [FECHA, COCHE, CLIENTE, MATRICULA, SERVICIOS, "", "", "", "", "", ""]

    # Insertar antes de "Total" o al final
    col_a = worksheet.col_values(1)
    total_row = next((i+1 for i, v in enumerate(col_a) if str(v).strip().lower() == "total"), None)
    if total_row:
        worksheet.insert_row(fila, index=total_row, value_input_option="USER_ENTERED")
        new_total = total_row + 1
        primera = 2
        ultima = new_total - 1
        worksheet.update(f"F{new_total}", [[f"=SUM(F{primera}:F{ultima})"]], value_input_option="USER_ENTERED")
        worksheet.update(f"G{new_total}", [[f"=SUM(G{primera}:G{ultima})"]], value_input_option="USER_ENTERED")
        print(f"  Fila insertada antes de Total (nueva Total en {new_total}).")
    else:
        last = len([v for v in col_a if str(v).strip()])
        worksheet.update(f"A{last+1}", [fila], value_input_option="USER_ENTERED")
        print(f"  Fila añadida al final (fila {last+1}).")

    print(f"DONE: Cupra 6234NNK añadido a Junio.")

if __name__ == "__main__":
    main()
