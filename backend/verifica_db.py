import sqlite3

conn = sqlite3.connect("instance/specialwash.db")
c = conn.cursor()

print("Tablas en la base de datos:")
for row in c.execute("SELECT name FROM sqlite_master WHERE type='table';"):
    print(" -", row[0])

c.execute("SELECT COUNT(*) FROM user;")
print("\nTotal de usuarios:", c.fetchone()[0])

c.execute("SELECT COUNT(*) FROM producto;")
print("Total de productos:", c.fetchone()[0])

print("\nUsuarios:")
for row in c.execute("SELECT * FROM user LIMIT 7;"):
    print(row)

conn.close()