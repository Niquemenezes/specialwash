import paramiko
ssh=paramiko.SSHClient(); ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy()); ssh.connect('194.164.164.78', username='root', password='cwtC7sJe', timeout=20)
for c in [
"systemctl is-active specialwash-backend.service",
"systemctl is-active nginx",
"curl -s https://specialwash.studio | grep -o 'static/js/main[^\\\" ]*' | head -1",
"B=$(curl -s https://specialwash.studio | grep -o 'static/js/main[^\\\" ]*' | head -1); echo BUNDLE=$B; curl -s https://specialwash.studio/$B | grep -o 'Foto entrada' | head -1",
"B=$(curl -s https://specialwash.studio | grep -o 'static/js/main[^\\\" ]*' | head -1); curl -s https://specialwash.studio/$B | grep -o 'sw-theme-toggle' | head -1",
"journalctl -u specialwash-backend.service -n 25 --no-pager"
]:
    print('\\n$ '+c)
    _,so,se=ssh.exec_command(c)
    out=so.read().decode('utf-8','ignore'); err=se.read().decode('utf-8','ignore')
    if out.strip(): print(out.strip())
    if err.strip(): print('ERR:\n'+err.strip())
ssh.close()
