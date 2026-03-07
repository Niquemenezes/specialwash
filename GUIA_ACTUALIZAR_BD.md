# Guía: Actualizar Base de Datos desde Producción (Ionos) a GitHub

## Credenciales de Acceso
- **Host:** 194.164.164.78
- **Usuario:** root
- **Contraseña:** cwtC7sJe
- **Puerto SSH:** 22 (por defecto)
- **Ruta de la Base de Datos:** `/root/specialwash/backend/instance/specialwash.db`

---

## Paso 1: Conectarse al Servidor

Abre una terminal y conéctate al servidor:

```bash
ssh root@194.164.164.78
```

Te pedirá la contraseña: `cwtC7sJe`

---

## Paso 2: Localizar la Base de Datos en Producción

Una vez conectado, busca tu base de datos. Normalmente está en alguna de estas ubicaciones:

```bash
# Buscar el archivo specialwash.db
find / -name "specialwash.db" 2>/dev/null

# O buscar en ubicaciones comunes:
ls -la ~/specialwash/backend/instance/
ls -la /var/www/specialwash/backend/instance/
ls -la /home/*/specialwash/backend/instance/
```

Anota la ruta completa donde encuentres el archivo.

---

## Paso 3: Descargar la Base de Datos

**IMPORTANTE:** Sal del servidor primero (escribe `exit` o presiona Ctrl+D)

Desde tu terminal local (ya no conectado al servidor), ejecuta:

```bash
# Reemplaza /ruta/completa/a/specialwash.db con la ruta que encontraste
scp root@194.164.164.78:/ruta/completa/a/specialwash.db /workspaces/specialwash/backend/instance/specialwash.db
```

Te pedirá la contraseña nuevamente.

### Ejemplo completo (tu caso):
```bash
scp root@194.164.164.78:/root/specialwash/backend/instance/specialwash.db /workspaces/specialwash/backend/instance/specialwash.db
```

---

## Paso 4: Hacer Backup (Opcional pero Recomendado)

Antes de reemplazar, haz un backup de tu BD actual:

```bash
cd /workspaces/specialwash/backend/instance/
cp specialwash.db specialwash_backup_$(date +%Y%m%d).db
```

---

## Paso 5: Verificar que se Descargó Correctamente

```bash
ls -lh /workspaces/specialwash/backend/instance/specialwash.db
```

Verás el tamaño del archivo y la fecha de modificación.

---

## Paso 6: Subir al Repositorio de GitHub

```bash
cd /workspaces/specialwash

# Ver el estado actual
git status

# Añadir la base de datos
git add backend/instance/specialwash.db

# Hacer commit
git commit -m "Actualizar BD con productos nuevos de producción"

# Subir a GitHub
git push origin main
```

---

## Método Alternativo: Todo en Un Comando

Si quieres hacerlo todo más rápido (después del backup):

```bash
cd /workspaces/specialwash
cp backend/instance/specialwash.db backend/instance/specialwash_backup_$(date +%Y%m%d).db
scp root@194.164.164.78:/root/specialwash/backend/instance/specialwash.db backend/instance/specialwash.db
git add backend/instance/specialwash.db
git commit -m "Actualizar BD desde producción"
git push origin main
```

---

## Solución de Problemas

### Problema: "Permission denied"
- Verifica que la contraseña sea correcta
- Verifica que el usuario sea `root`

### Problema: "No such file or directory"
- La ruta de la BD en el servidor es incorrecta
- Conéctate al servidor y busca el archivo manualmente

### Problema: No puedo conectarme por SSH
- Verifica que el firewall de Ionos permita conexiones SSH
- Verifica que la IP sea correcta: 194.164.164.78

---

## Notas Importantes

⚠️ **SEGURIDAD:** No compartas este archivo con las credenciales. Considera agregar `GUIA_ACTUALIZAR_BD.md` al `.gitignore`

💡 **CONSEJO:** Puedes automatizar esto con un script bash si lo haces frecuentemente.

📅 **FRECUENCIA:** Haz esto cada vez que añadas productos importantes en producción que quieras tener en tu entorno de desarrollo local.


kill -9 $(lsof -t -i:3000) 2>/dev/null; kill -9 $(lsof -t -i:5000) 2>/dev/null; cd backend && python app.py & cd ../frontend && npm start