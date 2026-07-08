"""Marca entrega del Cupra 6234NNK en Junio: fecha, Entregado y color azul (concesionario)."""
import os, sys

SPREADSHEET_ID = "1snVAvnfJ39abubFXGFZ2be566G0QEiEsBjSTS9tcf6M"
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "..", "google_credentials.json")
MATRICULA = "6234NNK"
FECHA_ENTREGA = "01/06/2026"

def main():
    import gspread
    from google.oauth2.service_account import Credentials

    creds = Credentials.from_service_account_file(
        os.path.abspath(CREDENTIALS_FILE),
        scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(SPREADSHEET_ID)

    # Buscar en Junio primero, luego en todas las pestañas
    worksheet = None
    fila_num = None
    try:
        ws = spreadsheet.worksheet("Junio")
        fila_num = next((i+1 for i, v in enumerate(ws.col_values(4)) if str(v).strip().upper() == MATRICULA), None)
        if fila_num:
            worksheet = ws
    except Exception:
        pass

    if not fila_num:
        for ws in spreadsheet.worksheets():
            f = next((i+1 for i, v in enumerate(ws.col_values(4)) if str(v).strip().upper() == MATRICULA), None)
            if f:
                fila_num = f
                worksheet = ws
                break

    if not fila_num:
        print(f"ERROR: {MATRICULA} no encontrado.")
        sys.exit(1)

    print(f"Encontrado en pestaña '{worksheet.title}', fila {fila_num}.")

    worksheet.update(f"I{fila_num}", [[FECHA_ENTREGA]])
    worksheet.update(f"K{fila_num}", [["Entregado"]])
    print(f"  I{fila_num} = {FECHA_ENTREGA}, K{fila_num} = Entregado")

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
                "red": 0.114, "green": 0.459, "blue": 0.824
            }}}},
            "fields": "userEnteredFormat.textFormat.foregroundColor",
        }
    }]})
    print(f"  Color azul aplicado (concesionario).")
    print("DONE.")

if __name__ == "__main__":
    main()
