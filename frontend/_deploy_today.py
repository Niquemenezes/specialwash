import os
import posixpath
from pathlib import Path
from datetime import datetime
import paramiko

HOST = os.getenv("SPECIALWASH_DEPLOY_HOST", "YOUR_SERVER_IP")
USER = os.getenv("SPECIALWASH_DEPLOY_USER", "root")
PASSWORD = os.getenv("SPECIALWASH_DEPLOY_PASSWORD")
if not PASSWORD or HOST == "YOUR_SERVER_IP":
    raise SystemExit("Set SPECIALWASH_DEPLOY_HOST and SPECIALWASH_DEPLOY_PASSWORD before running this script.")
LOCAL_ROOT = str(Path(__file__).resolve().parents[1])
REMOTE_ROOT='/root/specialwash'
LIVE_FRONTEND_ROOT='/var/www/specialwash/public_html'
print('LOCAL_ROOT', LOCAL_ROOT)

EXCLUDE_DIR_NAMES={'.git','node_modules','build','__pycache__','venv','.venv'}
EXCLUDE_EXT={'.pyc','.pyo','.log'}
SCAN_DIRS=['backend','frontend/src','frontend/public','frontend/package.json']

today = datetime.now().date()
files=[]

for entry in SCAN_DIRS:
    p = os.path.join(LOCAL_ROOT, *entry.split('/'))
    if os.path.isfile(p):
        mdate = datetime.fromtimestamp(os.path.getmtime(p)).date()
        if mdate == today:
            rel = os.path.relpath(p, LOCAL_ROOT).replace('\\\\','/')
            files.append(rel)
        continue

    for root, dirs, fnames in os.walk(p):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIR_NAMES]
        for fn in fnames:
            ext = os.path.splitext(fn)[1].lower()
            if ext in EXCLUDE_EXT:
                continue
            full = os.path.join(root, fn)
            try:
                mdate = datetime.fromtimestamp(os.path.getmtime(full)).date()
            except OSError:
                continue
            if mdate == today:
                rel = os.path.relpath(full, LOCAL_ROOT).replace('\\\\','/')
                files.append(rel)

files = sorted(set(files))
print(f'TOTAL_ARCHIVOS_HOY={len(files)}')
for f in files[:120]:
    print('  ', f)
if len(files) > 120:
    print(f'  ... y {len(files)-120} más')

if not files:
    raise SystemExit('No se encontraron archivos de hoy para desplegar')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=25)
sftp = ssh.open_sftp()

def ensure_remote_dir(path):
    d = posixpath.dirname(path)
    parts=[]
    while d not in ('','/'):
        parts.append(d)
        d = posixpath.dirname(d)
    for item in reversed(parts):
        try:
            sftp.stat(item)
        except FileNotFoundError:
            sftp.mkdir(item)

for rel in files:
    lp = os.path.join(LOCAL_ROOT, *rel.split('/'))
    rp = posixpath.join(REMOTE_ROOT, rel)
    ensure_remote_dir(rp)
    sftp.put(lp, rp)
print('UPLOAD_OK')
sftp.close()

def run(cmd):
    _, so, se = ssh.exec_command(cmd)
    out = so.read().decode('utf-8','ignore')
    err = se.read().decode('utf-8','ignore')
    rc = so.channel.recv_exit_status()
    print(f"\\n$ {cmd}\\nexit={rc}")
    if out.strip():
        print(out.strip())
    if err.strip():
        print('STDERR:\n'+err.strip())
    return rc

# Backup real de la BD en producción antes de reiniciar nada
run("mkdir -p /root/specialwash/backend/instance/backups && cp /root/specialwash/backend/instance/specialwash.db /root/specialwash/backend/instance/backups/specialwash-predeploy-$(date +%Y%m%d-%H%M%S).db && ls -1t /root/specialwash/backend/instance/backups | head -3")

# Deploy sin tocar la BD activa
run('cd /root/specialwash/frontend && npm run build')
run("ts=$(date +%Y%m%d-%H%M%S); mkdir -p /var/www/specialwash/_frontend_backups; cp -a /var/www/specialwash/public_html /var/www/specialwash/_frontend_backups/public_html_$ts; find /var/www/specialwash/public_html -mindepth 1 -maxdepth 1 -exec rm -rf {} +; cp -a /root/specialwash/frontend/build/. /var/www/specialwash/public_html/; chown -R www-data:www-data /var/www/specialwash/public_html")
run('systemctl restart specialwash-backend.service')
run('systemctl restart nginx')
run("curl -s https://specialwash.studio | grep -o 'static/js/main[^\\\" ]*' | head -1")
run("B=$(curl -s https://specialwash.studio | grep -o 'static/js/main[^\\\" ]*' | head -1); echo BUNDLE=$B; curl -s https://specialwash.studio/$B | grep -o 'sw-theme-toggle' | head -1")
run("B=$(curl -s https://specialwash.studio | grep -o 'static/js/main[^\\\" ]*' | head -1); echo BUNDLE=$B; curl -s https://specialwash.studio/$B | grep -o 'Fichar' | head -1")
run("python3 - << 'PY'\nimport sqlite3\nconn = sqlite3.connect('/root/specialwash/backend/instance/specialwash.db')\ncur = conn.cursor()\nfor table in ('entrada', 'producto_codigo_barras', 'inspeccion_recepcion', 'parte_trabajo'):\n    try:\n        cur.execute(f'SELECT COUNT(*) FROM {table}')\n        print(table, cur.fetchone()[0])\n    except Exception as exc:\n        print(table, 'ERR', exc)\nconn.close()\nPY")
run('systemctl is-active specialwash-backend.service')
run('systemctl is-active nginx')

ssh.close()
print('DEPLOY_TODOS_CAMBIOS_HOY_OK')
