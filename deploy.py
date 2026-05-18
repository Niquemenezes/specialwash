"""
deploy.py — Script de despliegue para SpecialWash
Uso: python deploy.py

Detecta automáticamente los archivos modificados en git y los sube al servidor.
Si quieres forzar archivos concretos, pásalos como argumentos:
    python deploy.py frontend/src/pages/MiPagina.jsx backend/routes/mi_ruta.py
"""

import os
import posixpath
import subprocess
import sys
from pathlib import Path
import paramiko

# ── Configuración del servidor ──────────────────────────────────────────────
HOST     = '194.164.164.78'
USER     = 'root'
PASSWORD = '***REDACTED-PASSWORD***'
# ────────────────────────────────────────────────────────────────────────────

LOCAL_ROOT  = str(Path(__file__).resolve().parent)
REMOTE_ROOT = '/root/specialwash'

EXCLUDE_EXT = {'.pyc', '.pyo', '.log', '.db', '.sqlite', '.sqlite3',
               '.jpg', '.jpeg', '.png', '.webp', '.gif', '.ico', '.mp4', '.mov'}
DEPLOY_DIRS = {'backend', 'frontend/src', 'frontend/public'}

def get_changed_files():
    """Archivos modificados según git (staged + unstaged + untracked en DEPLOY_DIRS)."""
    result = subprocess.run(
        ['git', 'status', '--porcelain'],
        capture_output=True, text=True, cwd=LOCAL_ROOT
    )
    files = []
    for line in result.stdout.splitlines():
        rel = line[3:].strip().replace('\\', '/')
        # git a veces pone comillas en rutas con espacios
        if rel.startswith('"') and rel.endswith('"'):
            rel = rel[1:-1]
        files.append(rel)
    return files

def filter_files(files):
    """Filtra solo archivos desplegables."""
    valid = []
    for rel in files:
        ext = os.path.splitext(rel)[1].lower()
        if ext in EXCLUDE_EXT:
            continue
        # Solo backend/ y frontend/src|public
        in_scope = any(rel.startswith(d) for d in DEPLOY_DIRS)
        if not in_scope:
            continue
        local_path = os.path.join(LOCAL_ROOT, rel.replace('/', os.sep))
        if not os.path.isfile(local_path):
            continue
        valid.append(rel)
    return sorted(set(valid))

def ensure_remote_dir(sftp, remote_path):
    d = posixpath.dirname(remote_path)
    parts = []
    while d not in ('', '/'):
        parts.append(d)
        d = posixpath.dirname(d)
    for item in reversed(parts):
        try:
            sftp.stat(item)
        except FileNotFoundError:
            sftp.mkdir(item)

def run(ssh, cmd, fatal=True):
    _, so, se = ssh.exec_command(cmd)
    out = so.read().decode('utf-8', 'ignore')
    err = se.read().decode('utf-8', 'ignore')
    rc  = so.channel.recv_exit_status()
    print(f'\n$ {cmd}\nexit={rc}')
    if out.strip(): print(out.strip())
    if err.strip(): print('STDERR:', err.strip())
    if rc != 0 and fatal:
        raise SystemExit(f'Comando fallido (exit={rc}): {cmd}')
    return rc

# ── Determinar archivos a subir ──────────────────────────────────────────────
if len(sys.argv) > 1:
    # Archivos pasados como argumentos
    files = [a.replace('\\', '/') for a in sys.argv[1:]]
    files = [f for f in files if os.path.isfile(os.path.join(LOCAL_ROOT, f.replace('/', os.sep)))]
else:
    files = filter_files(get_changed_files())

if not files:
    raise SystemExit('No hay archivos para desplegar. Haz cambios o pásalos como argumento.')

print(f'\n=== Archivos a desplegar ({len(files)}) ===')
for f in files:
    print(f'  {f}')

# ── Conectar y subir ─────────────────────────────────────────────────────────
print('\n=== Conectando al servidor... ===')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=25)
sftp = ssh.open_sftp()

for rel in files:
    local  = os.path.join(LOCAL_ROOT, rel.replace('/', os.sep))
    remote = posixpath.join(REMOTE_ROOT, rel)
    ensure_remote_dir(sftp, remote)
    sftp.put(local, remote)
    print(f'  OK  {rel}')

sftp.close()
print('\n=== Upload completado ===')

# ── Build y deploy del frontend si hay cambios en él ─────────────────────────
hay_frontend = any(f.startswith('frontend/') for f in files)
hay_backend  = any(f.startswith('backend/') for f in files)

if hay_frontend:
    run(ssh, 'cd /root/specialwash/frontend && npm run build')
    run(ssh, (
        "find /var/www/specialwash/public_html -mindepth 1 -maxdepth 1 -exec rm -rf {} + ; "
        "cp -a /root/specialwash/frontend/build/. /var/www/specialwash/public_html/ ; "
        "chown -R www-data:www-data /var/www/specialwash/public_html"
    ))

if hay_backend or hay_frontend:
    run(ssh, 'systemctl restart specialwash-backend.service')
    run(ssh, 'systemctl restart nginx')

# ── Verificación ─────────────────────────────────────────────────────────────
if hay_frontend:
    run(ssh, "curl -s https://specialwash.studio | grep -o 'static/js/main[^\" ]*' | head -1")

run(ssh, 'systemctl is-active specialwash-backend.service')
run(ssh, 'systemctl is-active nginx')

ssh.close()
print('\n=== DEPLOY OK ===')
