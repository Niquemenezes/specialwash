"""Deploy: flujo colaborativo pintura + reporte coste por vehículo."""
import os
import posixpath
import paramiko

HOST = os.getenv("SPECIALWASH_DEPLOY_HOST", "YOUR_SERVER_IP")
USER = os.getenv("SPECIALWASH_DEPLOY_USER", "root")
PWD  = os.getenv("SPECIALWASH_DEPLOY_PASSWORD")
if not PWD or HOST == "YOUR_SERVER_IP":
    raise SystemExit("Pon SPECIALWASH_DEPLOY_HOST y SPECIALWASH_DEPLOY_PASSWORD antes de ejecutar.")

LOCAL_ROOT   = r'C:\Users\moniq\OneDrive\Escritorio\specialwash-nuevodesing'
REMOTE_ROOT  = '/root/specialwash'
LOCAL_BUILD  = os.path.join(LOCAL_ROOT, 'frontend', 'build')
REMOTE_BUILD = REMOTE_ROOT + '/frontend/build'

BACKEND_FILES = [
    'backend/routes/parte_trabajo_routes.py',
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PWD, timeout=20)
sftp = ssh.open_sftp()


def ensure_remote_dir(path):
    parts = path.strip('/').split('/')
    cur = ''
    for p in parts:
        cur += '/' + p
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            sftp.mkdir(cur)


def upload_file(rel):
    lp = os.path.join(LOCAL_ROOT, *rel.split('/'))
    rp = REMOTE_ROOT + '/' + rel.replace('\\', '/')
    ensure_remote_dir(posixpath.dirname(rp))
    sftp.put(lp, rp)
    print('UP', rel)


# 1. Backend
for rel in BACKEND_FILES:
    upload_file(rel)

# 2. Frontend build completo
print('\nSubiendo frontend build...')
for root, dirs, files in os.walk(LOCAL_BUILD):
    rel_dir = os.path.relpath(root, LOCAL_BUILD)
    rel_dir = '' if rel_dir == '.' else rel_dir.replace('\\', '/')
    remote_dir = REMOTE_BUILD if not rel_dir else REMOTE_BUILD + '/' + rel_dir
    ensure_remote_dir(remote_dir)
    for name in files:
        sftp.put(os.path.join(root, name), remote_dir + '/' + name)
print('UP frontend/build completo')

sftp.close()

# 3. Reiniciar servicios
cmds = [
    'systemctl restart specialwash-backend.service',
    'systemctl restart nginx',
    'systemctl is-active specialwash-backend.service',
    "curl -s https://specialwash.studio | grep -o 'static/js/main[^\" ]*' | head -1",
]
for c in cmds:
    _, so, se = ssh.exec_command(c)
    out = so.read().decode('utf-8', 'ignore').strip()
    err = se.read().decode('utf-8', 'ignore').strip()
    print('\n$', c)
    print(out)
    if err:
        print('ERR', err)

# 4. Verificar bundle
_, so, se = ssh.exec_command(r"""python3 - << 'PY'
import requests, re
html = requests.get('https://specialwash.studio', timeout=20).text
m = re.search(r'static/js/main\.[a-f0-9]+\.js', html)
print('bundle', m.group(0) if m else 'NOT FOUND')
if m:
    js = requests.get('https://specialwash.studio/' + m.group(0), timeout=20).text
    print('reporte_coches endpoint', 'reporte_coches' in js)
    print('Por vehiculo / Coste tab', 'Por veh' in js)
PY""")
out = so.read().decode('utf-8', 'ignore').strip()
err = se.read().decode('utf-8', 'ignore').strip()
print('\n$ verify bundle')
print(out)
if err:
    print('ERR', err)

ssh.close()
print('\nDEPLOY_OK')
