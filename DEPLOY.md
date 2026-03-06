# 🚀 Sistema de Deploy Automático - Specialwash

## Descripción de la Solución

El sistema de frontend ha sido **unificado y simplificado**:

- **Antes**: Nginx servía `/var/www/specialwash/public_html/` (frontend antiguo, desactualizado)
- **Ahora**: Nginx apunta con symlink a `/root/specialwash/frontend/build/` (siempre el frontend actual)

### Ventajas

✅ Una sola fuente de verdad para el frontend  
✅ Actualizaciones automáticas cuando haces deploy  
✅ No hay duplicados ni conflictos  
✅ Sistema limpio y mantenible  

---

## 📋 Cómo Usar el Script de Deploy

### Instalación de Dependencias

Antes de usar el script, asegúrate de tener `rsync` instalado:

```bash
apt-get update && apt-get install -y rsync
```

### Comandos de Deploy

Desde la raíz del proyecto (`/workspaces/specialwash`):

#### 1️⃣ Desplegar solo Backend (código Python)

```bash
./deploy.sh backend
```

✅ Sincroniza cambios en `backend/`  
✅ Reinicia el servidor Flask  
✅ Preserva la base de datos

#### 2️⃣ Desplegar solo Frontend (React)

```bash
./deploy.sh frontend
```

✅ Construye el frontend con `npm run build`  
✅ Sincroniza al servidor  
✅ Recarga Nginx automáticamente  

#### 3️⃣ Desplegar Todo (Backend + Frontend)

```bash
./deploy.sh all
```

✅ Ejecuta ambos procesos  

---

## 🔄 Flujo de Actualización Típico

```
1. Haces cambios en local (backend/ y/o src/)
2. Commits a GitHub → git push
3. Ejecutas el deploy:
   ./deploy.sh all
4. El script:
   - Sincroniza backend/ a /root/specialwash/backend/
   - Construye frontend (npm run build)
   - Syncroniza build/ a /root/specialwash/frontend/build/
   - Reinicia Flask y Nginx
5. Los cambios están en vivo en http://194.164.164.78
```

---

## 🛠️ Estructura en Producción

```
/root/specialwash/
├── backend/               ← Código Python
│   ├── api/
│   ├── models/
│   ├── instance/
│   │   └── specialwash.db  ⚠️ NO SE TOCA EN DEPLOY (preserve)
│   ├── venv/
│   └── app.py
│
└── frontend/
    └── build/            ← Frontend compilado
        ├── index.html
        ├── static/
        └── ...

/var/www/specialwash/
└── public_html → /root/specialwash/frontend/build/ (symlink)
```

---

## ⚠️ Notas Importantes

### La Base de Datos

- **NUNCA se toca en deploy**
- Se preserva en `/root/specialwash/backend/instance/specialwash.db`
- Para actualizarla, usa [GUIA_ACTUALIZAR_BD.md](./GUIA_ACTUALIZAR_BD.md)

### Caché del Navegador

Si ves cambios del frontend pero el navegador muestra código antiguo:

```
Presiona: Ctrl + Shift + R (hard refresh)
O: Ctrl + F5 (en algunos navegadores)
```

### Logs para Debugging

**Backend Flask**:
```bash
ssh root@194.164.164.78 "tail -50 /root/specialwash/backend/app.log"
```

**Nginx**:
```bash
ssh root@194.164.164.78 "tail -30 /var/log/nginx/error.log"
```

---

## 📝 Ejemplo: Actualizar Cálculos de Entrada

```bash
# 1. Haces cambios en backend/api/routes.py
nano backend/api/routes.py

# 2. Pruebas localmente
cd backend && python app.py

# 3. Una vez funciona, haces commit
git add .
git commit -m "Fix: Corregir cálculos de entrada"
git push

# 4. Despliegas a producción
./deploy.sh backend

# 5. Verifica en http://194.164.164.78
```

---

## 🆘 Troubleshooting

### El frontend no actualiza

```bash
# Hard refresh del navegador
Ctrl + Shift + R

# Verifica que el symlink existe
ssh root@194.164.164.78 "ls -lh /var/www/specialwash/public_html"
```

### El backend no reinicia

```bash
# Ver logs
ssh root@194.164.164.78 "tail -50 /root/specialwash/backend/app.log"

# Matar procesos y reiniciar manualmente
ssh root@194.164.164.78 "fuser -k 5000/tcp && cd /root/specialwash/backend && /root/specialwash/backend/venv/bin/python app.py"
```

### Error de permisos en rsync

```bash
# Verifica que tienes acceso SSH configurado sin contraseña
ssh-keygen -t rsa
ssh-copy-id root@194.164.164.78
```

---

## 📚 Documentación Relacionada

- [GUIA_ACTUALIZAR_BD.md](./GUIA_ACTUALIZAR_BD.md) - Cómo sincronizar la base de datos
- [README.md](./README.md) - Documentación general del proyecto
