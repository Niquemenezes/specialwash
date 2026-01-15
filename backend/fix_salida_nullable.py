import sqlite3

# Ruta a tu base de datos
DB_PATH = "specialwash.db"

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.execute("PRAGMA foreign_keys=off;")

# Crear nueva tabla con los campos que permiten NULL
table_sql = '''
CREATE TABLE salida_new (
    id INTEGER PRIMARY KEY,
    fecha DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    producto_id INTEGER NOT NULL,
    producto_nombre VARCHAR(200),
    usuario_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario FLOAT,
    precio_total FLOAT,
    observaciones VARCHAR(255)
);
'''
c.execute(table_sql)

# Copiar los datos
c.execute("INSERT INTO salida_new SELECT * FROM salida;")

# Eliminar la tabla antigua y renombrar la nueva
c.execute("DROP TABLE salida;")
c.execute("ALTER TABLE salida_new RENAME TO salida;")

c.execute("PRAGMA foreign_keys=on;")

conn.commit()
conn.close()

print("¡La tabla 'salida' ahora permite NULL en precio_unitario y precio_total!")
