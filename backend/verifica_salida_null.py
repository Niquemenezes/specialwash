import sqlite3

conn = sqlite3.connect("specialwash.db")
c = conn.cursor()
c.execute("PRAGMA table_info(salida);")
for row in c.fetchall():
    print(row)
conn.close()

# Explicación:
# La columna 'notnull' debe ser 0 para precio_unitario y precio_total.
# Si es 1, siguen siendo NOT NULL y hay que repetir el proceso de migración.