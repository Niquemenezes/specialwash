"""
Prompts centralizados para generación de actas con OpenAI.
Mantén aquí todos los prompts y sus variaciones.
"""

# ============ PROMPTS DE SISTEMA ==========
SYSTEM_PROMPT_REDACTOR = (
    "Redactor profesional de taller automotriz. "
    "Genera actas claras, cortas, concisas y formales en español. "
    "Sin inventar datos, solo información verificable. "
    "Estilo obligatorio: técnico, sobrio y objetivo. "
    "Prohibido usar lenguaje comercial, promocional o grandilocuente. "
    "No uses adjetivos superlativos ni promesas. "
    "Si falta información, indícalo de forma breve."
)

# ============ REGLAS DE TONO PREMIUM ==========
PREMIUM_TONE_RULES = (
    "Tono profesional, formal y preciso. "
    "Redacción técnica y objetiva; documenta hechos verificables. "
    "Frases cortas y directas. "
    "Sin florituras, sin exageraciones, sin marketing. "
    "Evita palabras como: excelente, excepcional, premium, superior, impecable, inversión."
)

# ============ PROMPTS PARA SECCIONES del ACTA ==========
PROMPT_SECCION_GENERICA = (
    "Redacta solo este punto de forma concisa y profesional. "
    f"{PREMIUM_TONE_RULES} "
    "Extensión máxima: 2-4 frases o 70 palabras. "
    "No repitas todo el informe, solo el contenido del punto."
)

PROMPT_OBSERVACIONES_FINALES = (
    "Redacta solo las observaciones finales de forma concisa. "
    f"{PREMIUM_TONE_RULES} "
    "Extensión máxima: 2 frases o 45 palabras. "
    "Cierre profesional sin repetir el informe técnico."
)

# ============ TEMPLATES para USUARIOS PERSONALIZADOS ==========
def _clip_text(value, max_chars):
    text = str(value or "").strip()
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars].rstrip()}..."


def build_user_prompt_acta(
    cliente_nombre,
    coche_descripcion,
    matricula,
    kilometros,
    averias,
    borrador,
    servicios_contratados=None,
    partes_realizados=None,
):
    """Construye el prompt de usuario para generar acta completa."""
    averias_txt = _clip_text(averias or "Sin observaciones", 700)
    borrador_txt = _clip_text(borrador or "No aportado", 1200)

    servicios_txt = ""
    if servicios_contratados:
        servicios_txt = "\nServicios contratados: " + ", ".join(servicios_contratados[:10])

    partes_txt = ""
    if partes_realizados:
        items = "\n  - ".join(partes_realizados[:6])
        partes_txt = f"\nNotas de los técnicos:\n  - {items}"

    return (
        f"Cliente: {cliente_nombre}\n"
        f"Vehículo: {coche_descripcion}\n"
        f"Matrícula: {matricula}\n"
        f"Kilómetros: {kilometros or '-'}\n"
        f"Observaciones de recepción: {averias_txt}"
        f"{servicios_txt}"
        f"{partes_txt}\n"
        f"Borrador / trabajos del técnico: {borrador_txt}\n\n"
        "Instrucciones de salida:\n"
        "- Devuelve el texto del acta estructurado en estas secciones exactas (con este formato):\n"
        "  Servicio solicitado / objetivo:\n  Estado inicial / diagnóstico:\n"
        "  Trabajos realizados:\n  Productos y materiales utilizados:\n"
        "  Resultado y comprobaciones finales:\n  Recomendaciones para el cliente:\n"
        "- Máximo 220 palabras en total.\n"
        "- Solo hechos técnicos y resultados observables.\n"
        "- No uses tono comercial ni frases de venta.\n"
        "- No inventes datos. Si falta info, deja el campo breve o en blanco.\n"
        "Devuelve solo el texto estructurado, listo para imprimir."
    )


def build_user_prompt_seccion(numero_seccion, titulo_seccion, contenido_actual, contexto_informe):
    """Construye el prompt de usuario para redactar una sección específica."""
    contenido_txt = _clip_text(contenido_actual or "(vacío)", 500)
    contexto_txt = _clip_text(contexto_informe, 1200)
    return (
        f"Redacta solo el punto {numero_seccion}: {titulo_seccion}.\n"
        f"{PROMPT_SECCION_GENERICA}\n"
        f"Texto base del punto: {contenido_txt}\n\n"
        "Instrucciones de salida: máximo 70 palabras, sin frases promocionales.\n"
        "Contexto del informe completo:\n"
        f"{contexto_txt}"
    )


def build_user_prompt_observaciones(observaciones_actuales, contexto_informe):
    """Construye el prompt de usuario para redactar observaciones finales."""
    observaciones_txt = _clip_text(observaciones_actuales or "(vacío)", 400)
    contexto_txt = _clip_text(contexto_informe, 1200)
    return (
        f"{PROMPT_OBSERVACIONES_FINALES}\n"
        f"Texto base actual: {observaciones_txt}\n\n"
        "Instrucciones de salida: máximo 45 palabras, cierre sobrio y técnico.\n"
        "Contexto del informe técnico:\n"
        f"{contexto_txt}"
    )


# ============ CONFIGURACIÓN DE MODELOS ==========
DEFAULT_MODEL = "gpt-5-mini"  # Modelo de bajo coste por defecto
DEFAULT_TEMPERATURE = 0.2

# ============ PATRONES para LIMPIEZA de RESPUESTAS ==========
CLEANUP_PATTERNS = {
    "observaciones": r"^\s*observaciones\s*(de\s*entrega)?\s*[:.-]?\s*",
    "titulo_acta": r"^\s*(?:informe\s*tecnico|acta\s*tecnica|informe\s*de\s*intervencion)\s*[:.-]?\s*",
}
