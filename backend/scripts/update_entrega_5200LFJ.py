"""
Script puntual: actualiza la fila de 5200LFJ en Mayo con fecha entrega, "Entregado" y color verde.
"""
import os
import sys

SPREADSHEET_ID = "1snVAvnfJ39abubFXGFZ2be566G0QEiEsBjSTS9tcf6M"
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "..", "google_credentials.json")
MATRICULA = "5200LFJ"
FECHA_ENTREGA = "01/06/2026"
METODO_PAGO = ""  # sin dato de pago registrado en el sistema

def main():
    import gspread
    from google.oauth2.service_account import Credentials

    creds_path = os.path.abspath(CREDENTIALS_FILE)
    if not os.path.exists(creds_path):
        print(f"ERROR: credenciales no encontradas en {creds_path}")
        sys.exit(1)

    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(SPREADSHEET_ID)

    try:
        worksheet = spreadsheet.worksheet("Mayo")
        print("Pestaña Mayo encontrada.")
    except gspread.WorksheetNotFound:
        print("ERROR: pestaña Mayo no encontrada.")
        sys.exit(1)

    col_d = worksheet.col_values(4)
    fila_num = None
    for idx, val in enumerate(col_d):
        if str(val).strip().upper() == MATRICULA.strip().upper():
            fila_num = idx + 1
            break

    if not fila_num:
        print(f"ERROR: matrícula {MATRICULA} no encontrada en columna D de Mayo.")
        sys.exit(1)

    print(f"Matrícula {MATRICULA} encontrada en fila {fila_num}.")

    if METODO_PAGO:
        worksheet.update(f"H{fila_num}", [[METODO_PAGO]])
        print(f"  H{fila_num} = {METODO_PAGO}")

    worksheet.update(f"I{fila_num}", [[FECHA_ENTREGA]])
    print(f"  I{fila_num} = {FECHA_ENTREGA}")

    worksheet.update(f"K{fila_num}", [["Entregado"]])
    print(f"  K{fila_num} = Entregado")

    num_cols = max(len(worksheet.row_values(1)), 11)
    spreadsheet.batch_update({"requests": [{
        "repeatCell": {
            "range": {
                "sheetId": worksheet.id,
                "startRowIndex": fila_num - 1,
                "endRowIndex": fila_num,
                "startColumnIndex": 0,
                "endColumnIndex": num_cols,
            },
            "cell": {"userEnteredFormat": {"textFormat": {"foregroundColor": {
                "red": 0.133, "green": 0.545, "blue": 0.133
            }}}},
            "fields": "userEnteredFormat.textFormat.foregroundColor",
        }
    }]})
    print(f"  Color verde aplicado a la fila {fila_num} (columnas 1-{num_cols}).")
    print("DONE: entrega 5200LFJ actualizada correctamente en Google Sheets.")

if __name__ == "__main__":
    main()
