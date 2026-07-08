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
ASISTENCIA_SPREADSHEET_ID = "1kW05BB98bVHcqlSsqY536xA7enSIKLyVxKU_qqub0Io"
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "..", "google_credentials.json")

# Mapeo de tipo de ausencia -> código de celda en la hoja de asistencia.
# Sólo existen 3 categorías en la hoja (Presente/Ausente/Vacaciones), así que
# los tipos que no son "vacaciones" se cuentan como Ausente.
CODIGO_AUSENCIA = {
    "vacaciones": "V",
    "falta": "A",
    "permiso": "A",
    "baja_temporal": "A",
    "baja_permanente": "A",
}

MESES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]


def _get_worksheet(month=None, year=None):
    import gspread
    from google.oauth2.service_account import Credentials

    creds_path = os.path.abspath(CREDENTIALS_FILE)
    if not os.path.exists(creds_path):
        raise FileNotFoundError(f"Credenciales Google Sheets no encontradas: {creds_path}")

    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    client = gspread.authorize(creds)
    spreadsheet = client.open_by_key(SPREADSHEET_ID)

    # Determinar nombre de la hoja objetivo: acepta `month` como int (1-12) o str (nombre)
    if isinstance(month, int):
        mes_nombre = MESES_ES[(month - 1) % 12]
    elif isinstance(month, str) and month:
        mes_nombre = month
    else:
        mes_nombre = MESES_ES[datetime.now().month - 1]

    # Intentar obtener la hoja del mes; si no existe, crearla con cabecera y fila "Total"
    try:
        return spreadsheet.worksheet(mes_nombre)
    except gspread.WorksheetNotFound:
        # Crear nueva worksheet con suficiente espacio y estructura conocida
        try:
            # Crear hoja de 1000 filas x 12 columnas para dejar margen
            ws = spreadsheet.add_worksheet(title=mes_nombre, rows=1000, cols=12)

            # Cabecera (fila 1) — coincidente con registros que insertamos desde el backend
            header = [
                "Fecha",            # A
                "Modelo",           # B
                "Cliente",          # C
                "Matrícula",        # D
                "Servicios",        # E
                "Precio",           # F
                "IVA",              # G
                "Método de Pago",   # H
                "Entrega",          # I
                "Observaciones",    # J
                "Estado",           # K
            ]
            # Asegurar que la cabecera ocupe la primera fila
            ws.update("A1:K1", [header], value_input_option="USER_ENTERED")

            # Añadir etiqueta "Total" en la fila 1000 (columna A) y fórmulas SUM en F y G
            total_row = 1000
            ws.update(f"A{total_row}", [["Total"]], value_input_option="USER_ENTERED")
            # Fórmulas para sumar columnas Precio (F) e IVA (G)
            ws.update(f"F{total_row}", [[f"=SUM(F2:F{total_row-1})"]], value_input_option="USER_ENTERED")
            ws.update(f"G{total_row}", [[f"=SUM(G2:G{total_row-1})"]], value_input_option="USER_ENTERED")

            return ws
        except Exception:
            # Si la creación falla por permisos u otro motivo, devolver la primera hoja disponible
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
        # Escribir en la hoja del mes actual (comportamiento por defecto)
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
            # Buscar la última fila con datos antes de Total para no insertar en filas vacías
            insert_at = total_row
            for idx in range(total_row - 2, 0, -1):
                if idx < len(col_a) and str(col_a[idx]).strip():
                    insert_at = idx + 2  # fila siguiente al último dato
                    break

            worksheet.insert_row(fila, index=insert_at, value_input_option="USER_ENTERED")
            # Tras insertar, Total se desplaza una fila hacia abajo
            new_total_row = total_row + 1
            _actualizar_formulas_total(worksheet, new_total_row)
            logging.info(f"[Google Sheets] Fila insertada en {insert_at} (Total en {new_total_row}): {inspeccion.matricula}")
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
        import gspread
        from google.oauth2.service_account import Credentials

        creds_path = os.path.abspath(CREDENTIALS_FILE)
        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(SPREADSHEET_ID)

        matricula = inspeccion.matricula or ""

        # Buscar primero en el mes actual, luego en todas las pestañas
        mes_actual = MESES_ES[datetime.now().month - 1]
        try:
            worksheet = spreadsheet.worksheet(mes_actual)
        except gspread.WorksheetNotFound:
            worksheet = spreadsheet.sheet1

        fila_num = _buscar_fila_por_matricula(worksheet, matricula)

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
            logging.warning(f"[Google Sheets] Matrícula no encontrada para actualizar: {matricula}")
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
        logging.info(f"[Google Sheets] Fila {fila_num} actualizada ({worksheet.title}): {matricula}")

    except Exception as e:
        logging.warning(f"[Google Sheets] Error al actualizar {getattr(inspeccion, 'matricula', '?')}: {e}")


