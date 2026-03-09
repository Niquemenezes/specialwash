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
def build_user_prompt_acta(cliente_nombre, coche_descripcion, matricula, kilometros, averias, borrador):
    """Construye el prompt de usuario para generar acta completa."""
    return (
        f"Cliente: {cliente_nombre}\n"
        f"Vehículo: {coche_descripcion}\n"
        f"Matrícula: {matricula}\n"
        f"Kilómetros: {kilometros or '-'}\n"
        f"Observaciones recepción: {averias or 'Sin observaciones'}\n"
        f"Borrador de trabajos: {borrador or 'No aportado'}\n\n"
        "Instrucciones de salida:\n"
        "- Máximo 180 palabras en total.\n"
        "- Solo hechos técnicos y resultados observables.\n"
        "- No uses tono comercial ni frases de venta.\n"
        "- No inventes datos.\n"
        "Devuelve solo el texto final del acta, listo para imprimir."
    )


def build_user_prompt_seccion(numero_seccion, titulo_seccion, contenido_actual, contexto_informe):
    """Construye el prompt de usuario para redactar una sección específica."""
    return (
        f"Redacta solo el punto {numero_seccion}: {titulo_seccion}.\n"
        f"{PROMPT_SECCION_GENERICA}\n"
        f"Texto base del punto: {contenido_actual or '(vacío)'}\n\n"
        "Instrucciones de salida: máximo 70 palabras, sin frases promocionales.\n"
        "Contexto del informe completo:\n"
        f"{contexto_informe}"
    )


def build_user_prompt_observaciones(observaciones_actuales, contexto_informe):
    """Construye el prompt de usuario para redactar observaciones finales."""
    return (
        f"{PROMPT_OBSERVACIONES_FINALES}\n"
        f"Texto base actual: {observaciones_actuales or '(vacío)'}\n\n"
        "Instrucciones de salida: máximo 45 palabras, cierre sobrio y técnico.\n"
        "Contexto del informe técnico:\n"
        f"{contexto_informe}"
    )


# ============ CONFIGURACIÓN DE MODELOS ==========
DEFAULT_MODEL = "gpt-4-mini"
DEFAULT_TEMPERATURE = 0.2

# ============ PATRONES para LIMPIEZA de RESPUESTAS ==========
CLEANUP_PATTERNS = {
    "observaciones": r"^\s*observaciones\s*(de\s*entrega)?\s*[:.-]?\s*",
    "titulo_acta": r"^\s*(?:informe\s*tecnico|acta\s*tecnica|informe\s*de\s*intervencion)\s*[:.-]?\s*",
}
