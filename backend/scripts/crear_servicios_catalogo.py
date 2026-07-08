"""
Crea/actualiza todos los servicios del catálogo SW en la base de datos del servidor.
Ejecutar localmente — conecta por SSH y modifica la BD directamente.
"""
import paramiko

HOST, USER, PW = '194.164.164.78', 'root', '***REDACTED-PASSWORD***'
DB = '/root/specialwash/backend/instance/specialwash.db'

SERVICIOS_ACTUALIZAR = [
    # (id, nombre, descripcion, precio_base, precio_turismo, precio_suv, precio_todoterreno, minutos, rol)
    (5, "Lavado Premium de Mantenimiento SW",
     "Solo vehículos en estado normal de suciedad. Llantas con ácido, prelavado espuma Flowey, lavado con champú-cera, secado técnico, aspirado profundo, limpieza interior y sellado de neumáticos.",
     None, 90.0, 100.0, 120.0, 120, "detailing"),

    (6, "Reacondicionamiento SW con Desmontaje",
     "Para vehículos con suciedad acumulada, manchas severas o pelos de mascota. Incluye desmontaje técnico de asientos para limpieza total del habitáculo.",
     None, 160.0, 175.0, 190.0, 210, "detailing"),
]

SERVICIOS_NUEVOS = [
    # (nombre, descripcion, precio_base, precio_turismo, precio_suv, precio_todoterreno, minutos, rol)
    ("Suplemento Sellado CarPro Reload 2.0",
     "Sellado cerámico rápido SiO2. Repele suciedad, brillo espejo hiperbrillante. Se aplica como complemento a cualquier servicio o como capa de sacrificio sobre cerámicos existentes.",
     None, 40.0, 50.0, 60.0, 20, "detailing"),

    ("Rejuvenecimiento y Protección Express SW",
     "Descontaminado químico (IronX) + clay bar + pulido a máquina + sellado cerámico (Elixir). El coche duerme en la nave y se entrega al día siguiente con funda elástica.",
     None, 300.0, 350.0, 400.0, 360, "detailing"),

    ("Limpieza Estética de Motor SW",
     "Limpieza estética del compartimento superior del motor. Protección eléctrica, lavado cuidadoso, secado con aire a presión y acondicionamiento con barniz base agua.",
     60.0, None, None, None, 60, "detailing"),

    ("Restauración de Faros Nivel 1 - Express",
     "Lijado progresivo para eliminar capa quemada + pulido de corte y acabado con máquina + sellado de protección. 50 €/faro — 100 € la pareja.",
     100.0, None, None, None, 60, "detailing"),

    ("Restauración de Faros Nivel 2 - Barniz 2K",
     "Lijado riguroso + desengrasado técnico + barniz de policarbonato 2K con filtro UV. Garantía 2 años contra pérdida de transparencia. 65 €/faro — 130 € la pareja.",
     130.0, None, None, None, 120, "detailing"),

    ("Restauración Estética de Cuero - Volante",
     "Limpieza profunda, lijado técnico, reparación con cuero líquido, pintura con aerógrafo y barniz de poliuretano. Desde 120 € según desgaste. Solo daños estéticos.",
     120.0, None, None, None, 90, "tapicero"),

    ("Restauración Estética de Cuero - Asiento",
     "Limpieza profunda, lijado técnico, reparación con cuero líquido, pintura con aerógrafo y barniz de poliuretano. Desde 150 € según superficie. Solo daños estéticos.",
     150.0, None, None, None, 150, "tapicero"),
]


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, str):
        return f"'{v.replace(chr(39), chr(39)+chr(39))}'"
    return str(v)


ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PW, timeout=15)


def run_sql(sql):
    _, out, err = ssh.exec_command(f"sqlite3 {DB} \"{sql}\"")
    o = out.read().decode().strip()
    e = err.read().decode().strip()
    if e:
        print(f"  ERROR: {e}")
    return o


print("=== Actualizando servicios existentes ===")
for sid, nombre, desc, pb, pt, ps, ptt, mins, rol in SERVICIOS_ACTUALIZAR:
    sql = (
        f"UPDATE servicios_catalogo SET "
        f"nombre={q(nombre)}, descripcion={q(desc)}, "
        f"precio_base={q(pb)}, precio_turismo={q(pt)}, precio_suv={q(ps)}, precio_todoterreno={q(ptt)}, "
        f"tiempo_estimado_minutos={q(mins)}, rol_responsable={q(rol)} "
        f"WHERE id={sid};"
    )
    run_sql(sql)
    print(f"  ID {sid} actualizado: {nombre}")

print("\n=== Creando nuevos servicios ===")
for nombre, desc, pb, pt, ps, ptt, mins, rol in SERVICIOS_NUEVOS:
    # Verificar si ya existe
    existe = run_sql(f"SELECT id FROM servicios_catalogo WHERE nombre='{nombre}';")
    if existe:
        print(f"  Ya existe (ID {existe}): {nombre}")
        continue
    sql = (
        f"INSERT INTO servicios_catalogo "
        f"(nombre, descripcion, precio_base, precio_turismo, precio_suv, precio_todoterreno, "
        f"tiempo_estimado_minutos, rol_responsable, activo, created_at) VALUES "
        f"({q(nombre)}, {q(desc)}, {q(pb)}, {q(pt)}, {q(ps)}, {q(ptt)}, "
        f"{q(mins)}, {q(rol)}, 1, datetime('now'));"
    )
    run_sql(sql)
    nuevo_id = run_sql("SELECT last_insert_rowid();")
    print(f"  ID {nuevo_id} creado: {nombre}")

print("\n=== Estado final del catálogo ===")
result = run_sql(
    "SELECT id, nombre, precio_base, precio_turismo, precio_suv, precio_todoterreno, "
    "tiempo_estimado_minutos, rol_responsable FROM servicios_catalogo ORDER BY id;"
)
for line in result.split('\n'):
    print(" ", line)

ssh.close()
print("\nListo.")
