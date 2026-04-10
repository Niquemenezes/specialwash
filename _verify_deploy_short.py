import os
import paramiko
host = os.getenv("SPECIALWASH_DEPLOY_HOST", "YOUR_SERVER_IP"); user = os.getenv("SPECIALWASH_DEPLOY_USER", "root"); pwd = os.getenv("SPECIALWASH_DEPLOY_PASSWORD")
if not pwd or host == "YOUR_SERVER_IP":
    raise SystemExit("Set SPECIALWASH_DEPLOY_HOST and SPECIALWASH_DEPLOY_PASSWORD before running this script.")
ssh=paramiko.SSHClient(); ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy()); ssh.connect(host, username=user, password=pwd, timeout=20)
cmds=[
 'systemctl is-active specialwash-backend.service',
 "grep -n \"Elimina una notificación al marcarla como leída\" /root/specialwash/backend/routes/notificacion_routes.py || true",
 "grep -n \"navbar-expand-lg\" /root/specialwash/frontend/src/component/NavbarSW.jsx || true",
 "curl -s https://specialwash.studio | grep -o 'static/js/main[^\\\" ]*' | head -1",
 "python3 - << 'PY'\nimport requests,re\nhtml=requests.get('https://specialwash.studio',timeout=20).text\nm=re.search(r'static/js/main\\.[a-f0-9]+\\.js',html)\nprint('bundle',m.group(0) if m else '')\nif m:\n js=requests.get('https://specialwash.studio/'+m.group(0),timeout=20).text\n print('navbar_expand_lg', 'navbar-expand-lg' in js)\n print('borrar_todas', 'Borrar todas' in js)\nPY"
]
for c in cmds:
 _,so,se=ssh.exec_command(c)
 out=so.read().decode('utf-8','ignore').strip(); err=se.read().decode('utf-8','ignore').strip()
 print('\n$ '+c); print(out)
 if err: print('ERR',err)
ssh.close()
