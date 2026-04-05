import os
import posixpath
import paramiko

HOST='194.164.164.78'
USER='root'
PWD='cwtC7sJe'
LOCAL_ROOT=r'C:\\Users\\moniq\\specialwash'
REMOTE_ROOT='/root/specialwash'

backend_files = [
    'backend/routes/notificacion_routes.py',
]
frontend_source_files = [
    'frontend/src/component/NavbarSW.jsx',
    'frontend/src/pages/HorariosAdminPage.jsx',
    'frontend/src/pages/FicharPage.jsx',
    'frontend/src/App.js',
]

build_local = os.path.join(LOCAL_ROOT, 'frontend', 'build')
build_remote = REMOTE_ROOT + '/frontend/build'

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
    rp = REMOTE_ROOT + '/' + rel_path.replace('\\', '/')
    ensure_remote_dir(posixpath.dirname(rp))
    sftp.put(lp, rp)
    print('UP', rel_path)

# Upload source files
for rel in backend_files + frontend_source_files:
    upload_file(rel)

# Upload frontend build recursively
for root, dirs, files in os.walk(build_local):
    rel_dir = os.path.relpath(root, build_local)
    rel_dir = '' if rel_dir == '.' else rel_dir.replace('\\', '/')
    remote_dir = build_remote if not rel_dir else build_remote + '/' + rel_dir
    ensure_remote_dir(remote_dir)
    for f in files:
        lp = os.path.join(root, f)
        rp = remote_dir + '/' + f
        sftp.put(lp, rp)
print('UP build complete')

sftp.close()

commands = [
    'systemctl restart specialwash-backend.service',
    'systemctl restart nginx',
    'systemctl is-active specialwash-backend.service',
    "curl -s https://specialwash.studio | grep -o 'static/js/main[^\" ]*' | head -1",
]

for c in commands:
    _, so, se = ssh.exec_command(c)
    out = so.read().decode('utf-8', 'ignore').strip()
    err = se.read().decode('utf-8', 'ignore').strip()
    print('\n$ ' + c)
    print(out)
    if err:
        print('ERR', err)

# Verify live bundle contains key strings
_, so, se = ssh.exec_command("python3 - << 'PY'\nimport requests,re\nhtml=requests.get('https://specialwash.studio',timeout=20).text\nm=re.search(r'static/js/main\\.[a-f0-9]+\\.js',html)\nprint('bundle',m.group(0) if m else '')\nif m:\n js=requests.get('https://specialwash.studio/'+m.group(0),timeout=20).text\n print('navbar_expand_lg', 'navbar-expand-lg' in js)\n print('borrar_todas', 'Borrar todas' in js)\n print('recordatorio_fichaje', 'Recuerda fichar tu entrada.' in js)\nPY")
out = so.read().decode('utf-8','ignore').strip()
err = se.read().decode('utf-8','ignore').strip()
print('\n$ verify bundle markers')
print(out)
if err:
    print('ERR', err)

# verify notifications endpoint auth behavior (exists)
_, so, se = ssh.exec_command("curl -s -o /dev/null -w '%{http_code}' https://specialwash.studio/api/notificaciones/no-leidas")
print('\n$ endpoint status /api/notificaciones/no-leidas')
print(so.read().decode('utf-8','ignore').strip())

ssh.close()
print('DEPLOY_OK')
