"""Aplica color azul a la fila de 5200LFJ (Ausol = concesionario)."""
import os, sys

SPREADSHEET_ID = "1snVAvnfJ39abubFXGFZ2be566G0QEiEsBjSTS9tcf6M"
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "..", "google_credentials.json")

def main():
    import gspread
    from google.oauth2.service_account import Credentials
    creds = Credentials.from_service_account_file(os.path.abspath(CREDENTIALS_FILE),
                                                   scopes=["https://www.googleapis.com/auth/spreadsheets"])
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(SPREADSHEET_ID)
    worksheet = spreadsheet.worksheet("Mayo")

    col_d = worksheet.col_values(4)
    fila_num = next((i+1 for i, v in enumerate(col_d) if str(v).strip().upper() == "5200LFJ"), None)
    if not fila_num:
        print("No encontrada"); sys.exit(1)

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
    print(f"Color azul aplicado a fila {fila_num} (5200LFJ / Ausol concesionario).")

if __name__ == "__main__":
    main()
