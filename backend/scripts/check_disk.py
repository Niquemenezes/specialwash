#!/usr/bin/env python3
"""
check_disk.py — Monitorización de espacio en disco del servidor IONOS.
Se ejecuta diariamente via cron. Si el espacio libre baja del umbral:
  1. Crea una notificación en la app (tabla notificacion)
  2. Intenta enviar un WhatsApp de texto al administrador

Cron sugerido (cada día a las 8:00):
  0 8 * * * /root/specialwash/backend/venv/bin/python3 /root/specialwash/backend/scripts/check_disk.py >> /var/log/check_disk.log 2>&1
"""

import os
import json
import shutil
import sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib import request as urlrequest
from urllib.error import HTTPError, URLError

# ── Configuración ────────────────────────────────────────────────────────────
DB_PATH       = Path("/root/specialwash/backend/instance/specialwash.db")
FLAG_FILE     = Path("/tmp/check_disk_notified.flag")
UMBRAL_GB     = 10          # avisar cuando quede menos de X GB libres
CHECK_PATH    = "/root"     # partición a monitorizar

# WhatsApp (se lee del .env del backend)
ENV_FILE      = Path("/root/specialwash/backend/.env")
META_API_URL  = "https://graph.facebook.com/v19.0/{phone_number_id}/messages"
# ─────────────────────────────────────────────────────────────────────────────


def leer_env():
    env = {}
    try:
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    except Exception:
        pass
    return env


def espacio_libre_gb(path):
    usage = shutil.disk_usage(path)
    return usage.free / (1024 ** 3)


def ya_notificado_hoy():
    if not FLAG_FILE.exists():
        return False
    try:
        ts = float(FLAG_FILE.read_text().strip())
        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
        return (datetime.now(timezone.utc) - dt) < timedelta(hours=20)
    except Exception:
        return False


def marcar_notificado():
    FLAG_FILE.write_text(str(datetime.now(timezone.utc).timestamp()))


def crear_notificacion_app(titulo, cuerpo):
    try:
        conn = sqlite3.connect(str(DB_PATH))
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT INTO notificacion (tipo, titulo, cuerpo, ref_id, created_at) VALUES (?, ?, ?, ?, ?)",
            ("sistema", titulo, cuerpo, None, now)
        )
        conn.commit()
        conn.close()
        print(f"[OK] Notificación en app creada: {titulo}")
    except Exception as e:
        print(f"[ERROR] No se pudo crear notificación en app: {e}")


def enviar_whatsapp(mensaje, env):
    token = env.get("WHATSAPP_TOKEN", "").strip()
    phone_id = env.get("WHATSAPP_PHONE_NUMBER_ID", "").strip()
    recipient = env.get("WHATSAPP_RECIPIENT", "34645811313").strip()

    if not token or not phone_id:
        print("[INFO] WhatsApp no configurado, se omite.")
        return False

    url = META_API_URL.format(phone_number_id=phone_id)
    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "text",
        "text": {"body": mensaje},
    }
    try:
        body = json.dumps(payload).encode("utf-8")
        req = urlrequest.Request(
            url, data=body,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            method="POST",
        )
        with urlrequest.urlopen(req, timeout=8) as resp:
            if resp.getcode() == 200:
                print(f"[OK] WhatsApp enviado a {recipient}")
                return True
    except (HTTPError, URLError, Exception) as e:
        print(f"[WARN] WhatsApp no enviado: {e}")
    return False


def main():
    libre_gb = espacio_libre_gb(CHECK_PATH)
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Espacio libre: {libre_gb:.1f} GB")

    if libre_gb >= UMBRAL_GB:
        print("[OK] Espacio suficiente, sin avisos.")
        return

    if ya_notificado_hoy():
        print("[INFO] Ya se notificó hoy, se omite.")
        return

    libre_str = f"{libre_gb:.1f} GB"
    titulo = f"⚠️ Disco bajo: solo {libre_str} libres"
    cuerpo = f"El servidor IONOS tiene solo {libre_str} de espacio libre en disco. Revisa y libera espacio si es necesario."

    crear_notificacion_app(titulo, cuerpo)

    env = leer_env()
    mensaje_wa = f"⚠️ SW Studio — Aviso de disco:\nEl servidor tiene solo {libre_str} libres. Revisa el espacio en IONOS."
    enviar_whatsapp(mensaje_wa, env)

    marcar_notificado()


if __name__ == "__main__":
    main()
