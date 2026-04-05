import os
import posixpath
import paramiko

HOST='194.164.164.78'
USER='root'
PWD='cwtC7sJe'
LOCAL_BUILD=r'C:\\Users\\moniq\\specialwash\\frontend\\build'
REMOTE_BUILD='/root/specialwash/frontend/build'

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

for root, dirs, files in os.walk(LOCAL_BUILD):
    rel_dir = os.path.relpath(root, LOCAL_BUILD)
    rel_dir = '' if rel_dir == '.' else rel_dir.replace('\\', '/')
    remote_dir = REMOTE_BUILD if not rel_dir else REMOTE_BUILD + '/' + rel_dir
    ensure_remote_dir(remote_dir)
    for name in files:
        local_path = os.path.join(root, name)
        remote_path = remote_dir + '/' + name
        sftp.put(local_path, remote_path)
        print('UP', (rel_dir + '/' + name).lstrip('/'))

sftp.close()
for cmd in [
    'systemctl restart nginx',
    "curl -s https://specialwash.studio | grep -o 'static/js/main[^\" ]*' | head -1",
    "curl -s -I https://specialwash.studio/static/js/main.70c9012d.js | head -n 1",
    "curl -s -I https://specialwash.studio/static/css/main.2bf6eb74.css | head -n 1",
]:
    _, so, se = ssh.exec_command(cmd)
    out = so.read().decode('utf-8', 'ignore').strip()
    err = se.read().decode('utf-8', 'ignore').strip()
    print('\n$ ' + cmd)
    print(out)
    if err:
        print('ERR', err)

verify = "python3 - << 'PY'\nimport requests,re\nhtml=requests.get('https://specialwash.studio',timeout=20).text\nm=re.search(r'static/js/main\\.[a-f0-9]+\\.js', html)\nprint('bundle', m.group(0) if m else '')\nif m:\n js=requests.get('https://specialwash.studio/' + m.group(0), timeout=20).text\n print('hoja_intervencion', 'Hoja de intervencion' in js)\n print('sw_repaso_resumen', 'sw-repaso-resumen' in js)\nPY"
_, so, se = ssh.exec_command(verify)
out = so.read().decode('utf-8', 'ignore').strip()
err = se.read().decode('utf-8', 'ignore').strip()
print('\n$ verify live bundle')
print(out)
if err:
    print('ERR', err)

ssh.close()
print('DEPLOY_OK')
