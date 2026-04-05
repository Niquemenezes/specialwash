import os
import posixpath
from datetime import datetime
import paramiko

HOST='194.164.164.78'
USER='root'
PASSWORD='cwtC7sJe'
LOCAL_ROOT=r'c:\\Users\\moniq\\specialwash'
REMOTE_ROOT='/root/specialwash'

# Excluir artefactos y datos sensibles/locales
EXCLUDE_DIR_NAMES={'.git','node_modules','build','__pycache__','venv','.venv','media','instance'}
EXCLUDE_EXT={'.pyc','.pyo','.log','.db','.sqlite','.sqlite3','.jpg','.jpeg','.png','.webp'}
SCAN_DIRS=['backend','frontend/src','frontend/public','frontend/package.json']

now = datetime.now()
today = now.date()
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
print(f'TOTAL_ARCHIVOS_CODIGO_HOY={len(files)}')
for f in files:
    print(' -', f)

if not files:
    raise SystemExit('No hay archivos de código de hoy para desplegar.')

# Guardar manifiesto local
manifest = os.path.join(LOCAL_ROOT, f'deploy-hoy-{now.strftime("%Y%m%d-%H%M%S")}.txt')
with open(manifest, 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(files) + '\n')
print('MANIFEST_LOCAL', manifest)

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

# Backup remoto de archivos a sobrescribir
stamp = now.strftime('%Y%m%d-%H%M%S')
backup_dir = f'/root/specialwash/_backup_deploy_{stamp}'
_, so, se = ssh.exec_command(f'mkdir -p {backup_dir}')
so.channel.recv_exit_status()

for rel in files:
    lp = os.path.join(LOCAL_ROOT, *rel.split('/'))
    rp = posixpath.join(REMOTE_ROOT, rel)
    ensure_remote_dir(rp)

    # copia de seguridad remota del archivo previo si existe
    bkp_target = posixpath.join(backup_dir, rel)
    _, so, se = ssh.exec_command(f"if [ -f '{rp}' ]; then mkdir -p '{posixpath.dirname(bkp_target)}' && cp '{rp}' '{bkp_target}'; fi")
    so.channel.recv_exit_status()

    sftp.put(lp, rp)

sftp.close()
print('UPLOAD_OK')
print('BACKUP_REMOTE', backup_dir)


def run(cmd):
    _, so, se = ssh.exec_command(cmd)
    out = so.read().decode('utf-8','ignore')
    err = se.read().decode('utf-8','ignore')
    rc = so.channel.recv_exit_status()
    print(f"\\n$ {cmd}\\nexit={rc}")
    if out.strip():
        print(out.strip())
    if err.strip():
        print('STDERR:\n' + err.strip())
    return rc

# Deploy sin tocar BD
for cmd in [
    'cd /root/specialwash/frontend && npm run build',
    'systemctl restart specialwash-backend.service',
    'systemctl restart nginx',
    "curl -s https://specialwash.studio | grep -o 'static/js/main[^\\\" ]*' | head -1",
    "B=$(curl -s https://specialwash.studio | grep -o 'static/js/main[^\\\" ]*' | head -1); echo BUNDLE=$B; curl -s https://specialwash.studio/$B | grep -o 'sw-theme-toggle' | head -1",
    "B=$(curl -s https://specialwash.studio | grep -o 'static/js/main[^\\\" ]*' | head -1); echo BUNDLE=$B; curl -s https://specialwash.studio/$B | grep -o 'Fichar' | head -1",
    "B=$(curl -s https://specialwash.studio | grep -o 'static/js/main[^\\\" ]*' | head -1); echo BUNDLE=$B; curl -s https://specialwash.studio/$B | grep -o 'Trabajar tambien' | head -1",
    'systemctl is-active specialwash-backend.service',
    'systemctl is-active nginx',
]:
    rc = run(cmd)
    if rc != 0:
        run('journalctl -u specialwash-backend.service -n 80 --no-pager')
        raise SystemExit(f'Error ejecutando: {cmd}')

ssh.close()
print('DEPLOY_TODOS_CAMBIOS_HOY_OK')
