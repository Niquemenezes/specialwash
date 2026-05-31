"""
Deploy revert: sube el build revertido (HEAD frontend + fix backend inspeccion_routes.py)
"""
import os, posixpath, paramiko

HOST = "194.164.164.78"
USER = "root"
PWD = os.getenv("SPECIALWASH_DEPLOY_PASSWORD")
if not PWD:
    raise SystemExit("Falta SPECIALWASH_DEPLOY_PASSWORD")

LOCAL_ROOT = r'C:\Users\moniq\OneDrive\Escritorio\specialwash-nuevodesing'
REMOTE_ROOT = '/root/specialwash'

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

def upload_file(rel_path):
    lp = os.path.join(LOCAL_ROOT, *rel_path.split('/'))
    rp = REMOTE_ROOT + '/' + rel_path
    ensure_remote_dir(posixpath.dirname(rp))
    sftp.put(lp, rp)
    print('UP', rel_path)

# Backend fix (timezone en _parte_match)
upload_file('backend/api/inspeccion_routes.py')

# Frontend source (revertidos a HEAD)
for rel in [
    'frontend/src/components/SidebarSW.jsx',
    'frontend/src/pages/EstadoCochesPage.jsx',
    'frontend/src/pages/AdminPartesTrabajoAcompanamiento.jsx',
    'frontend/src/config/rolePermissions.js',
]:
    upload_file(rel)

# Build completo
build_local = os.path.join(LOCAL_ROOT, 'frontend', 'build')
build_remote = REMOTE_ROOT + '/frontend/build'

for root, dirs, files in os.walk(build_local):
    rel_dir = os.path.relpath(root, build_local)
    rel_dir = '' if rel_dir == '.' else rel_dir.replace('\\', '/')
    remote_dir = build_remote if not rel_dir else build_remote + '/' + rel_dir
    ensure_remote_dir(remote_dir)
    for f in files:
        lp = os.path.join(root, f)
        rp = remote_dir + '/' + f
        sftp.put(lp, rp)

print('UP build completo')
sftp.close()

# Reiniciar servicios
for cmd in [
    'systemctl restart specialwash-backend.service',
    'systemctl restart nginx',
    'systemctl is-active specialwash.service || true',
    'systemctl is-active specialwash-backend.service',
    "curl -s https://specialwash.studio | grep -o 'static/js/main[^\" ]*' | head -1",
]:
    _, so, se = ssh.exec_command(cmd)
    out = so.read().decode('utf-8', 'ignore').strip()
    err = se.read().decode('utf-8', 'ignore').strip()
    print(f'\n$ {cmd}')
    if out: print(out)
    if err: print('ERR', err)

ssh.close()
print('\nDEPLOY_OK')
