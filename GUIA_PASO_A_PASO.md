# 📚 GUÍA PASO A PASO - Subir SpecialWash a Ionos
## Para principiantes - Sin experiencia previa necesaria

---

## 🎯 ¿Qué vamos a hacer?

Vamos a subir tu aplicación web SpecialWash a tu servidor de Ionos para que puedas acceder desde cualquier navegador usando la dirección IP: **194.164.164.78**

---

## 📋 PARTE 1: PREPARAR LOS ARCHIVOS (Ya está hecho ✅)

Ya tenemos:
- ✅ Frontend compilado en: `C:\Users\moniq\OneDrive\Escritorio\specialwash-clean\frontend\build\`
- ✅ Backend en: `C:\Users\moniq\OneDrive\Escritorio\specialwash-clean\backend\`
- ✅ IP configurada: 194.164.164.78

---

## 📋 PARTE 2: OBTENER DATOS DE ACCESO A IONOS

### Paso 1: Entrar al Panel de Ionos

1. Abre tu navegador (Chrome, Firefox, Edge)
2. Ve a: **https://www.ionos.es**
3. Haz clic en **"Iniciar sesión"** (arriba a la derecha)
4. Ingresa tu usuario y contraseña de Ionos
5. Entra al panel de control

### Paso 2: Encontrar tus datos FTP

1. En el menú de Ionos, busca:
   - "Hosting" o
   - "Alojamiento Web" o
   - "Mi Espacio Web"

2. Haz clic y busca una sección llamada:
   - "Acceso FTP" o
   - "Datos de acceso" o
   - "Configuración FTP"

3. **Anota estos datos** (los necesitaremos):
   
   ```
   Servidor/Host: ftp.tudominio.com (o puede ser una IP)
   Usuario FTP: __________________
   Contraseña FTP: __________________
   Puerto: 21 (normalmente)
   ```

💡 **Nota:** Si no encuentras estos datos, busca en Ionos un botón que diga "Crear acceso FTP" o contacta el soporte de Ionos.

---

## 📋 PARTE 3: DESCARGAR FILEZILLA (Cliente FTP)

FileZilla es un programa gratuito para subir archivos al servidor.

### Paso 1: Descargar FileZilla

1. Abre tu navegador
2. Ve a: **https://filezilla-project.org/**
3. Haz clic en **"Download FileZilla Client"**
4. Descarga la versión para Windows
5. Espera a que termine la descarga

### Paso 2: Instalar FileZilla

1. Busca el archivo descargado (normalmente en "Descargas")
2. Haz doble clic en él
3. Sigue el asistente de instalación:
   - Haz clic en "Next" (Siguiente)
   - Acepta los términos
   - Deja las opciones por defecto
   - Haz clic en "Install" (Instalar)
4. Cuando termine, haz clic en "Finish" (Finalizar)

---

## 📋 PARTE 4: CONECTAR A IONOS CON FILEZILLA

### Paso 1: Abrir FileZilla

1. Busca FileZilla en el menú de Windows
2. Ábrelo

### Paso 2: Conectar al servidor

En la parte superior de FileZilla verás estos campos:

```
Servidor: [________]  Usuario: [________]  Contraseña: [________]  Puerto: [__]
```

1. **Servidor:** Escribe tu servidor FTP de Ionos
   - Ejemplo: `ftp.tudominio.com` o `194.164.164.78`

2. **Usuario:** Escribe tu usuario FTP de Ionos
   - Ejemplo: `u12345678` o similar

3. **Contraseña:** Escribe tu contraseña FTP

4. **Puerto:** Escribe `21`

5. Haz clic en el botón **"Conexión rápida"** (al lado derecho)

### Paso 3: Verificar conexión

Si todo está bien:
- Verás una lista de carpetas en el panel derecho (servidor)
- El panel izquierdo muestra tu computadora
- Abajo verá mensajes de conexión exitosa

⚠️ **Si no conecta:**
- Verifica que los datos sean correctos
- Intenta sin `ftp.` al inicio (solo el dominio o IP)
- Verifica que tu internet funcione

---

## 📋 PARTE 5: SUBIR EL FRONTEND

### Paso 1: Navegar en tu computadora (panel izquierdo)

En el **panel IZQUIERDO** de FileZilla:

1. Navega a: `C:\Users\moniq\OneDrive\Escritorio\specialwash-clean\frontend\build\`

2. Deberías ver estos archivos:
   - index.html
   - .htaccess
   - favicon.ico
   - manifest.json
   - robots.txt
   - asset-manifest.json
   - Carpeta `static`

### Paso 2: Navegar en el servidor (panel derecho)

En el **panel DERECHO** de FileZilla (el servidor):

1. Busca la carpeta raíz web. Puede llamarse:
   - `/` (solo una barra)
   - `/httpdocs`
   - `/public_html`
   - `/html`
   - `/www`

2. Entra a esa carpeta (doble clic)

3. **IMPORTANTE:** Esta carpeta puede tener archivos. Si hay un `index.html` viejo, puedes borrarlo (clic derecho > Eliminar)

### Paso 3: Subir los archivos

1. En el panel IZQUIERDO (tu computadora), selecciona **TODOS** los archivos de la carpeta `build`:
   - Haz clic en el primer archivo
   - Mantén presionado `Ctrl + A` (seleccionar todo)

2. **Arrastra** los archivos del panel izquierdo al panel derecho
   - O haz clic derecho > "Subir"

3. Espera a que terminen de subir:
   - Verás el progreso abajo en FileZilla
   - Puede tardar 2-5 minutos dependiendo de tu internet

4. Cuando termine, verifica que en el panel derecho (servidor) estén todos los archivos

✅ **Frontend subido correctamente**

---

## 📋 PARTE 6: VERIFICAR QUE FUNCIONA

### Paso 1: Probar el frontend

1. Abre tu navegador
2. Escribe en la barra de direcciones: **http://194.164.164.78**
3. Presiona Enter

**¿Qué deberías ver?**
- La página de inicio de SpecialWash (Home)
- El navbar con el logo
- Botones de Login y Registro

✅ **Si ves la página:** ¡Excelente! El frontend funciona

⚠️ **Si ves un error o página en blanco:**
- Verifica que subiste los archivos a la carpeta correcta
- Limpia la caché del navegador (Ctrl + Shift + R)
- Revisa en FileZilla que el archivo `index.html` esté en la raíz

### Paso 2: Probar el login (sin backend aún)

1. Haz clic en "Login"
2. Intenta iniciar sesión
3. **Probablemente verás un error** - Esto es normal porque el backend no está activo todavía

---

## 📋 PARTE 7: SUBIR EL BACKEND

### Opción A: Backend en Ionos (Si Ionos soporta Python)

#### Paso 1: Crear carpeta para el backend

En FileZilla, en el panel derecho (servidor):

1. Clic derecho en un espacio vacío
2. Selecciona "Crear directorio"
3. Nómbralo: `backend`
4. Entra a esa carpeta (doble clic)

#### Paso 2: Subir archivos del backend

En el panel izquierdo (tu computadora):

1. Navega a: `C:\Users\moniq\OneDrive\Escritorio\specialwash-clean\backend\`

2. Selecciona **TODOS** los archivos y carpetas:
   - app.py
   - wsgi.py
   - config.py
   - admin.py
   - requirements.txt
   - Carpetas: api, models, app

3. Arrástralos al panel derecho (dentro de la carpeta backend del servidor)

4. Espera a que terminen de subir

#### Paso 3: Conectar por SSH (Necesario para instalar Python)

⚠️ **ALTO:** Esto requiere acceso SSH. Necesitas:

1. Verificar si Ionos permite SSH (ve al panel de Ionos)
2. Si permite SSH, necesitarás:
   - Un programa como **PuTTY** (para Windows)
   - Las credenciales SSH de Ionos

**Si Ionos NO soporta Python o es muy complicado, ve a la Opción B ↓**

---

### Opción B: Backend en Render.com (MÁS FÁCIL - RECOMENDADO)

Vamos a usar un servicio gratuito que hace todo el trabajo pesado por ti.

#### Paso 1: Crear cuenta en Render

1. Ve a: **https://render.com**
2. Haz clic en **"Get Started"** o **"Sign Up"**
3. Regístrate con tu email (o usa GitHub/Google)
4. Confirma tu email

#### Paso 2: Crear nuevo servicio

1. Una vez dentro, haz clic en **"New +"** (arriba a la derecha)
2. Selecciona **"Web Service"**

#### Paso 3: Conectar tu código

Tienes dos opciones:

**Opción 3A: Subir desde GitHub (si tienes cuenta)**
1. Conecta tu cuenta de GitHub
2. Sube tu carpeta `backend` a un repositorio
3. Selecciona ese repositorio

**Opción 3B: Subir manualmente**
1. Selecciona "Public Git repository"
2. O sigue las instrucciones para subir código

💡 **Alternativa más rápida:** Puedo ayudarte con esto en tiempo real. Dime cuando llegues aquí.

#### Paso 4: Configurar el servicio

Render te pedirá:

1. **Name:** `specialwash-backend` (o el que quieras)

2. **Region:** Selecciona el más cercano (Europe - Frankfurt)

3. **Branch:** `main` o `master`

4. **Build Command:**
   ```
   pip install -r requirements.txt
   ```

5. **Start Command:**
   ```
   gunicorn wsgi:app
   ```

6. **Environment:** Selecciona `Python 3`

7. Haz clic en **"Create Web Service"**

#### Paso 5: Esperar el deployment

1. Render instalará las dependencias automáticamente
2. Esto puede tardar 2-5 minutos
3. Verás los logs en tiempo real

#### Paso 6: Obtener la URL del backend

Cuando termine:

1. Render te dará una URL, ejemplo:
   ```
   https://specialwash-backend.onrender.com
   ```

2. **COPIA ESA URL** - la necesitaremos

---

## 📋 PARTE 8: CONECTAR FRONTEND CON BACKEND

Si usaste Render.com para el backend, necesitas actualizar el frontend:

### Paso 1: Editar archivo de configuración

1. En tu computadora, abre:
   ```
   C:\Users\moniq\OneDrive\Escritorio\specialwash-clean\frontend\.env.production
   ```

2. Reemplaza la línea con tu nueva URL de Render:
   ```
   REACT_APP_BACKEND_URL=https://specialwash-backend.onrender.com
   ```
   (Usa TU URL real de Render)

### Paso 2: Reconstruir el frontend

1. Abre PowerShell o CMD
2. Escribe:
   ```powershell
   cd C:\Users\moniq\OneDrive\Escritorio\specialwash-clean
   .\rebuild.bat
   ```

3. O manualmente:
   ```powershell
   cd C:\Users\moniq\OneDrive\Escritorio\specialwash-clean\frontend
   npm run build
   ```

4. Espera a que termine

### Paso 3: Subir de nuevo a Ionos

1. Abre FileZilla
2. Conecta a Ionos
3. En el panel izquierdo, ve a:
   ```
   C:\Users\moniq\OneDrive\Escritorio\specialwash-clean\frontend\build\
   ```

4. Selecciona TODOS los archivos
5. Arrástralos al panel derecho (sobreescribir los anteriores)
6. Confirma "Sobreescribir" cuando pregunte

---

## 📋 PARTE 9: PROBAR TODO

### Paso 1: Limpiar caché del navegador

1. Abre tu navegador
2. Presiona: `Ctrl + Shift + Delete`
3. Selecciona "Todo" o "Caché"
4. Haz clic en "Borrar datos"

### Paso 2: Probar la aplicación

1. Ve a: **http://194.164.164.78**
2. Presiona `Ctrl + Shift + R` (recarga forzada)

### Paso 3: Probar login

1. Haz clic en "Login"
2. Ingresa:
   ```
   Email: admin@specialwash.com
   Password: admin123
   ```
3. Haz clic en "Iniciar sesión"

✅ **Si entras:** ¡PERFECTO! Todo funciona

⚠️ **Si da error:**
- Abre la consola del navegador (F12)
- Busca errores en rojo
- Toma captura de pantalla
- Te ayudaré a resolverlo

### Paso 4: Probar funcionalidades

Una vez dentro:
- ✅ Crea un producto
- ✅ Registra una entrada
- ✅ Registra una salida
- ✅ Prueba imprimir (Ctrl + P)

---

## 🎉 ¡FELICIDADES!

Si todo funciona, tu aplicación está en línea en:
**http://194.164.164.78**

---

## 📞 ¿NECESITAS AYUDA?

### Dónde estás atorado:

**□ PARTE 1-2:** No encuentro los datos FTP de Ionos
- Solución: Busca en Ionos "Acceso FTP" o contacta su soporte

**□ PARTE 3-4:** No puedo instalar/conectar FileZilla
- Solución: Revisa que los datos FTP sean correctos

**□ PARTE 5-6:** Subí archivos pero no se ve la página
- Solución: Verifica que estén en la carpeta raíz correcta

**□ PARTE 7:** No sé cómo subir el backend
- Solución: Usa Render.com (Opción B) - es más fácil

**□ PARTE 8-9:** El frontend carga pero el login no funciona
- Solución: Verifica que el backend esté corriendo y la URL sea correcta

---

## 🔧 COMANDOS ÚTILES DE EMERGENCIA

Si algo sale mal:

### Reconstruir frontend:
```powershell
cd C:\Users\moniq\OneDrive\Escritorio\specialwash-clean\frontend
npm run build
```

### Ver errores del navegador:
1. Presiona `F12`
2. Ve a la pestaña "Console"
3. Busca líneas en rojo

### Limpiar caché:
`Ctrl + Shift + R` en el navegador

---

## 📝 LISTA DE VERIFICACIÓN FINAL

Antes de darte por vencido, verifica:

- [ ] FileZilla conectó exitosamente a Ionos
- [ ] Archivos de `build/` subidos a la carpeta raíz correcta
- [ ] Archivo `index.html` está en la raíz del servidor
- [ ] Al abrir http://194.164.164.78 veo la página (aunque sin funcionar)
- [ ] Backend está corriendo (en Ionos o Render)
- [ ] `.env.production` tiene la URL correcta del backend
- [ ] Frontend reconstruido después de cambiar `.env.production`
- [ ] Archivos actualizados subidos de nuevo a Ionos
- [ ] Caché del navegador limpiada

---

**¿En qué paso específico estás? Dime y te ayudo detalladamente.**
