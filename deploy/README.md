# 🚀 SpecialWash Deploy - IONOS VPS

Todos los archivos necesarios para deploying SpecialWash en IONOS VPS Linux.

---

## 📋 Archivos Incluidos

| Archivo | Propósito |
|---------|----------|
| `DEPLOY_IONOS.md` | Guía completa paso a paso (en raíz del proyecto) |
| `env.example` | Template de variables de entorno |
| `nginx-specialwash.conf` | Configuración de Nginx |
| `specialwash-backend.service` | Servicio Systemd para Gunicorn |
| `deploy.sh` | Script de deploy automático |
| `generate-secrets.sh` | Generador de claves secretas |
| `README.md` | Este archivo |

---

## 🚀 Quick Start (30 min)

### 1️⃣ En tu PC Local

```bash
# Compilar frontend
cd frontend
npm run build

# Generar claves secretas
bash ../deploy/generate-secrets.sh
```

### 2️⃣ En el Servidor IONOS (SSH)

```bash
# Conectar
ssh root@YOUR_SERVER_IP
# Usa clave SSH o solicita la credencial por canal seguro

# Clonar o descargar código
cd /var/www/specialwash/app
git clone <tu-repo> .

# Crear .env con valores de step 1
nano backend/.env
# Pegar template: deploy/env.example

# Ejecutar deploy automático
bash deploy/deploy.sh
```

### 3️⃣ SSL Certificate

```bash
# En el servidor
apt install -y certbot python3-certbot-nginx
certbot certonly --standalone \
  -d specialwash.studio \
  -d www.specialwash.studio \
  -m tu_email@example.com \
  --agree-tos --non-interactive
```

✅ **¡Listo!** Abre: https://specialwash.studio

---

## 📝 Structure en Servidor

```
/var/www/specialwash/
├── app/                     # Código (backend + frontend)
│   ├── backend/
│   │   ├── venv/           # Virtual env
│   │   ├── .env            # Variables (CREAR)
│   │   └── ...
│   └── frontend/
│       └── build/          # Frontend compilado
├── data/                   # Base de datos SQLite
│   └── specialwash.db      # BD (sin tocar la actual)
├── logs/                   # Logs nginx + gunicorn
│   ├── gunicorn-access.log
│   ├── gunicorn-error.log
│   ├── nginx-access.log
│   └── nginx-error.log
└── backup/                 # Backups automáticos
    └── specialwash_*.db.bak
```

---

## 🛠️ Comandos Útiles

```bash
# Status servicios
systemctl status specialwash-backend.service
systemctl status nginx

# Restart
systemctl restart specialwash-backend.service
systemctl restart nginx

# Logs en vivo
journalctl -u specialwash-backend.service -f
tail -100 /var/www/specialwash/logs/nginx-error.log

# Verificar conectividad
curl http://127.0.0.1:8000/api/salud
curl https://specialwash.studio

# Entrar en venv
cd /var/www/specialwash/app/backend
source venv/bin/activate
```

---

## 🔐 Seguridad

- ✅ HTTPS obligatorio (Let's Encrypt)
- ✅ CORS limitado a tu dominio
- ✅ Archivos sensibles (.env, .git) bloqueados
- ✅ `/admin/` restringido a localhost / túnel SSH
- ✅ Headers de seguridad configurados
- ✅ Gunicorn con timeout 120s
- ✅ Nginx con gzip y caché de assets

### Acceso temporal seguro al panel admin

```bash
# Crear túnel SSH desde tu equipo
ssh -L 5050:127.0.0.1:443 root@YOUR_SERVER_IP

# Luego abrir en tu navegador
https://127.0.0.1:5050/admin/
```

> Mantén `ENABLE_ADMIN=0` por defecto y actívalo solo temporalmente si de verdad hace falta.

---

## 📊 Monitoreo

### Verificar backend
```bash
curl -I https://specialwash.studio/api/salud
```

### Verificar frontend
```bash
curl -I https://specialwash.studio
```

### Logs
```bash
# Backend
journalctl -u specialwash-backend.service -n 50

# Nginx error
tail -20 /var/www/specialwash/logs/nginx-error.log

# Nginx access
tail -20 /var/www/specialwash/logs/nginx-access.log
```

---

## 🔧 Troubleshooting

| Síntoma | Solución |
|--------|----------|
| **502 Bad Gateway** | `systemctl restart specialwash-backend.service` |
| **CORS error** | Verificar `FRONTEND_URLS` en .env |
| **SSL error** | `certbot renew --force-renewal` |
| **BD no se crea** | Verificar permisos en `/var/www/specialwash/data` |
| **Nginx no arranca** | `nginx -t` para validar config |

---

## 📈 Performance

- Frontend: Caché de 30 días (CSS/JS)
- API: Gzip compression habilitado
- BD: SQLite (suficiente para pequeño/mediano) 
- Workers Gunicorn: 4 (VPS 2-4Core recomendado)

---

## 🔄 Actualizaciones Futuras

```bash
# Sin tocar BD
cd /var/www/specialwash/app
git pull
npm run build --prefix frontend
systemctl restart specialwash-backend.service
```

---

## ❓ FAQ

**¿Mi BD actual se usa o se crea una nueva?**  
→ Por defecto el deploy **no bootstrappea** la BD en producción (`ENABLE_DB_BOOTSTRAP=0`). Solo se inicializa una nueva si activas ese flag de forma temporal y controlada.

**¿Cómo hago backup de la BD en servidor?**  
→ Manual: `cp /var/www/specialwash/data/specialwash.db ./backup-$(date +%s).db`  
→ Automático: Descomentar cron en DEPLOY_IONOS.md paso 12

**¿Se pierde información entre redeploys?**  
→ No, la BD persiste en `/var/www/specialwash/data/`

**¿Necesito ftp o sftp?**  
→ No, todo es SSH + Git (más seguro)

---

**¡Éxito con tu deploy! 🚀**
