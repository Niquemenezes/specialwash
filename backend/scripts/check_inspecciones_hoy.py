"""Muestra las inspecciones creadas hoy (2026-06-01) para añadirlas manualmente a Google Sheets Junio."""
import paramiko, io

HOST = '194.164.164.78'
USER = 'root'
PASSWORD = '***REDACTED-PASSWORD***'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

query = """
SELECT ir.id, ir.matricula, ir.coche_descripcion, ir.cliente_nombre,
       ir.fecha_inspeccion, ir.servicios_aplicados, ir.averias_notas,
       ir.es_concesionario
FROM inspeccion_recepcion ir
WHERE date(ir.fecha_inspeccion) >= '2026-06-01'
ORDER BY ir.fecha_inspeccion DESC
LIMIT 20;
"""

cmd = f'sqlite3 /root/specialwash/backend/instance/specialwash.db "{query}"'
_, stdout, stderr = ssh.exec_command(cmd)
out = stdout.read().decode()
err = stderr.read().decode()
if out.strip():
    print("Inspecciones de hoy (Junio 2026):")
    for line in out.strip().split('\n'):
        print(" ", line)
else:
    print("Sin inspecciones de hoy.")
if err:
    print("Error:", err)

ssh.close()
