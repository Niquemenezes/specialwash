"""
Script puntual: elimina la fila duplicada de 5200LFJ en la pestaña Mayo.
Mantiene la primera fila encontrada (actualizada con Entregado y color verde).
"""
import os
import sys

SPREADSHEET_ID = "1snVAvnfJ39abubFXGFZ2be566G0QEiEsBjSTS9tcf6M"
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "..", "google_credentials.json")
MATRICULA = "5200LFJ"

def main():
    import gspread
    from google.oauth2.service_account import Credentials

    creds_path = os.path.abspath(CREDENTIALS_FILE)
    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(SPREADSHEET_ID)

    try:
        worksheet = spreadsheet.worksheet("Mayo")
    except gspread.WorksheetNotFound:
        print("ERROR: pestaña Mayo no encontrada.")
        sys.exit(1)

    col_d = worksheet.col_values(4)
    filas = []
    for idx, val in enumerate(col_d):
        if str(val).strip().upper() == MATRICULA.strip().upper():
            filas.append(idx + 1)

    print(f"Filas con matrícula {MATRICULA}: {filas}")

    if len(filas) < 2:
        print("No hay duplicado, nada que hacer.")
        return

    # Mostrar contenido de cada fila
    for f in filas:
        row_vals = worksheet.row_values(f)
        print(f"  Fila {f}: {row_vals}")

    # Eliminar las filas duplicadas (de mayor a menor para no desplazar índices)
    # Mantenemos la primera, eliminamos el resto
    filas_a_eliminar = sorted(filas[1:], reverse=True)
    for f in filas_a_eliminar:
        worksheet.delete_rows(f)
        print(f"  Fila {f} eliminada.")

    print(f"DONE: duplicado(s) eliminado(s). Queda fila {filas[0]}.")

if __name__ == "__main__":
    main()
