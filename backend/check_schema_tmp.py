import sqlite3

conn = sqlite3.connect('/root/specialwash/backend/instance/specialwash.db')
cur = conn.cursor()
for t in ['servicios_catalogo', 'servicio_catalogo', 'parte_trabajo']:
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (t,))
    print('table', t, '=>', cur.fetchone())
    cur.execute(f"PRAGMA table_info({t})")
    print('cols', [r[1] for r in cur.fetchall()])
conn.close()
