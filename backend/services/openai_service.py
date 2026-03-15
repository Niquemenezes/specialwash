"""
Servicio centralizado para OpenAI.
Encapsula toda la lógica de llamadas a la API de OpenAI.
"""

import os
import json
import sys
from pathlib import Path
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

# Agregar backend al path para imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from prompts import (
    SYSTEM_PROMPT_REDACTOR,
    build_user_prompt_acta,
    build_user_prompt_seccion,
    build_user_prompt_observaciones,
    DEFAULT_MODEL,
    DEFAULT_TEMPERATURE,
)


class OpenAIService:
    """Servicio para interactuar con OpenAI API."""

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY", "")
        self.model = os.getenv("OPENAI_MODEL", DEFAULT_MODEL)

    def is_configured(self):
        """Verifica si OpenAI está configurado."""
        return bool(self.api_key)

    def generate_acta_completa(self, cliente_nombre, coche_descripcion, matricula, kilometros, averias, borrador):
        """Genera acta completa para una inspeccion."""
        if not self.is_configured():
            raise ValueError("OPENAI_API_KEY no está configurada")

        user_prompt = build_user_prompt_acta(
            cliente_nombre, coche_descripcion, matricula, kilometros, averias, borrador
        )
        # max_tokens: limita coste para acta completa
        return self._call_openai(SYSTEM_PROMPT_REDACTOR, user_prompt, max_tokens=260)

    def generate_seccion(self, numero, titulo, contenido_actual, contexto_informe):
        """Genera una sección específica del acta."""
        if not self.is_configured():
            raise ValueError("OPENAI_API_KEY no está configurada")

        user_prompt = build_user_prompt_seccion(numero, titulo, contenido_actual, contexto_informe)
        # max_tokens: suficiente para un solo punto
        return self._call_openai(SYSTEM_PROMPT_REDACTOR, user_prompt, max_tokens=120)

    def generate_observaciones(self, observaciones_actuales, contexto_informe):
        """Genera observaciones finales del acta."""
        if not self.is_configured():
            raise ValueError("OPENAI_API_KEY no está configurada")

        user_prompt = build_user_prompt_observaciones(observaciones_actuales, contexto_informe)
        # max_tokens: observaciones finales breves
        return self._call_openai(SYSTEM_PROMPT_REDACTOR, user_prompt, max_tokens=80)

    def _call_openai(self, system_prompt, user_prompt, max_tokens=260):
        """Llama a OpenAI API y retorna el contenido generado."""
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": DEFAULT_TEMPERATURE,
            "max_tokens": max_tokens,
        }

        req = urlrequest.Request(
            "https://api.openai.com/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )

        try:
            with urlrequest.urlopen(req, timeout=30) as response:
                body = json.loads(response.read().decode("utf-8"))
            
            contenido = (
                body.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            
            if not contenido:
                raise ValueError("OpenAI retornó respuesta vacía")
            
            return {"texto": contenido, "model": self.model}
        
        except HTTPError as e:
            try:
                error_body = e.read().decode("utf-8")
            except Exception:
                error_body = str(e)
            raise ValueError(f"Error OpenAI: {error_body}")
        
        except URLError as e:
            raise ValueError(f"No se pudo conectar con OpenAI: {str(e)}")
        
        except Exception as e:
            raise ValueError(f"Error al comunicarse con OpenAI: {str(e)}")


# Instancia global del servicio
_openai_service = None


def get_openai_service():
    """Obtiene la instancia singleton del servicio OpenAI."""
    global _openai_service
    if _openai_service is None:
        _openai_service = OpenAIService()
    return _openai_service
