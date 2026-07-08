"""Mueve la fila del Cupra 6234NNK a la posición 12 en la pestaña Junio."""
import os, sys

SPREADSHEET_ID = "1snVAvnfJ39abubFXGFZ2be566G0QEiEsBjSTS9tcf6M"
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "..", "google_credentials.json")
MATRICULA = "6234NNK"
TARGET_ROW = 12

def main():
    import gspread
    from google.oauth2.service_account import Credentials

    creds = Credentials.from_service_account_file(
        os.path.abspath(CREDENTIALS_FILE),
        scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(SPREADSHEET_ID)
    worksheet = spreadsheet.worksheet("Junio")

    col_d = worksheet.col_values(4)
    fila_actual = next((i+1 for i, v in enumerate(col_d) if str(v).strip().upper() == MATRICULA.strip().upper()), None)

    if not fila_actual:
        print(f"ERROR: {MATRICULA} no encontrado en Junio.")
        sys.exit(1)

    print(f"Cupra encontrado en fila {fila_actual}.")

    if fila_actual == TARGET_ROW:
        print(f"Ya está en la fila {TARGET_ROW}, nada que hacer.")
        return

    # Leer contenido de la fila actual
    fila_vals = worksheet.row_values(fila_actual)
    print(f"  Contenido: {fila_vals}")

    # Borrar la fila actual
    worksheet.delete_rows(fila_actual)
    print(f"  Fila {fila_actual} eliminada.")

    # Si la fila actual era menor que el target, el target baja 1
    insert_at = TARGET_ROW if fila_actual > TARGET_ROW else TARGET_ROW
    worksheet.insert_row(fila_vals, index=insert_at, value_input_option="USER_ENTERED")
    print(f"  Fila insertada en posición {insert_at}.")
    print(f"DONE: Cupra 6234NNK movido a fila {insert_at}.")

if __name__ == "__main__":
    main()
