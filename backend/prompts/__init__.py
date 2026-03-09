"""
Paquete de prompts centralizados para OpenAI.
Importa desde acta_entrega_prompts según necesites.
"""

from .acta_entrega_prompts import (
    SYSTEM_PROMPT_REDACTOR,
    PREMIUM_TONE_RULES,
    PROMPT_SECCION_GENERICA,
    PROMPT_OBSERVACIONES_FINALES,
    build_user_prompt_acta,
    build_user_prompt_seccion,
    build_user_prompt_observaciones,
    DEFAULT_MODEL,
    DEFAULT_TEMPERATURE,
    CLEANUP_PATTERNS,
)

__all__ = [
    "SYSTEM_PROMPT_REDACTOR",
    "PREMIUM_TONE_RULES",
    "PROMPT_SECCION_GENERICA",
    "PROMPT_OBSERVACIONES_FINALES",
    "build_user_prompt_acta",
    "build_user_prompt_seccion",
    "build_user_prompt_observaciones",
    "DEFAULT_MODEL",
    "DEFAULT_TEMPERATURE",
    "CLEANUP_PATTERNS",
]
