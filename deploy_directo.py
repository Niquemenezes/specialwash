"""Deploy directo: sube archivos backend cambiados + frontend completo + reinicia Flask."""
import paramiko, os, sys

HOST = '194.164.164.78'
USER = 'root'
PASSWORD = 'cwtC7sJe'
REMOTE_BACKEND = '/root/specialwash/backend'
REMOTE_FRONTEND = '/var/www/specialwash/public_html'

FILES_BACKEND = [
    ('backend/services/google_sheets_service.py',           f'{REMOTE_BACKEND}/services/google_sheets_service.py'),
    ('backend/api/inspeccion_routes.py',                    f'{REMOTE_BACKEND}/api/inspeccion_routes.py'),
    ('backend/api/media_routes.py',                         f'{REMOTE_BACKEND}/api/media_routes.py'),
    ('backend/api/repaso_routes.py',                        f'{REMOTE_BACKEND}/api/repaso_routes.py'),
    ('backend/api/cobro_routes.py',                         f'{REMOTE_BACKEND}/api/cobro_routes.py'),
    ('backend/api/entrega_routes.py',                       f'{REMOTE_BACKEND}/api/entrega_routes.py'),
    ('backend/api/tabla_routes.py',                         f'{REMOTE_BACKEND}/api/tabla_routes.py'),
    ('backend/utils/inspeccion_helpers.py',                 f'{REMOTE_BACKEND}/utils/inspeccion_helpers.py'),
    ('backend/routes/__init__.py',                          f'{REMOTE_BACKEND}/routes/__init__.py'),
    ('backend/routes/parte_trabajo_routes.py',              f'{REMOTE_BACKEND}/routes/parte_trabajo_routes.py'),
    ('backend/models/servicio_catalogo.py',                 f'{REMOTE_BACKEND}/models/servicio_catalogo.py'),
    ('backend/models/inspeccion_recepcion.py',              f'{REMOTE_BACKEND}/models/inspeccion_recepcion.py'),
    ('backend/routes/servicio_catalogo_routes.py',          f'{REMOTE_BACKEND}/routes/servicio_catalogo_routes.py'),
    ('backend/routes/almacen_routes.py',                    f'{REMOTE_BACKEND}/routes/almacen_routes.py'),
]

def run(ssh, cmd, quiet=False):
    if not quiet:
        print(f"  $ {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out and not quiet:
        print(f"    {out}")
    if err and not quiet:
        print(f"    [stderr] {err}")
    return out

def sftp_mkdir_p(sftp, remote_path):
    parts = remote_path.split('/')
    path = ''
    for part in parts:
        if not part:
            continue
        path = f'{path}/{part}'
        try:
            sftp.stat(path)
        except FileNotFoundError:
            try:
                sftp.mkdir(path)
            except Exception:
                pass

def sftp_upload_tree(sftp, local_dir, remote_dir):
    count = 0
    for root, dirs, files in os.walk(local_dir):
        rel = os.path.relpath(root, local_dir).replace(os.sep, '/')
        rdir = remote_dir if rel == '.' else f'{remote_dir}/{rel}'
        sftp_mkdir_p(sftp, rdir)
        for f in files:
            sftp.put(os.path.join(root, f), f'{rdir}/{f}')
            count += 1
    return count

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)
print("Conectado.\n")

sftp = ssh.open_sftp()

# 1. Subir archivos backend
print("=== 1. Subiendo archivos backend ===")
base = os.path.dirname(__file__)
for local_rel, remote in FILES_BACKEND:
    local = os.path.join(base, local_rel)
    if os.path.exists(local):
        sftp.put(local, remote)
        print(f"  OK: {local_rel}")
    else:
        print(f"  SKIP (no existe local): {local_rel}")

# 2. Subir frontend build completo
print("\n=== 2. Subiendo frontend build ===")
local_build = os.path.join(base, 'frontend', 'build')
if os.path.isdir(local_build):
    # Limpiar directorio remoto primero
    run(ssh, f"rm -rf {REMOTE_FRONTEND}/* 2>/dev/null; echo cleared", quiet=True)
    n = sftp_upload_tree(sftp, local_build, REMOTE_FRONTEND)
    print(f"  {n} archivos subidos a {REMOTE_FRONTEND}")
else:
    print("  ERROR: no existe frontend/build")

sftp.close()

# 3. Reiniciar Flask
print("\n=== 3. Reiniciando backend ===")
run(ssh, "pkill -f 'python3 app.py' 2>/dev/null; sleep 1; echo killed")
run(ssh, f"cd {REMOTE_BACKEND} && nohup /root/specialwash/backend/venv/bin/python3 app.py > /tmp/backend.log 2>&1 &")
run(ssh, "sleep 3 && pgrep -f 'python3 app.py' && echo 'Flask corriendo' || echo 'Flask NO arrancó'")

ssh.close()
print("\nDeploy directo completado.")