def registrar_entrega_sheets(inspeccion):
    """
    Al entregar el coche actualiza la fila del sheet:
    - Columna H: método de pago
    - Columna I: fecha de entrega
    - Columna K: "Entregado"
    - Texto de toda la fila → verde (particulares) o azul (concesionarios)
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

        # Concesionarios → azul; particulares → verde
        es_concesionario = bool(getattr(inspeccion, "es_concesionario", False))
        if es_concesionario:
            color = {"red": 0.114, "green": 0.459, "blue": 0.824}  # azul
            color_label = "azul"
        else:
            color = {"red": 0.133, "green": 0.545, "blue": 0.133}  # verde
            color_label = "verde"

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
                "cell": {"userEnteredFormat": {"textFormat": {"foregroundColor": color}}},
                "fields": "userEnteredFormat.textFormat.foregroundColor",
            }
        }]})

        logging.info(f"[Google Sheets] Entrega registrada fila {fila_num} ({color_label}): {matricula} · {metodo} · {fecha_str}")

    except Exception as e:
        logging.warning(f"[Google Sheets] Error al registrar entrega {getattr(inspeccion, 'matricula', '?')}: {e}")


def actualizar_tabla_inspeccion(inspeccion, campos):
    """Actualiza columnas manuales (F precio, G IVA, H método, I entrega, K estado) en el sheet."""
    if not campos:
        return
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        creds_path = os.path.abspath(CREDENTIALS_FILE)
        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(SPREADSHEET_ID)

        matricula = inspeccion.matricula or ""
        mes_actual = MESES_ES[datetime.now().month - 1]
        try:
            worksheet = spreadsheet.worksheet(mes_actual)
        except gspread.WorksheetNotFound:
            worksheet = spreadsheet.sheet1

        fila_num = _buscar_fila_por_matricula(worksheet, matricula)
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
            logging.warning(f"[Google Sheets] Matrícula no encontrada para tabla: {matricula}")
            return

        precio = float(inspeccion.cobro_importe_pagado or 0)
        metodo_raw = (inspeccion.cobro_metodo or "").lower()
        METODO_LABEL = {"efectivo": "Efectivo", "bizum": "Bizum", "tarjeta": "Tarjeta",
                        "transferencia": "Transferencia", "factura": "Factura"}
        metodo = METODO_LABEL.get(metodo_raw, metodo_raw.capitalize() if metodo_raw else "")
        iva = round(precio * 0.21, 2) if metodo_raw == "factura" and precio > 0 else 0

        if "precio" in campos:
            worksheet.update(f"F{fila_num}", [[precio if precio > 0 else ""]], value_input_option="USER_ENTERED")
            worksheet.update(f"G{fila_num}", [[iva if iva > 0 else ""]], value_input_option="USER_ENTERED")
        elif "metodo" in campos:
            # Recalcular IVA si cambió el método
            worksheet.update(f"G{fila_num}", [[iva if iva > 0 else ""]], value_input_option="USER_ENTERED")

        if "metodo" in campos:
            worksheet.update(f"H{fila_num}", [[metodo]], value_input_option="USER_ENTERED")

        if "fecha_entrega" in campos:
            fecha_str = ""
            if inspeccion.fecha_entrega:
                try:
                    fecha_str = inspeccion.fecha_entrega.strftime("%d/%m/%Y")
                except Exception:
                    fecha_str = str(inspeccion.fecha_entrega)[:10]
            worksheet.update(f"I{fila_num}", [[fecha_str]], value_input_option="USER_ENTERED")

        if "estado" in campos:
            estado = inspeccion.tabla_estado or ("Entregado" if inspeccion.entregado else "")
            worksheet.update(f"K{fila_num}", [[estado]], value_input_option="USER_ENTERED")

        logging.info(f"[Google Sheets] Tabla actualizada fila {fila_num} campos={campos}: {matricula}")

    except Exception as e:
        logging.warning(f"[Google Sheets] Error al actualizar tabla {getattr(inspeccion, 'matricula', '?')}: {e}")


def revertir_entrega_sheets(inspeccion):
    """Limpia columnas I (entrega), K (estado) y resetea el color del texto a negro."""
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        creds_path = os.path.abspath(CREDENTIALS_FILE)
        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(SPREADSHEET_ID)

        matricula = inspeccion.matricula or ""
        mes_actual = MESES_ES[datetime.now().month - 1]
        try:
            worksheet = spreadsheet.worksheet(mes_actual)
        except gspread.WorksheetNotFound:
            worksheet = spreadsheet.sheet1

        fila_num = _buscar_fila_por_matricula(worksheet, matricula)
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
            logging.warning(f"[Google Sheets] Matrícula no encontrada para revertir entrega: {matricula}")
            return

        worksheet.update(f"I{fila_num}", [[""]])
        worksheet.update(f"K{fila_num}", [[""]])

        # Resetear color del texto a negro
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
                "cell": {"userEnteredFormat": {"textFormat": {"foregroundColor": {"red": 0, "green": 0, "blue": 0}}}},
                "fields": "userEnteredFormat.textFormat.foregroundColor",
            }
        }]})

        logging.info(f"[Google Sheets] Entrega revertida fila {fila_num}: {matricula}")
    except Exception as e:
        logging.warning(f"[Google Sheets] Error al revertir entrega {getattr(inspeccion, 'matricula', '?')}: {e}")


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


def mover_coches_entre_meses(src_month, dst_month, dry_run=False):
    """Mueve todas las filas de datos (entre cabecera y 'Total') de la hoja `src_month`
    a la hoja `dst_month`. Si `dry_run=True` sólo devuelve conteos sin modificar.
    """
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        creds_path = os.path.abspath(CREDENTIALS_FILE)
        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(SPREADSHEET_ID)

        # Obtener worksheets
        try:
            src_ws = spreadsheet.worksheet(src_month)
        except gspread.WorksheetNotFound:
            logging.warning(f"[Google Sheets] Hoja origen no encontrada: {src_month}")
            return {"moved": 0, "skipped": 0, "errors": 1}

        try:
            dst_ws = spreadsheet.worksheet(dst_month)
        except gspread.WorksheetNotFound:
            # Crear destino si no existe (misma estructura que _get_worksheet)
            dst_ws = spreadsheet.add_worksheet(title=dst_month, rows=1000, cols=12)
            header = [
                "Fecha", "Modelo", "Cliente", "Matrícula", "Servicios",
                "Precio", "IVA", "Método de Pago", "Entrega", "Observaciones", "Estado",
            ]
            dst_ws.update("A1:K1", [header], value_input_option="USER_ENTERED")
            total_row = 1000
            dst_ws.update(f"A{total_row}", [["Total"]], value_input_option="USER_ENTERED")
            dst_ws.update(f"F{total_row}", [[f"=SUM(F2:F{total_row-1})"]], value_input_option="USER_ENTERED")
            dst_ws.update(f"G{total_row}", [[f"=SUM(G2:G{total_row-1})"]], value_input_option="USER_ENTERED")

        # Localizar filas de datos en origen
        col_a = src_ws.col_values(1)
        total_row = next((idx + 1 for idx, v in enumerate(col_a) if str(v).strip().lower() == "total"), None)
        data_rows = []  # list of (row_index, row_values)

        if total_row:
            start_r = 2
            end_r = total_row - 1
        else:
            all_vals = src_ws.get_all_values()
            start_r = 2
            end_r = len(all_vals)

        for r in range(start_r, end_r + 1):
            row = src_ws.row_values(r)
            if any(str(c).strip() for c in row):
                # Normalize row to length 11 (A..K)
                row_extended = row + [""] * (11 - len(row)) if len(row) < 11 else row[:11]
                data_rows.append((r, row_extended))

        if not data_rows:
            logging.info(f"[Google Sheets] No hay filas para mover de {src_month} a {dst_month}")
            return {"moved": 0, "skipped": 0, "errors": 0}

        moved = 0
        errors = 0

        # Preparar posición de inserción en destino (antes de Total si existe)
        dst_col_a = dst_ws.col_values(1)
        dst_total_row = next((idx + 1 for idx, v in enumerate(dst_col_a) if str(v).strip().lower() == "total"), None)
        if dst_total_row:
            # calculamos insert_at como la fila donde colocar la primera entrada
            insert_at = dst_total_row
            # encontrar último dato antes del Total en dst para insertar tras él
            for idx in range(dst_total_row - 2, 0, -1):
                if idx < len(dst_col_a) and str(dst_col_a[idx]).strip():
                    insert_at = idx + 2
                    break
        else:
            # append at end
            last = len([v for v in dst_col_a if str(v).strip()])
            insert_at = last + 1

        if dry_run:
            return {"moved": len(data_rows), "skipped": 0, "errors": 0}

        # Insert rows in dst preserving order, updating insert_at each time
        for _orig_row_idx, row_vals in data_rows:
            try:
                dst_ws.insert_row(row_vals, index=insert_at, value_input_option="USER_ENTERED")
                insert_at += 1
                moved += 1
            except Exception:
                errors += 1

        # Borrar filas en origen de abajo hacia arriba para no romper índices
        try:
            for r_idx, _ in sorted(data_rows, key=lambda x: x[0], reverse=True):
                try:
                    src_ws.delete_rows(r_idx)
                except Exception:
                    # Ignorar fallos puntuales de borrado
                    pass
        except Exception:
            logging.warning("[Google Sheets] Error al borrar filas en origen después de mover")

        # Actualizar fórmulas Total en ambas hojas si existe
        try:
            if dst_total_row:
                _actualizar_formulas_total(dst_ws, dst_total_row + moved)
        except Exception:
            pass
        try:
            if total_row:
                _actualizar_formulas_total(src_ws, total_row - moved if total_row - moved > 1 else total_row)
        except Exception:
            pass

        logging.info(f"[Google Sheets] Movidas {moved} filas de {src_month} a {dst_month} (errors={errors})")
        return {"moved": moved, "skipped": 0, "errors": errors}

    except Exception as e:
        logging.warning(f"[Google Sheets] Error mover_coches_entre_meses: {e}")
        return {"moved": 0, "skipped": 0, "errors": 1}


def mover_filas_indices(src_month, dst_month, row_indices, dry_run=False):
    """Mueve filas específicas (lista de índices 1-based) de `src_month` a `dst_month`.
    `row_indices` debe ser una lista de enteros; se borran en origen tras insertar en destino.
    """
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        creds_path = os.path.abspath(CREDENTIALS_FILE)
        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(SPREADSHEET_ID)

        try:
            src_ws = spreadsheet.worksheet(src_month)
        except gspread.WorksheetNotFound:
            logging.warning(f"[Google Sheets] Hoja origen no encontrada: {src_month}")
            return {"moved": 0, "errors": 1}

        try:
            dst_ws = spreadsheet.worksheet(dst_month)
        except gspread.WorksheetNotFound:
            dst_ws = spreadsheet.add_worksheet(title=dst_month, rows=1000, cols=12)
            header = [
                "Fecha", "Modelo", "Cliente", "Matrícula", "Servicios",
                "Precio", "IVA", "Método de Pago", "Entrega", "Observaciones", "Estado",
            ]
            dst_ws.update("A1:K1", [header], value_input_option="USER_ENTERED")
            total_row = 1000
            dst_ws.update(f"A{total_row}", [["Total"]], value_input_option="USER_ENTERED")
            dst_ws.update(f"F{total_row}", [[f"=SUM(F2:F{total_row-1})"]], value_input_option="USER_ENTERED")
            dst_ws.update(f"G{total_row}", [[f"=SUM(G2:G{total_row-1})"]], value_input_option="USER_ENTERED")

        # Calcular posición inicial de inserción en destino
        dst_col_a = dst_ws.col_values(1)
        dst_total_row = next((idx + 1 for idx, v in enumerate(dst_col_a) if str(v).strip().lower() == "total"), None)
        if dst_total_row:
            insert_at = dst_total_row
            for idx in range(dst_total_row - 2, 0, -1):
                if idx < len(dst_col_a) and str(dst_col_a[idx]).strip():
                    insert_at = idx + 2
                    break
        else:
            last = len([v for v in dst_col_a if str(v).strip()])
            insert_at = last + 1

        moved = 0
        errors = 0

        # Procesar filas en orden ascendente para mantener orden; almacenamos valores
        filas_valores = []
        for r in sorted(set(row_indices)):
            try:
                vals = src_ws.row_values(r)
                row_extended = vals + [""] * (11 - len(vals)) if len(vals) < 11 else vals[:11]
                filas_valores.append((r, row_extended))
            except Exception:
                errors += 1

        if dry_run:
            return {"moved": len(filas_valores), "errors": errors}

        # Insertar en destino manteniendo el orden original
        for _r, row_vals in filas_valores:
            try:
                dst_ws.insert_row(row_vals, index=insert_at, value_input_option="USER_ENTERED")
                insert_at += 1
                moved += 1
            except Exception:
                errors += 1

        # Borrar filas en origen de mayor a menor
        for r, _ in sorted(filas_valores, key=lambda x: x[0], reverse=True):
            try:
                src_ws.delete_rows(r)
            except Exception:
                # ignorar fallos en borrado
                pass

        # Actualizar fórmulas Totales en destino si aplica
        try:
            if dst_total_row:
                _actualizar_formulas_total(dst_ws, dst_total_row + moved)
        except Exception:
            pass

        logging.info(f"[Google Sheets] Movidas {moved} filas específicas de {src_month} a {dst_month} (errors={errors})")
        return {"moved": moved, "errors": errors}

    except Exception as e:
        logging.warning(f"[Google Sheets] Error mover_filas_indices: {e}")
        return {"moved": 0, "errors": 1}


def mover_abiertos_al_siguiente_mes(current_month=None, year=None, dry_run=False):
    """Mueve al mes siguiente las filas de `current_month` que estén abiertas (sin entrega).

    Comportamiento:
    - Busca filas con columna I vacía o columna K distinta de 'Entregado'.
    - Inserta esas filas en la hoja del mes siguiente (creándola si hace falta),
      antes de su fila 'Total'.
    - Borra las filas originales en la hoja de origen.
    - Si `dry_run=True` no modifica nada y devuelve conteos.
    """
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        now = datetime.now()
        if current_month is None:
            current_month = now.month
        else:
            current_month = int(current_month)

        # calcular siguiente mes y nombre
        src_month = int(current_month)
        if src_month == 12:
            dst_month = 1
            dst_year = (year or now.year) + 1
        else:
            dst_month = src_month + 1
            dst_year = year or now.year

        src_name = MESES_ES[(src_month - 1) % 12]
        dst_name = MESES_ES[(dst_month - 1) % 12]

        creds_path = os.path.abspath(CREDENTIALS_FILE)
        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(SPREADSHEET_ID)

        try:
            src_ws = spreadsheet.worksheet(src_name)
        except gspread.WorksheetNotFound:
            logging.info(f"[Google Sheets] Hoja origen no encontrada: {src_name}")
            return {"moved": 0, "skipped": 0, "errors": 0}

        try:
            dst_ws = spreadsheet.worksheet(dst_name)
        except gspread.WorksheetNotFound:
            dst_ws = spreadsheet.add_worksheet(title=dst_name, rows=1000, cols=12)
            header = [
                "Fecha", "Modelo", "Cliente", "Matrícula", "Servicios",
                "Precio", "IVA", "Método de Pago", "Entrega", "Observaciones", "Estado",
            ]
            dst_ws.update("A1:K1", [header], value_input_option="USER_ENTERED")
            total_row = 1000
            dst_ws.update(f"A{total_row}", [["Total"]], value_input_option="USER_ENTERED")
            dst_ws.update(f"F{total_row}", [[f"=SUM(F2:F{total_row-1})"]], value_input_option="USER_ENTERED")
            dst_ws.update(f"G{total_row}", [[f"=SUM(G2:G{total_row-1})"]], value_input_option="USER_ENTERED")

        # identificar rango de datos en origen
        col_a = src_ws.col_values(1)
        src_total_row = next((idx + 1 for idx, v in enumerate(col_a) if str(v).strip().lower() == "total"), None)
        if src_total_row:
            start_r = 2
            end_r = src_total_row - 1
        else:
            all_vals = src_ws.get_all_values()
            start_r = 2
            end_r = len(all_vals)

        filas_para_mover = []
        for r in range(start_r, end_r + 1):
            row = src_ws.row_values(r)
            # columna I index 8, columna K index 10 (0-based)
            entrega = (row[8].strip() if len(row) >= 9 and row[8] else "")
            estado = (row[10].strip() if len(row) >= 11 and row[10] else "")
            if not entrega or estado.lower() != "entregado":
                # considerar como abierta
                row_extended = row + [""] * (11 - len(row)) if len(row) < 11 else row[:11]
                filas_para_mover.append((r, row_extended))

        if not filas_para_mover:
            logging.info(f"[Google Sheets] No hay coches abiertos en {src_name} para mover")
            return {"moved": 0, "skipped": 0, "errors": 0}

        # calcular posición de inserción en destino
        dst_col_a = dst_ws.col_values(1)
        dst_total_row = next((idx + 1 for idx, v in enumerate(dst_col_a) if str(v).strip().lower() == "total"), None)
        if dst_total_row:
            insert_at = dst_total_row
            for idx in range(dst_total_row - 2, 0, -1):
                if idx < len(dst_col_a) and str(dst_col_a[idx]).strip():
                    insert_at = idx + 2
                    break
        else:
            last = len([v for v in dst_col_a if str(v).strip()])
            insert_at = last + 1

        if dry_run:
            return {"moved": len(filas_para_mover), "skipped": 0, "errors": 0}

        moved = 0
        errors = 0
        skipped = 0

        # insertar en destino manteniendo orden original
        for _r, vals in filas_para_mover:
            try:
                # evitar duplicados por matrícula
                matricula = (vals[3] if len(vals) >= 4 else "")
                if matricula and _buscar_fila_por_matricula(dst_ws, matricula):
                    skipped += 1
                    continue
                dst_ws.insert_row(vals, index=insert_at, value_input_option="USER_ENTERED")
                insert_at += 1
                moved += 1
            except Exception:
                errors += 1

        # borrar filas en origen de abajo hacia arriba
        for r, _ in sorted(filas_para_mover, key=lambda x: x[0], reverse=True):
            try:
                src_ws.delete_rows(r)
            except Exception:
                pass

        # actualizar formulas totals
        try:
            if dst_total_row:
                _actualizar_formulas_total(dst_ws, dst_total_row + moved)
        except Exception:
            pass
        try:
            if src_total_row:
                _actualizar_formulas_total(src_ws, src_total_row - moved if src_total_row - moved > 1 else src_total_row)
        except Exception:
            pass

        logging.info(f"[Google Sheets] Movidos {moved} coches abiertos de {src_name} a {dst_name} (skipped={skipped} errors={errors})")
        return {"moved": moved, "skipped": skipped, "errors": errors}

    except Exception as e:
        logging.warning(f"[Google Sheets] Error mover_abiertos_al_siguiente_mes: {e}")
        return {"moved": 0, "skipped": 0, "errors": 1}


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


# ============================================================
# CONTROL DE ASISTENCIA
# ============================================================
# Estructura por pestaña (una por mes):
#   Fila 1: cabecera -> "Día", <empleado 1>, <empleado 2>, ...
#   Filas 2-32: días 1-31
#   Fila 33: vacía
#   Filas 34-36: "Total Presente" / "Total Ausente" / "Total Vacaciones" + COUNTIF por empleado
# Cada celda día/empleado contiene "P", "A" o "V".

ASISTENCIA_DIAS_FILA_INICIO = 2
ASISTENCIA_TOTAL_LABELS = {
    "Total Presente": "P",
    "Total Ausente": "A",
    "Total Vacaciones": "V",
}


def _get_asistencia_client_spreadsheet():
    import gspread
    from google.oauth2.service_account import Credentials

    creds_path = os.path.abspath(CREDENTIALS_FILE)
    if not os.path.exists(creds_path):
        raise FileNotFoundError(f"Credenciales Google Sheets no encontradas: {creds_path}")

    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    client = gspread.authorize(creds)
    return client, client.open_by_key(ASISTENCIA_SPREADSHEET_ID)


def _col_letter(col_idx):
    import gspread
    return gspread.utils.rowcol_to_a1(1, col_idx).rstrip("1")


def _escribir_cabecera_asistencia(worksheet, empleados_nombres):
    # Limpia cualquier contenido previo (evita mezclar con una rejilla manual antigua)
    worksheet.clear()

    header = ["Día"] + list(empleados_nombres)
    fila_fin = ASISTENCIA_DIAS_FILA_INICIO + 30  # última fila de días (31)
    fila_labels = fila_fin + 2  # deja una fila en blanco antes de los totales

    updates = [
        {"range": "A1", "values": [header]},
        {"range": f"A{ASISTENCIA_DIAS_FILA_INICIO}:A{fila_fin}", "values": [[str(d)] for d in range(1, 32)]},
    ]
    for offset, label in enumerate(ASISTENCIA_TOTAL_LABELS):
        updates.append({"range": f"A{fila_labels + offset}", "values": [[label]]})

    for idx, _nombre in enumerate(empleados_nombres):
        col = _col_letter(idx + 2)
        for offset, (label, codigo) in enumerate(ASISTENCIA_TOTAL_LABELS.items()):
            # separador ";" porque la hoja usa configuración regional es_ES
            formula = f'=COUNTIF({col}{ASISTENCIA_DIAS_FILA_INICIO}:{col}{fila_fin};"{codigo}")'
            updates.append({"range": f"{col}{fila_labels + offset}", "values": [[formula]]})

    # Una sola petición batch en vez de ~26 individuales (evita 429 de cuota)
    worksheet.batch_update(updates, value_input_option="USER_ENTERED")


def preparar_hoja_asistencia_mes(mes, empleados_nombres, spreadsheet=None, forzar=False):
    """Crea (o normaliza) la pestaña del mes indicado con cabecera, días 1-31 y fórmulas Total.
    `mes` acepta int (1-12) o nombre en español. No pisa datos si la pestaña ya tiene cabecera,
    salvo que `forzar=True`.
    """
    import gspread

    own_spreadsheet = spreadsheet is None
    if own_spreadsheet:
        _, spreadsheet = _get_asistencia_client_spreadsheet()

    mes_nombre = MESES_ES[(mes - 1) % 12] if isinstance(mes, int) else mes

    try:
        ws = spreadsheet.worksheet(mes_nombre)
        if not forzar:
            cabecera_actual = ws.row_values(1)
            if cabecera_actual and cabecera_actual[0].strip().lower() == "día":
                return ws  # ya inicializada, no tocar datos existentes
    except gspread.WorksheetNotFound:
        hojas = spreadsheet.worksheets()
        if len(hojas) == 1 and hojas[0].title.lower().startswith(("hoja", "sheet")):
            ws = hojas[0]
            ws.update_title(mes_nombre)
        else:
            ws = spreadsheet.add_worksheet(title=mes_nombre, rows=40, cols=max(12, len(empleados_nombres) + 2))

    _escribir_cabecera_asistencia(ws, empleados_nombres)
    logging.info(f"[Sheets Asistencia] Pestaña preparada: {mes_nombre}")
    return ws


def preparar_hojas_asistencia_anio(empleados_nombres, anio=None):
    """Crea/normaliza las 12 pestañas mensuales del año en curso (o el indicado)."""
    try:
        _, spreadsheet = _get_asistencia_client_spreadsheet()
        for mes in range(1, 13):
            preparar_hoja_asistencia_mes(mes, empleados_nombres, spreadsheet=spreadsheet)
        logging.info("[Sheets Asistencia] 12 pestañas preparadas")
    except Exception as e:
        logging.warning(f"[Sheets Asistencia] Error preparando pestañas del año: {e}")


def _buscar_fila_dia_asistencia(worksheet, dia):
    col_a = worksheet.col_values(1)
    objetivo = str(dia)
    for idx, val in enumerate(col_a):
        if str(val).strip() == objetivo:
            return idx + 1
    return None


def _buscar_columna_empleado_asistencia(worksheet, nombre):
    header = worksheet.row_values(1)
    nombre_norm = (nombre or "").strip().lower()
    for idx, val in enumerate(header):
        if idx == 0:
            continue
        if str(val).strip().lower() == nombre_norm:
            return idx + 1
    return None


def _anadir_columna_empleado_asistencia(worksheet, nombre):
    header = worksheet.row_values(1)
    col_idx = len(header) + 1
    col = _col_letter(col_idx)
    worksheet.update(f"{col}1", [[nombre]], value_input_option="USER_ENTERED")

    col_a = worksheet.col_values(1)
    fila_dia1 = _buscar_fila_dia_asistencia(worksheet, 1)
    fila_dia31 = _buscar_fila_dia_asistencia(worksheet, 31)
    if fila_dia1 and fila_dia31:
        for label, codigo in ASISTENCIA_TOTAL_LABELS.items():
            fila_label = next((i + 1 for i, v in enumerate(col_a) if str(v).strip().lower() == label.lower()), None)
            if fila_label:
                formula = f'=COUNTIF({col}{fila_dia1}:{col}{fila_dia31};"{codigo}")'
                worksheet.update(f"{col}{fila_label}", [[formula]], value_input_option="USER_ENTERED")

    return col_idx


def _celda_asistencia(worksheet, empleado_nombre, fecha):
    fila = _buscar_fila_dia_asistencia(worksheet, fecha.day)
    if not fila:
        return None
    col_idx = _buscar_columna_empleado_asistencia(worksheet, empleado_nombre)
    if not col_idx:
        col_idx = _anadir_columna_empleado_asistencia(worksheet, empleado_nombre)
    return fila, col_idx


def marcar_asistencia(empleado_nombre, fecha, codigo):
    """Escribe P/A/V en la celda día/empleado de la pestaña del mes de `fecha`."""
    try:
        _, spreadsheet = _get_asistencia_client_spreadsheet()
        mes_nombre = MESES_ES[fecha.month - 1]
        ws = preparar_hoja_asistencia_mes(mes_nombre, [empleado_nombre], spreadsheet=spreadsheet)

        celda = _celda_asistencia(ws, empleado_nombre, fecha)
        if not celda:
            logging.warning(f"[Sheets Asistencia] Día {fecha.day} no encontrado en {mes_nombre}")
            return
        fila, col_idx = celda
        col = _col_letter(col_idx)
        ws.update(f"{col}{fila}", [[codigo]], value_input_option="USER_ENTERED")
        logging.info(f"[Sheets Asistencia] {empleado_nombre} {fecha.isoformat()} -> {codigo}")
    except Exception as e:
        logging.warning(f"[Sheets Asistencia] Error al marcar {empleado_nombre} {fecha}: {e}")


def limpiar_asistencia(empleado_nombre, fecha, codigo_esperado):
    """Vacía la celda día/empleado sólo si su valor actual coincide con `codigo_esperado`
    (evita borrar un 'P' de fichaje al revertir una ausencia del mismo día)."""
    try:
        _, spreadsheet = _get_asistencia_client_spreadsheet()
        mes_nombre = MESES_ES[fecha.month - 1]
        try:
            ws = spreadsheet.worksheet(mes_nombre)
        except Exception:
            return

        fila = _buscar_fila_dia_asistencia(ws, fecha.day)
        col_idx = _buscar_columna_empleado_asistencia(ws, empleado_nombre)
        if not fila or not col_idx:
            return
        col = _col_letter(col_idx)
        valor_actual = ws.acell(f"{col}{fila}").value
        if str(valor_actual or "").strip().upper() == codigo_esperado:
            ws.update(f"{col}{fila}", [[""]], value_input_option="USER_ENTERED")
            logging.info(f"[Sheets Asistencia] {empleado_nombre} {fecha.isoformat()} limpiado")
    except Exception as e:
        logging.warning(f"[Sheets Asistencia] Error al limpiar {empleado_nombre} {fecha}: {e}")


def _rango_fechas(fecha_inicio, fecha_fin):
    from datetime import timedelta
    dias = []
    actual = fecha_inicio
    while actual <= fecha_fin:
        dias.append(actual)
        actual += timedelta(days=1)
    return dias


def sincronizar_asistencia_mes(mes, anio, datos_por_empleado, empleados_nombres):
    """Sobrescribe en bloque las celdas P/A/V (días 1-31) del mes indicado a partir de datos
    ya calculados desde la BD (fichajes + ausencias aprobadas). No toca cabecera ni fórmulas.
    `datos_por_empleado`: dict {empleado_nombre: {dia_int: "P"|"A"|"V"}}.
    """
    try:
        _, spreadsheet = _get_asistencia_client_spreadsheet()
        ws = preparar_hoja_asistencia_mes(mes, empleados_nombres, spreadsheet=spreadsheet)

        # Asegurar columna para cada empleado activo (por si alguno se añadió después de crear la hoja)
        for nombre in empleados_nombres:
            if not _buscar_columna_empleado_asistencia(ws, nombre):
                _anadir_columna_empleado_asistencia(ws, nombre)
        header = ws.row_values(1)

        fila_fin = ASISTENCIA_DIAS_FILA_INICIO + 30
        matriz = []
        for dia in range(1, 32):
            fila = [datos_por_empleado.get(nombre, {}).get(dia, "") for nombre in header[1:]]
            matriz.append(fila)

        ultima_col = _col_letter(len(header))
        rango = f"B{ASISTENCIA_DIAS_FILA_INICIO}:{ultima_col}{fila_fin}"
        ws.update(rango, matriz, value_input_option="USER_ENTERED")

        mes_nombre = MESES_ES[(mes - 1) % 12] if isinstance(mes, int) else mes
        logging.info(f"[Sheets Asistencia] Mes {mes_nombre} sincronizado desde BD")
        return True
    except Exception as e:
        logging.warning(f"[Sheets Asistencia] Error al sincronizar mes: {e}")
        return False


def marcar_ausencia_sheets(empleado_nombre, tipo, fecha_inicio, fecha_fin):
    """Marca V/A en la hoja de asistencia para cada día del rango de una ausencia aprobada."""
    codigo = CODIGO_AUSENCIA.get(tipo, "A")
    for dia in _rango_fechas(fecha_inicio, fecha_fin):
        marcar_asistencia(empleado_nombre, dia, codigo)


def revertir_ausencia_sheets(empleado_nombre, tipo, fecha_inicio, fecha_fin):
    """Limpia las celdas V/A marcadas por una ausencia que se rechaza/elimina/deja de estar aprobada."""
    codigo = CODIGO_AUSENCIA.get(tipo, "A")
    for dia in _rango_fechas(fecha_inicio, fecha_fin):
        limpiar_asistencia(empleado_nombre, dia, codigo)
