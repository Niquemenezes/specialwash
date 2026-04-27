import paramiko, os, posixpath

HOST = "194.164.164.78"
USER = "root"
PWD = "cwtC7sJe"
LOCAL_ROOT = r'C:\Users\moniq\OneDrive\Escritorio\specialwash-nuevodesing'
REMOTE_ROOT = '/root/specialwash'

FILES = [
    'backend/routes/parte_trabajo_routes.py',
    'backend/api/inspeccion_routes.py',
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

for rel in FILES:
    lp = os.path.join(LOCAL_ROOT, *rel.split('/'))
    rp = REMOTE_ROOT + '/' + rel
    ensure_remote_dir(posixpath.dirname(rp))
    sftp.put(lp, rp)
    print('UP', rel)

sftp.close()

for cmd in [
    'systemctl restart specialwash-backend.service',
    'sleep 2 && systemctl is-active specialwash-backend.service',
    'curl -s -o /dev/null -w "%{http_code}" https://specialwash.studio/api/salud',
]:
    _, so, se = ssh.exec_command(cmd)
    out = so.read().decode('utf-8', 'ignore').strip()
    err = se.read().decode('utf-8', 'ignore').strip()
    print(f'\n$ {cmd}')
    print(out)
    if err:
        print('ERR', err)

ssh.close()
print('\nDEPLOY_OK')
