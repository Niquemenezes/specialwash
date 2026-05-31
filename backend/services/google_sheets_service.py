"""
Servicio de integración con Google Sheets.
Sincroniza inspecciones (crear, actualizar, eliminar) con el spreadsheet.
"""
import json
import logging
import os
from datetime import datetime

SPREADSHEET_ID = "1snVAvnfJ39abubFXGFZ2be566G0QEiEsBjSTS9tcf6M"
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "..", "google_credentials.json")

MESES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]


def _get_worksheet():
    import gspread
    from google.oauth2.service_account import Credentials

    creds_path = os.path.abspath(CREDENTIALS_FILE)
    if not os.path.exists(creds_path):
        raise FileNotFoundError(f"Credenciales Google Sheets no encontradas: {creds_path}")

    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(SPREADSHEET_ID)

    mes_actual = MESES_ES[datetime.now().month - 1]
    try:
        return spreadsheet.worksheet(mes_actual)
    except gspread.WorksheetNotFound:
        return spreadsheet.sheet1


def _extraer_servicios(servicios_aplicados_raw):
    servicios = []
    if not servicios_aplicados_raw:
        return ""
    try:
        raw = json.loads(servicios_aplicados_raw) if isinstance(servicios_aplicados_raw, str) else servicios_aplicados_raw
        for item in (raw if isinstance(raw, list) else []):
            nombre = (item.get("nombre") or item.get("descripcion") or "").strip()
            if nombre:
                servicios.append(nombre)
    except Exception:
        pass
    return " + ".join(servicios)


def _actualizar_formulas_total(worksheet, total_row):
    """Actualiza las fórmulas SUM de la fila Total para incluir todas las filas de datos."""
    primera_datos = 2  # la fila 1 es cabecera
    ultima_datos = total_row - 1
    # Columna F = Precio, G = IVA
    worksheet.update(f"F{total_row}", [[f"=SUM(F{primera_datos}:F{ultima_datos})"]], value_input_option="USER_ENTERED")
    worksheet.update(f"G{total_row}", [[f"=SUM(G{primera_datos}:G{ultima_datos})"]], value_input_option="USER_ENTERED")
    logging.info(f"[Google Sheets] Fórmulas Total actualizadas en fila {total_row} (datos F{primera_datos}:F{ultima_datos})")


def _buscar_fila_por_matricula(worksheet, matricula):
    """Devuelve el índice de fila (1-based) que contiene la matrícula en columna D, o None."""
    col_d = worksheet.col_values(4)  # columna D
    for idx, val in enumerate(col_d):
        if str(val).strip().upper() == matricula.strip().upper():
            return idx + 1  # 1-indexed
    return None


def registrar_inspeccion(inspeccion, servicios_aplicados_raw=None):
    """Añade una fila al Google Sheet cuando se crea una inspección."""
    try:
        worksheet = _get_worksheet()

        fecha = inspeccion.fecha_inspeccion or datetime.now()
        fecha_str = fecha.strftime("%d/%m/%Y") if hasattr(fecha, "strftime") else str(fecha)[:10]
        servicios_str = _extraer_servicios(servicios_aplicados_raw or inspeccion.servicios_aplicados)

        fila = [
            fecha_str,
            inspeccion.coche_descripcion or "",
            inspeccion.cliente_nombre or "",
            inspeccion.matricula or "",
            servicios_str,
            "",  # Precio
            "",  # IVA
            "",  # Método de Pago
            "",  # Entrega
            inspeccion.averias_notas or "",
            "",  # Estado
        ]

        # Insertar justo antes de la fila "Total"; si no existe, al final
        col_a = worksheet.col_values(1)
        total_row = next((idx + 1 for idx, v in enumerate(col_a) if str(v).strip().lower() == "total"), None)

        if total_row:
            worksheet.insert_row(fila, index=total_row, value_input_option="USER_ENTERED")
            # Tras insertar, Total se desplaza una fila hacia abajo
            new_total_row = total_row + 1
            _actualizar_formulas_total(worksheet, new_total_row)
            logging.info(f"[Google Sheets] Fila insertada antes de Total ({new_total_row}): {inspeccion.matricula}")
        else:
            last = len(col_a)
            while last > 0 and not str(col_a[last - 1]).strip():
                last -= 1
            new_data_row = last + 1
            worksheet.update(f"A{new_data_row}", [fila])
            logging.info(f"[Google Sheets] Fila añadida al final: {inspeccion.matricula}")

    except Exception as e:
        logging.warning(f"[Google Sheets] Error al registrar {getattr(inspeccion, 'matricula', '?')}: {e}")


