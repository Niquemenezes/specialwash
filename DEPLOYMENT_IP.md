# 🚀 Deployment Rápido en Ionos con IP

## 📋 Pasos para obtener tu IP de Ionos

1. **Accede al panel de Ionos:**
   - https://www.ionos.es
   - Inicia sesión

2. **Encuentra tu IP:**
   - Ve a "Hosting" o "Servidor"
   - Busca la sección "Dirección IP"
   - Anota la IP (ejemplo: 123.45.67.89)

## 🔧 Configuración con IP

### 1. Actualiza las variables de entorno

Edita `frontend/.env.production` y cambia la línea:
```
REACT_APP_BACKEND_URL=http://TU_IP_AQUI:5000
```

Por ejemplo:
```
REACT_APP_BACKEND_URL=http://123.45.67.89:5000
```

### 2. Reconstruye el frontend

```bash
cd frontend
npm run build
```

### 3. Configuración del Backend en Ionos

Edita `backend/config.py` o crea variables de entorno en el servidor:

```python
# Permitir acceso desde cualquier IP
CORS(app, origins=["*"])  # En producción, especifica tu IP frontend
```

O mejor, especifica tu IP local/cliente:
```python
CORS(app, origins=[
    "http://123.45.67.89",           # IP del servidor
    "http://tu-ip-local",            # Tu IP local si accedes desde casa
    "http://localhost:3000"          # Para desarrollo
])
```

### 4. Puerto del Backend

El backend Flask debe correr en el puerto 5000 (o el que especifiques).

En el servidor Ionos, ejecuta:
```bash
cd backend
python app.py
```

O usa gunicorn para producción:
```bash
gunicorn --bind 0.0.0.0:5000 wsgi:app
```

## 📦 Subir archivos a Ionos

### Frontend:
1. Conecta por FTP/SFTP
2. Sube el contenido de `frontend/build/` a la carpeta web (generalmente `/`)

### Backend:
1. Sube la carpeta `backend/` completa
2. Instala dependencias:
   ```bash
   pip install -r requirements.txt
   ```
3. Inicia el servidor Flask

## ⚙️ Configuración de Puertos en Ionos

Si Ionos no permite el puerto 5000, tienes opciones:

### Opción 1: Usar el puerto 80 (HTTP)
```python
# backend/app.py
if __name__ == "__main__":
    app.run(host='0.0.0.0', port=80)
```

Y en `.env.production`:
```
REACT_APP_BACKEND_URL=http://123.45.67.89
```

### Opción 2: Subdirectorio
Configura el backend en un subdirectorio tipo `/api`:
```
REACT_APP_BACKEND_URL=http://123.45.67.89/api
```

### Opción 3: Backend separado
- Usa un servicio gratuito como Render, Railway o PythonAnywhere para el backend
- Obtén su URL (ej: https://tu-app.onrender.com)
- Actualiza `.env.production` con esa URL

## 🔒 Seguridad con IP

⚠️ **Importante:** Usar HTTP con IP no es seguro para producción. Considera:

1. **Solo para pruebas:** Úsalo temporalmente mientras configuras
2. **Sin datos sensibles:** No uses en producción con datos reales
3. **Firewall:** Configura reglas en Ionos para limitar acceso
4. **Migrar a HTTPS:** Obtén un dominio gratuito (ej: .freenom) y SSL gratuito (Let's Encrypt)

## 🧪 Probar localmente con IP

Antes de subir, prueba localmente:

1. Obtén tu IP local:
   ```bash
   # Windows
   ipconfig
   # Busca "Dirección IPv4"
   ```

2. Edita `.env` (no .env.production):
   ```
   REACT_APP_BACKEND_URL=http://192.168.1.X:5000
   ```

3. Inicia backend:
   ```bash
   cd backend
   python app.py
   ```

4. Inicia frontend:
   ```bash
   cd frontend
   npm start
   ```

5. Accede desde otro dispositivo en tu red: `http://192.168.1.X:3000`

## 📱 Acceso desde móvil

Si quieres probar desde tu móvil en la misma red:

1. Asegúrate de que backend y frontend usen tu IP local
2. Desactiva temporalmente firewall de Windows
3. Accede desde móvil: `http://TU_IP_LOCAL:3000`

## ✅ Checklist de Deployment con IP

- [ ] IP de Ionos obtenida
- [ ] `.env.production` actualizado con IP
- [ ] Build regenerado: `npm run build`
- [ ] CORS configurado en backend
- [ ] Archivos frontend subidos por FTP
- [ ] Backend subido y dependencias instaladas
- [ ] Backend corriendo en puerto correcto
- [ ] Probado acceso: `http://TU_IP:PUERTO`
- [ ] Login funciona
- [ ] Todas las funcionalidades probadas

## 🆘 Problemas comunes

**Error: CORS policy**
- Verifica que el backend tenga CORS configurado
- Añade tu IP al array de origins permitidos

**Error: Connection refused**
- Verifica que el backend esté corriendo
- Confirma el puerto correcto
- Revisa firewall del servidor

**Frontend carga pero API no responde**
- Verifica `REACT_APP_BACKEND_URL` en el build
- Abre consola del navegador (F12) y mira errores
- Verifica que backend esté accesible: `http://IP:5000/api/hello`

## 🔄 Actualizar después de cambios

Cada vez que hagas cambios:

```bash
# 1. Actualizar .env.production si es necesario
# 2. Rebuild
cd frontend
npm run build

# 3. Subir solo archivos nuevos por FTP
# O todo el contenido de build/ si prefieres
```

## 💡 Tip: Script para rebuild rápido

Crea `rebuild.bat` en la carpeta raíz:
```batch
@echo off
cd frontend
call npm run build
echo.
echo ✅ Build completado. Sube el contenido de frontend/build/ a Ionos.
pause
```

Ejecuta haciendo doble clic para rebuilds rápidos.
