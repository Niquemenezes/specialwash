# 🚀 Deployment SpecialWash en Ionos
## IP: 194.164.164.78

---

## ✅ BUILD GENERADO
El frontend está compilado con la IP configurada: `http://194.164.164.78:5000`

---

## 📁 PASO 1: Subir Frontend por FTP

### Conectar a Ionos:
1. Abre tu cliente FTP (FileZilla, WinSCP, etc.)
2. Datos de conexión (desde panel Ionos):
   - **Host:** ftp.tudominio.com (o usa la IP: 194.164.164.78)
   - **Usuario:** [tu usuario FTP de Ionos]
   - **Contraseña:** [tu contraseña FTP de Ionos]
   - **Puerto:** 21 (FTP) o 22 (SFTP)

### Subir archivos:
1. Navega a la carpeta raíz del servidor (generalmente `/` o `/html` o `/httpdocs`)
2. Sube **TODO** el contenido de:
   ```
   frontend\build\
   ```
   
   Archivos a subir:
   - index.html
   - .htaccess
   - favicon.ico
   - manifest.json
   - robots.txt
   - asset-manifest.json
   - carpeta `static/` (completa)

⚠️ **Importante:** NO subas la carpeta `build` en sí, solo su **contenido**.

---

## 🐍 PASO 2: Subir Backend

### Opción A: Backend en el mismo servidor Ionos

1. Sube la carpeta `backend/` completa al servidor
2. Accede por SSH si Ionos lo permite:
   ```bash
   ssh usuario@194.164.164.78
   ```

3. Instala dependencias:
   ```bash
   cd backend
   pip3 install -r requirements.txt
   ```

4. Configura variables de entorno:
   ```bash
   export SECRET_KEY="clave-super-secreta-cambiala"
   export JWT_SECRET_KEY="jwt-super-secreta-cambiala"
   export FLASK_ENV=production
   ```

5. Inicia el backend:
   ```bash
   # Opción simple (para pruebas)
   python3 app.py
   
   # Opción producción (recomendado)
   gunicorn --bind 0.0.0.0:5000 --workers 4 wsgi:app
   ```

### Opción B: Backend en servicio externo (Recomendado)

Si Ionos no soporta Python o es complicado:

1. **Render.com** (Gratis):
   - Crea cuenta en https://render.com
   - New > Web Service
   - Conecta tu repositorio o sube código
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn wsgi:app`
   - Obtén la URL (ej: https://specialwash.onrender.com)

2. **Railway.app** (Gratis):
   - Crea cuenta en https://railway.app
   - New Project > Deploy from GitHub
   - Railway detecta Flask automáticamente

3. **PythonAnywhere** (Gratis con límites):
   - Crea cuenta en https://www.pythonanywhere.com
   - Web > Add a new web app > Flask
   - Sube código y configura

4. **Actualiza frontend:**
   ```
   # En .env.production
   REACT_APP_BACKEND_URL=https://tu-backend.onrender.com
   ```
   Luego rebuild: `npm run build`

---

## 🔧 PASO 3: Configuración de Puerto

### Si el puerto 5000 no funciona:

**Opción 1: Usar puerto 80 (HTTP estándar)**
```python
# backend/app.py
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=80)
```
Y actualiza frontend a:
```
REACT_APP_BACKEND_URL=http://194.164.164.78
```

**Opción 2: Proxy reverso con .htaccess**

Crea `.htaccess` en raíz con:
```apache
# Ruteo React
RewriteEngine On
RewriteBase /

# Proxy para API
RewriteRule ^api/(.*)$ http://localhost:5000/api/$1 [P,L]

# React Router
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

---

## ✅ PASO 4: Verificación

### 1. Verifica frontend:
   - Abre: `http://194.164.164.78`
   - Deberías ver la página de login/home

### 2. Verifica backend:
   - Abre: `http://194.164.164.78:5000/api/hello`
   - Deberías ver respuesta JSON

### 3. Prueba login:
   - Intenta hacer login
   - Abre consola del navegador (F12)
   - Verifica que no haya errores CORS

### 4. Prueba funcionalidades:
   - ✅ Login/Logout
   - ✅ Crear productos
   - ✅ Registrar entradas
   - ✅ Registrar salidas
   - ✅ Imprimir (Ctrl+P)

---

## 🔒 SEGURIDAD

⚠️ **HTTP con IP no es seguro para producción real**

Para mejorar seguridad:

1. **Obtén un dominio:**
   - Dominio gratis: Freenom, DuckDNS
   - Dominio pago: Ionos, Namecheap (~10€/año)

2. **Activa SSL/HTTPS:**
   - En Ionos: Panel > SSL > Let's Encrypt (gratis)
   - Cambia URLs a `https://`

3. **Configura CORS específico:**
   ```python
   # backend/app.py
   CORS(app, origins=["http://194.164.164.78"])
   ```

4. **Cambia claves secretas:**
   ```python
   # backend/config.py
   SECRET_KEY = "genera-clave-aleatoria-segura"
   JWT_SECRET_KEY = "genera-otra-clave-aleatoria-segura"
   ```

---

## 🆘 PROBLEMAS COMUNES

### Error: "Network Error" o "CORS"
**Solución:**
1. Verifica que backend esté corriendo
2. Prueba: `http://194.164.164.78:5000/api/hello`
3. Revisa consola del navegador (F12)

### Frontend carga pero botones no funcionan
**Solución:**
1. Limpia caché del navegador (Ctrl+Shift+R)
2. Verifica que `.env.production` tenga la IP correcta
3. Rebuild: `npm run build`

### Backend no arranca
**Solución:**
1. Verifica que Python 3.8+ esté instalado
2. Instala dependencias: `pip3 install -r requirements.txt`
3. Revisa logs de errores

### Firewall bloquea puerto 5000
**Solución:**
1. En panel Ionos: Firewall > Permitir puerto 5000
2. O usa puerto 80/443
3. O usa backend externo (Render, Railway)

---

## 📞 SIGUIENTE PASO

Una vez subidos los archivos:

1. **Prueba la aplicación en:** `http://194.164.164.78`
2. **Si hay errores:** Abre consola (F12) y comparte el mensaje
3. **Si funciona:** ¡Felicidades! 🎉

---

## 🔄 PARA ACTUALIZAR DESPUÉS

Cuando hagas cambios:

1. Edita código
2. Run: `rebuild.bat` (o `npm run build`)
3. Sube solo archivos modificados por FTP
4. Limpia caché del navegador

---

¿Necesitas ayuda con algún paso específico?