def actualizar_inspeccion(inspeccion):
    """Actualiza la fila del sheet cuando cambian los servicios u otros datos de la inspección."""
    try:
        worksheet = _get_worksheet()
        fila_num = _buscar_fila_por_matricula(worksheet, inspeccion.matricula or "")
        if not fila_num:
            logging.warning(f"[Google Sheets] Matrícula no encontrada para actualizar: {inspeccion.matricula}")
            return

        servicios_str = _extraer_servicios(inspeccion.servicios_aplicados)

        fecha = inspeccion.fecha_inspeccion or datetime.now()
        fecha_str = fecha.strftime("%d/%m/%Y") if hasattr(fecha, "strftime") else str(fecha)[:10]

        # Actualizar columnas A, B, C, E, J (fecha, modelo, cliente, servicios, observaciones)
        # Dejamos F, G, H, I, K intactas (precio, IVA, pago, entrega, estado — manuales)
        worksheet.update(f"A{fila_num}", [[fecha_str]])
        worksheet.update(f"B{fila_num}", [[inspeccion.coche_descripcion or ""]])
        worksheet.update(f"C{fila_num}", [[inspeccion.cliente_nombre or ""]])
        worksheet.update(f"E{fila_num}", [[servicios_str]])
        worksheet.update(f"J{fila_num}", [[inspeccion.averias_notas or ""]])
        logging.info(f"[Google Sheets] Fila {fila_num} actualizada: {inspeccion.matricula}")

    except Exception as e:
        logging.warning(f"[Google Sheets] Error al actualizar {getattr(inspeccion, 'matricula', '?')}: {e}")


def registrar_entrega_sheets(inspeccion):
    """
    Actualiza la fila del Sheet cuando se entrega el coche:
    - Columna H: método de pago (Efectivo, Bizum, Tarjeta, Transferencia)
    - Columna I: fecha de entrega
    - Columna K: Estado → "Entregado"
    """
    try:
        worksheet = _get_worksheet()
        fila_num = _buscar_fila_por_matricula(worksheet, inspeccion.matricula or "")
        if not fila_num:
            logging.warning(f"[Google Sheets] Matrícula no encontrada para registrar entrega: {inspeccion.matricula}")
            return

        METODO_LABEL = {
            "efectivo": "Efectivo",
            "bizum": "Bizum",
            "tarjeta": "Tarjeta",
            "transferencia": "Transferencia",
        }
        metodo = METODO_LABEL.get(str(inspeccion.cobro_metodo or "").strip().lower(), inspeccion.cobro_metodo or "")

        fecha_entrega = inspeccion.fecha_entrega or datetime.now()
        fecha_str = fecha_entrega.strftime("%d/%m/%Y") if hasattr(fecha_entrega, "strftime") else str(fecha_entrega)[:10]

        worksheet.update(f"H{fila_num}", [[metodo]])
        worksheet.update(f"I{fila_num}", [[fecha_str]])
        worksheet.update(f"K{fila_num}", [["Entregado"]])
        logging.info(f"[Google Sheets] Entrega registrada fila {fila_num}: {inspeccion.matricula} · {metodo} · {fecha_str}")

    except Exception as e:
        logging.warning(f"[Google Sheets] Error al registrar entrega {getattr(inspeccion, 'matricula', '?')}: {e}")


def eliminar_inspeccion(matricula):
    """Elimina la fila del sheet cuando se borra una inspección del sistema."""
    try:
        worksheet = _get_worksheet()
        fila_num = _buscar_fila_por_matricula(worksheet, matricula or "")
        if not fila_num:
            logging.warning(f"[Google Sheets] Matrícula no encontrada para eliminar: {matricula}")
            return

        worksheet.delete_rows(fila_num)
        logging.info(f"[Google Sheets] Fila {fila_num} eliminada: {matricula}")

    except Exception as e:
        logging.warning(f"[Google Sheets] Error al eliminar {matricula}: {e}")
