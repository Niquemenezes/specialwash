# 🚀 SW Studio Deploy - VPS (94.143.143.148)

Todos los archivos necesarios para desplegar SW Studio en su propio servidor,
independiente del de specialwash.studio.

---

## 📋 Archivos Incluidos

| Archivo | Propósito |
|---------|----------|
| `env.example` | Template de variables de entorno |
| `nginx-swstudio.conf` | Configuración de Nginx |
| `swstudio-backend.service` | Servicio Systemd para Gunicorn |
| `deploy.sh` | Script de deploy automático (recomendado) |
| `deploy-ionos.sh` | Script alternativo, requiere SECRET_KEY/JWT_SECRET_KEY exportadas |
| `update_ionos.sh` | Actualización rápida cuando ya está desplegado y usas git |
| `monitor.sh` | Chequeo de salud del servidor |
| `generate-secrets.sh` | Generador de claves secretas |
| `backup_db.sh` / `check_backup_fresh.sh` | Backups automáticos diarios |
| `README.md` | Este archivo |

---

## ⚠️ Primer paso: llevar el código al servidor

Este proyecto todavía no tiene un repositorio git remoto configurado, así que
`git clone`/`git pull` no van a funcionar hasta que crees uno (GitHub, GitLab, etc.)
Mientras tanto, la forma más simple de subir el código la primera vez es con `scp`
desde tu PC (ajusta la ruta de origen a donde tengas el proyecto):

```bash
# Desde tu PC (PowerShell o Git Bash), sube el proyecto entero
scp -r C:/Users/ALEJANDRO FERRER/Desktop/swstudio root@94.143.143.148:/root/swstudio
```

Luego en el servidor, copia backend y frontend build a las rutas que espera el deploy:

```bash
mkdir -p /var/www/swstudio/app
cp -r /root/swstudio/backend /var/www/swstudio/app/backend
```

---

## 🚀 Quick Start

### 1️⃣ En tu PC Local

```bash
# Compilar frontend
cd frontend
npm run build
```

Luego sube la carpeta `frontend/build` a `/var/www/swstudio-frontend` en el servidor
(por ejemplo con `scp -r frontend/build root@94.143.143.148:/var/www/swstudio-frontend`).

### 2️⃣ En el Servidor (SSH)

```bash
ssh root@94.143.143.148

# Generar claves secretas
bash /root/swstudio/deploy/generate-secrets.sh

# Crear .env a partir del template
cp /root/swstudio/deploy/env.example /var/www/swstudio/app/backend/.env
nano /var/www/swstudio/app/backend/.env
# Pega ahí las claves generadas arriba

# Ejecutar deploy automático
cd /root/swstudio
bash deploy/deploy.sh
```

### 3️⃣ SSL Certificate

```bash
# En el servidor
apt install -y certbot python3-certbot-nginx
certbot certonly --standalone \
  -d sw-studio.es \
  -d www.sw-studio.es \
  -m tu_email@example.com \
  --agree-tos --non-interactive
```

✅ **¡Listo!** Abre: https://sw-studio.es

**No olvides el DNS**: antes de que esto funcione, el dominio `sw-studio.es` (registro A,
y opcionalmente uno para `www`) tiene que apuntar a `94.143.143.148` en el panel de tu
registrador de dominios.

---

## 📝 Structure en Servidor

```
/var/www/swstudio/
├── app/                     # Código (backend)
│   └── backend/
│       ├── venv/            # Virtual env
│       ├── .env             # Variables (CREAR)
│       └── ...
├── data/                    # Base de datos SQLite
│   └── swstudio.db          # BD nueva, propia de SW Studio
├── logs/                    # Logs nginx + gunicorn
└── backup/                  # Backups automáticos

/var/www/swstudio-frontend/  # Frontend compilado (npm run build)
```

---

## 🛠️ Comandos Útiles

```bash
# Status servicios
systemctl status swstudio-backend.service
systemctl status nginx

# Restart
systemctl restart swstudio-backend.service
systemctl restart nginx

# Logs en vivo
journalctl -u swstudio-backend.service -f
tail -100 /var/www/swstudio/logs/nginx-error.log

# Verificar conectividad
curl http://127.0.0.1:8000/api/salud
curl https://sw-studio.es

# Entrar en venv
cd /var/www/swstudio/app/backend
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
ssh -L 5050:127.0.0.1:443 root@94.143.143.148

# Luego abrir en tu navegador
https://127.0.0.1:5050/admin/
```

> Mantén `ENABLE_ADMIN=0` por defecto y actívalo solo temporalmente si de verdad hace falta.

---

## 📊 Monitoreo

```bash
bash deploy/monitor.sh
```

---

## 🔧 Troubleshooting

| Síntoma | Solución |
|--------|----------|
| **502 Bad Gateway** | `systemctl restart swstudio-backend.service` |
| **CORS error** | Verificar `FRONTEND_URLS` en `.env` (debe incluir `https://sw-studio.es`) |
| **SSL error** | `certbot renew --force-renewal` |
| **BD no se crea** | Verificar permisos en `/var/www/swstudio/data` |
| **Nginx no arranca** | `nginx -t` para validar config |
| **Dominio no resuelve** | Revisar el registro DNS tipo A de `sw-studio.es` apuntando a `94.143.143.148` |

---

## 🔄 Backups automáticos

Instalación en servidor:

```bash
sudo cp /root/swstudio/deploy/swstudio-backup.service /etc/systemd/system/
sudo cp /root/swstudio/deploy/swstudio-backup.timer /etc/systemd/system/
sudo cp /root/swstudio/deploy/swstudio-backup-check.service /etc/systemd/system/
sudo cp /root/swstudio/deploy/swstudio-backup-check.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now swstudio-backup.timer
sudo systemctl enable --now swstudio-backup-check.timer
sudo systemctl start swstudio-backup.service
```

Comandos útiles:

```bash
systemctl list-timers --all | grep swstudio-backup
cat /root/swstudio/backend/instance/backups/auto/LAST_BACKUP_STATUS.txt
ls -lah /root/swstudio/backend/instance/backups/auto
```

---

**¡Éxito con tu deploy! 🚀**
