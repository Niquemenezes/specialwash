"""
Servicio de notificaciones WhatsApp via Meta Cloud API.

Variables de entorno necesarias:
  WHATSAPP_TOKEN           → Token permanente de Meta App
  WHATSAPP_PHONE_NUMBER_ID → ID del número emisor (WhatsApp Business)
  WHATSAPP_RECIPIENT       → Número destino del admin (sin +, ej: 34645811313)
  WHATSAPP_TEMPLATE_NAME   → Nombre de la plantilla aprobada (default: nueva_inspeccion)
  WHATSAPP_TEMPLATE_LANG   → Idioma de la plantilla (default: es)

Si WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID no están configurados,
el servicio imprime un aviso y retorna False sin lanzar excepción.
"""

import json
import os
import logging
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

logger = logging.getLogger(__name__)

META_API_URL = "https://graph.facebook.com/v19.0/{phone_number_id}/messages"


def enviar_notificacion_inspeccion(
    cliente_nombre: str,
    matricula: str,
    cliente_telefono: str,
    fecha_hora: str,
) -> bool:
    """
    Envía un mensaje WhatsApp al número del administrador informando
    de una nueva inspección de recepción.

    Retorna True si el envío fue exitoso, False en cualquier otro caso.
    La función nunca lanza excepción para no interrumpir el flujo principal.
    """
    token = os.getenv("WHATSAPP_TOKEN", "").strip()
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    recipient = os.getenv("WHATSAPP_RECIPIENT", "34645811313").strip()
    template_name = os.getenv("WHATSAPP_TEMPLATE_NAME", "nueva_inspeccion").strip()
    template_lang = os.getenv("WHATSAPP_TEMPLATE_LANG", "es").strip()

    if not token or not phone_number_id:
        logger.info("WhatsApp: WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configurados. Se omite notificación.")
        return False

    url = META_API_URL.format(phone_number_id=phone_number_id)

    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": template_lang},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": cliente_nombre or "-"},
                        {"type": "text", "text": matricula or "-"},
                        {"type": "text", "text": cliente_telefono or "-"},
                        {"type": "text", "text": fecha_hora or "-"},
                    ],
                }
            ],
        },
    }

    try:
        body = json.dumps(payload).encode("utf-8")
        req = urlrequest.Request(
            url,
            data=body,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urlrequest.urlopen(req, timeout=8) as resp:
            status = resp.getcode()
            if status == 200:
                logger.info("WhatsApp: notificación enviada correctamente a %s", recipient)
                return True
            else:
                logger.warning("WhatsApp: respuesta inesperada HTTP %s", status)
                return False

    except HTTPError as e:
        body_err = ""
        try:
            body_err = e.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        logger.warning("WhatsApp: HTTP error %s — %s", e.code, body_err)
        return False
    except URLError as e:
        logger.warning("WhatsApp: error de red — %s", e.reason)
        return False
    except Exception as e:
        logger.warning("WhatsApp: error inesperado — %s", e)
        return False
