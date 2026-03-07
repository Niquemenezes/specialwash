from models import Entrada


def calcular_totales_entrada(cantidad, precio_unitario, porcentaje_iva=21.0, descuento_pct=0.0):
    """Calcula importes de entrada con IVA y descuento."""
    subtotal = round(float(precio_unitario) * int(cantidad), 2)
    importe_descuento = round(subtotal * (float(descuento_pct) / 100.0), 2)
    precio_sin_iva = round(subtotal - importe_descuento, 2)
    valor_iva = round(precio_sin_iva * (float(porcentaje_iva) / 100.0), 2)
    precio_con_iva = round(precio_sin_iva + valor_iva, 2)
    return {
        "precio_sin_iva": precio_sin_iva,
        "porcentaje_iva": float(porcentaje_iva),
        "valor_iva": valor_iva,
        "precio_con_iva": precio_con_iva,
    }


def calcular_precio_salida_desde_ultima_entrada(producto_id):
    """Devuelve precio unitario/total (None si no hay base de calculo)."""
    ultima_entrada = (
        Entrada.query.filter_by(producto_id=producto_id)
        .order_by(Entrada.fecha.desc())
        .first()
    )

    if not ultima_entrada:
        return None

    if not ultima_entrada.precio_con_iva or not ultima_entrada.cantidad or ultima_entrada.cantidad <= 0:
        return None

    precio_unitario = round(
        float(ultima_entrada.precio_con_iva) / float(ultima_entrada.cantidad), 4
    )
    return precio_unitario


def actualizar_stock_entrada(producto, cantidad):
    producto.stock_actual += int(cantidad)


def revertir_stock_entrada(producto, cantidad):
    producto.stock_actual -= int(cantidad)


def actualizar_stock_salida(producto, cantidad):
    producto.stock_actual -= int(cantidad)


def revertir_stock_salida(producto, cantidad):
    producto.stock_actual += int(cantidad)
