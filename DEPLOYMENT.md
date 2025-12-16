# Guía de Deployment en Ionos

## 📦 Preparación del Build

### 1. Configurar variables de entorno

**Opción A: Usando IP (sin dominio):**

Edita `frontend/.env.production`:
```
REACT_APP_BACKEND_URL=http://123.45.67.89:5000
```
Reemplaza `123.45.67.89` con tu IP real de Ionos.

**Opción B: Con dominio:**
```
REACT_APP_BACKEND_URL=https://tudominio.com
```

### 2. Build del frontend

```bash
cd frontend
npm install
npm run build
```

Esto genera la carpeta `frontend/build/` con los archivos estáticos optimizados.

## 🚀 Deployment en Ionos

### Opción A: Frontend Estático (Recomendado)

1. **Subir archivos al servidor:**
   - Conecta por FTP/SFTP a tu espacio web en Ionos
   - Sube todos los archivos de `frontend/build/` a la raíz de tu dominio o subcarpeta

2. **Configurar .htaccess (para React Router):**
   
Crea un archivo `.htaccess` en la raíz con:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

### Opción B: Backend + Frontend

#### Backend Flask:

1. **Subir archivos Python:**
   - Sube toda la carpeta `backend/` al servidor
   - Asegúrate de que Ionos tenga Python 3.8+ habilitado

2. **Instalar dependencias:**
```bash
pip install -r backend/requirements.txt
```

3. **Configurar variables de entorno en servidor:**
```bash
export SECRET_KEY=tu-clave-secreta-produccion
export JWT_SECRET_KEY=tu-jwt-secreta-produccion
export FLASK_ENV=production
```

4. **Configurar WSGI:**

Ionos usa WSGI. Edita `backend/wsgi.py`:
```python
from app import app

if __name__ == "__main__":
    app.run()
```

5. **Configurar dominio en Ionos:**
   - Panel de Ionos > Dominios > Configuración
   - Apunta el dominio a la carpeta del frontend
   - Configura subdirectorio `/api` para el backend si es necesario

#### Frontend:

1. Sube archivos de `frontend/build/` 
2. Asegúrate de que `.env.production` tenga la URL correcta del backend

## 🔧 Configuraciones Adicionales

### CORS en Backend

Verifica que `backend/app.py` permita el dominio de producción:
```python
from flask_cors import CORS
CORS(app, origins=["https://tudominio.com"])
```

### Base de datos

- SQLite está incluido, pero para producción considera PostgreSQL
- Ionos ofrece bases de datos MySQL/PostgreSQL según el plan

### SSL/HTTPS

- Ionos incluye certificados SSL gratuitos
- Activa SSL desde el panel de control
- Asegúrate de usar HTTPS en todas las URLs

## ✅ Verificación Post-Deployment

1. Visita tu dominio: `https://tudominio.com`
2. Verifica que el login funcione
3. Prueba crear productos, entradas, salidas
4. Verifica las impresiones (Ctrl+P)
5. Revisa la consola del navegador para errores

## 📝 Checklist

- [ ] Build del frontend generado
- [ ] Variables de entorno configuradas
- [ ] Archivos subidos por FTP
- [ ] .htaccess configurado
- [ ] Backend funcionando (si aplica)
- [ ] SSL activo
- [ ] CORS configurado
- [ ] Base de datos migrada
- [ ] Login funcionando
- [ ] Funcionalidades testeadas

## 🆘 Solución de Problemas

**Error 404 en rutas:**
- Verifica que `.htaccess` esté presente y configurado

**CORS errors:**
- Actualiza CORS en backend con el dominio real
- Verifica que REACT_APP_BACKEND_URL sea correcto

**CSS no carga:**
- Verifica que la ruta base en `package.json` sea correcta
- Si usas subcarpeta, añade `"homepage": "/subcarpeta"` en package.json

## 📞 Soporte

Para ayuda con Ionos:
- Panel de control: https://www.ionos.es
- Documentación: https://www.ionos.es/ayuda
