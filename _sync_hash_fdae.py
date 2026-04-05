import os, paramiko
host='194.164.164.78'; user='root'; pwd='cwtC7sJe'
base=r'c:\\Users\\moniq\\specialwash\\frontend\\build'
files=['index.html','asset-manifest.json','static/js/main.fdae5315.js','static/js/main.fdae5315.js.map','static/js/main.fdae5315.js.LICENSE.txt','static/css/main.e1aa99de.css','static/css/main.e1aa99de.css.map']
ssh=paramiko.SSHClient(); ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy()); ssh.connect(host, username=user, password=pwd, timeout=20)
sftp=ssh.open_sftp()
for rel in files:
    lp=os.path.join(base,*rel.split('/'))
    rp='/root/specialwash/frontend/build/'+rel
    if os.path.isfile(lp):
        sftp.put(lp,rp); print('UP',rel)
    else:
        print('MISS',rel)
sftp.close()
for c in ['systemctl restart nginx',"curl -s https://specialwash.studio | grep -o 'static/js/main[^\\\" ]*' | head -1","curl -s -I https://specialwash.studio/static/js/main.fdae5315.js | head -n 1","curl -s -I https://specialwash.studio/static/css/main.e1aa99de.css | head -n 1"]:
    _,so,se=ssh.exec_command(c); out=so.read().decode('utf-8','ignore'); err=se.read().decode('utf-8','ignore'); print('\n$ '+c); print(out.strip());
    if err.strip(): print('ERR',err.strip())
ssh.close(); print('OK')
