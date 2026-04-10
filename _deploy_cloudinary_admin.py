import os
import posixpath
import paramiko

HOST = os.getenv("SPECIALWASH_DEPLOY_HOST", "YOUR_SERVER_IP")
USER = os.getenv("SPECIALWASH_DEPLOY_USER", "root")
PASSWORD = os.getenv("SPECIALWASH_DEPLOY_PASSWORD")
if not PASSWORD or HOST == "YOUR_SERVER_IP":
    raise SystemExit("Set SPECIALWASH_DEPLOY_HOST and SPECIALWASH_DEPLOY_PASSWORD before running this script.")
LOCAL_ROOT=r'c:\\Users\\moniq\\specialwash'
REMOTE_ROOT='/root/specialwash'

files=[
 'backend/routes/horario_routes.py',
 'frontend/src/utils/horarioApi.js',
 'frontend/src/pages/HorariosAdminPage.jsx',
]

ssh=paramiko.SSHClient(); ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy()); ssh.connect(HOST, username=USER, password=PASSWORD, timeout=20)
sftp=ssh.open_sftp()

def ensure_dir(path):
    d=posixpath.dirname(path)
    parts=[]
    while d not in ('','/'):
        parts.append(d); d=posixpath.dirname(d)
    for p in reversed(parts):
        try: sftp.stat(p)
        except FileNotFoundError: sftp.mkdir(p)

for rel in files:
    lp=os.path.join(LOCAL_ROOT,*rel.split('/'))
    rp=posixpath.join(REMOTE_ROOT,rel)
    ensure_dir(rp)
    sftp.put(lp,rp)
    print('UPLOADED', rel)

# sync full frontend build
build_local=os.path.join(LOCAL_ROOT,'frontend','build')
for root, dirs, fnames in os.walk(build_local):
    for fn in fnames:
        lp=os.path.join(root,fn)
        rel=os.path.relpath(lp,build_local).replace('\\\\','/')
        rp=posixpath.join(REMOTE_ROOT,'frontend','build',rel)
        ensure_dir(rp)
        sftp.put(lp,rp)

sftp.close()

cmds=[
 'systemctl restart specialwash-backend.service',
 'systemctl restart nginx',
 'systemctl is-active specialwash-backend.service',
 'systemctl is-active nginx',
 "curl -s https://specialwash.studio | grep -o 'static/js/main[^\\\" ]*' | head -1",
 "B=$(curl -s https://specialwash.studio | grep -o 'static/js/main[^\\\" ]*' | head -1); echo BUNDLE=$B; curl -s https://specialwash.studio/$B | grep -o 'Foto entrada' | head -1",
 "B=$(curl -s https://specialwash.studio | grep -o 'static/js/main[^\\\" ]*' | head -1); echo BUNDLE=$B; curl -s https://specialwash.studio/$B | grep -o 'sw-theme-toggle' | head -1",
]

for c in cmds:
    _,so,se=ssh.exec_command(c)
    out=so.read().decode('utf-8','ignore')
    err=se.read().decode('utf-8','ignore')
    rc=so.channel.recv_exit_status()
    print(f'\\n$ {c}\\nRC={rc}')
    if out.strip(): print(out.strip())
    if err.strip(): print('ERR:\n'+err.strip())

ssh.close()
print('DEPLOY_DONE')
