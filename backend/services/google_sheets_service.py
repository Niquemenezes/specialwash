"""
Servicio de integración con Google Sheets.
Sincroniza inspecciones (crear, actualizar, eliminar) con el spreadsheet.
"""
import json
import logging
import os
from datetime import datetime

SPREADSHEET_ID = "1snVAvnfJ39abubFXGFZ2be566G0QEiEsBjSTS9tcf6M"
MAQUINARIA_SPREADSHEET_ID = "13TsK50_ycdntTXPKWfsYVbX0k0EndvOPH-NL0mog6M4"
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
    Al entregar el coche actualiza la fila del sheet:
    - Columna H: método de pago
    - Columna I: fecha de entrega
    - Columna K: "Entregado"
    - Texto de toda la fila → verde
    Busca primero en el mes actual y luego en todas las pestañas.
    """
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        creds_path = os.path.abspath(CREDENTIALS_FILE)
        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(SPREADSHEET_ID)

        mes_actual = MESES_ES[datetime.now().month - 1]
        try:
            worksheet = spreadsheet.worksheet(mes_actual)
        except gspread.WorksheetNotFound:
            worksheet = spreadsheet.sheet1

        matricula = inspeccion.matricula or ""
        fila_num = _buscar_fila_por_matricula(worksheet, matricula)

        # Si no está en el mes actual buscar en todas las pestañas
        if not fila_num:
            for ws in spreadsheet.worksheets():
                if ws.id == worksheet.id:
                    continue
                f = _buscar_fila_por_matricula(ws, matricula)
                if f:
                    fila_num = f
                    worksheet = ws
                    break

        if not fila_num:
            logging.warning(f"[Google Sheets] Matrícula no encontrada para entrega: {matricula}")
            return

        # Fecha de entrega
        fecha_entrega = inspeccion.fecha_entrega or datetime.now()
        fecha_str = fecha_entrega.strftime("%d/%m/%Y") if hasattr(fecha_entrega, "strftime") else str(fecha_entrega)[:10]

        # Método de pago: intentar desde cobro o atributo directo
        cobro = getattr(inspeccion, "cobro", None)
        metodo_raw = (getattr(cobro, "metodo_pago", None) or getattr(inspeccion, "cobro_metodo", None) or "")
        METODO_LABEL = {"efectivo": "Efectivo", "bizum": "Bizum", "tarjeta": "Tarjeta", "transferencia": "Transferencia"}
        metodo = METODO_LABEL.get(str(metodo_raw).strip().lower(), str(metodo_raw).capitalize())

        worksheet.update(f"H{fila_num}", [[metodo]])
        worksheet.update(f"I{fila_num}", [[fecha_str]])
        worksheet.update(f"K{fila_num}", [["Entregado"]])

        # Poner texto de la fila en verde
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

        logging.info(f"[Google Sheets] Entrega registrada fila {fila_num} (verde): {matricula} · {metodo} · {fecha_str}")

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


# ============================================================
# MAQUINARIA
# ============================================================

def _get_maquinaria_worksheet():
    import gspread
    from google.oauth2.service_account import Credentials

    creds_path = os.path.abspath(CREDENTIALS_FILE)
    if not os.path.exists(creds_path):
        raise FileNotFoundError(f"Credenciales Google no encontradas: {creds_path}")

    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(MAQUINARIA_SPREADSHEET_ID)
    try:
        return spreadsheet.worksheet("Maquinaria")
    except Exception:
        return spreadsheet.sheet1


def _buscar_fila_maquinaria(worksheet, nombre):
    """Devuelve índice de fila (1-based) que coincide con el nombre en columna A, o None."""
    col_a = worksheet.col_values(1)
    nombre_norm = str(nombre or "").strip().lower()
    for idx, val in enumerate(col_a):
        if str(val).strip().lower() == nombre_norm:
            return idx + 1
    return None


def _fila_maquinaria(m):
    """Construye la lista de valores para una fila del sheet de maquinaria."""
    fecha_str = ""
    if m.fecha_compra:
        try:
            fecha_str = m.fecha_compra.strftime("%d/%m/%Y")
        except Exception:
            fecha_str = str(m.fecha_compra)

    precio_sin_iva = float(m.precio_sin_iva or 0)
    iva_pct = float(m.iva or 0)
    precio_con_iva = float(m.precio_con_iva or 0)
    cantidad = int(m.cantidad or 1)

    return [
        m.nombre or "",          # A: nombre
        m.numero_serie or "",    # B: número de factura
        fecha_str,               # C: Fecha de compra
        "",                      # D: Proveedor (sin campo en BD)
        cantidad,                # E: Cantidad
        precio_sin_iva,          # F: Precio
        iva_pct,                 # G: IVA (%)
        "",                      # H: Descuento (%)
        precio_sin_iva,          # I: precio sin IVA
        precio_con_iva,          # J: Total
    ]


def registrar_maquinaria(m):
    """Añade una fila al Sheet de maquinaria cuando se crea un equipo."""
    try:
        worksheet = _get_maquinaria_worksheet()
        fila = _fila_maquinaria(m)

        # Insertar al final (antes de cualquier fila "Total" si existe)
        col_a = worksheet.col_values(1)
        total_row = next(
            (idx + 1 for idx, v in enumerate(col_a) if str(v).strip().lower() == "total"),
            None,
        )
        if total_row:
            worksheet.insert_row(fila, index=total_row, value_input_option="USER_ENTERED")
        else:
            last = len([v for v in col_a if str(v).strip()])
            worksheet.update(f"A{last + 1}", [fila], value_input_option="USER_ENTERED")

        logging.info(f"[Sheets Maquinaria] Fila añadida: {m.nombre}")
    except Exception as e:
        logging.warning(f"[Sheets Maquinaria] Error al registrar '{getattr(m, 'nombre', '?')}': {e}")


def actualizar_maquinaria(m):
    """Actualiza la fila del Sheet de maquinaria cuando se edita un equipo."""
    try:
        worksheet = _get_maquinaria_worksheet()
        fila_num = _buscar_fila_maquinaria(worksheet, m.nombre)
        if not fila_num:
            # Si no existe la fila, la creamos
            registrar_maquinaria(m)
            return

        fila = _fila_maquinaria(m)
        col_letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
        for col, val in zip(col_letters, fila):
            worksheet.update(f"{col}{fila_num}", [[val]], value_input_option="USER_ENTERED")

        logging.info(f"[Sheets Maquinaria] Fila {fila_num} actualizada: {m.nombre}")
    except Exception as e:
        logging.warning(f"[Sheets Maquinaria] Error al actualizar '{getattr(m, 'nombre', '?')}': {e}")


def eliminar_maquinaria(nombre):
    """Elimina la fila del Sheet de maquinaria cuando se borra un equipo."""
    try:
        worksheet = _get_maquinaria_worksheet()
        fila_num = _buscar_fila_maquinaria(worksheet, nombre)
        if not fila_num:
            logging.warning(f"[Sheets Maquinaria] No encontrado para eliminar: {nombre}")
            return
        worksheet.delete_rows(fila_num)
        logging.info(f"[Sheets Maquinaria] Fila {fila_num} eliminada: {nombre}")
    except Exception as e:
        logging.warning(f"[Sheets Maquinaria] Error al eliminar '{nombre}': {e}")
