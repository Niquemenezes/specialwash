# SpecialWash Deploy Guide (IONOS)

Esta guia define el deploy real de produccion en tu VPS de IONOS.

## Alcance

- Servidor: `root@194.164.164.78`
- Codigo remoto: `/root/specialwash`
- Backend: Flask en `:5000`
- Frontend: build estatico de React servido por Nginx

## Archivos Clave

- Script de deploy: `deploy.sh`
- Config Nginx: `nginx-default.conf`
- Guia de cambios de BD: `GUIA_ACTUALIZAR_BD.md`

## Requisitos Locales

En tu entorno local (desde donde ejecutas deploy):

```bash
which ssh
which rsync
which npm
```

Si falta `rsync`:

```bash
apt-get update && apt-get install -y rsync
```

## Uso del Script

Desde la raiz del repositorio:

```bash
./deploy.sh backend
./deploy.sh frontend
./deploy.sh all
```

Puedes sobreescribir destino sin editar script:

```bash
SERVER="root@194.164.164.78" REMOTE_PATH="/root/specialwash" ./deploy.sh all
```

## Que Hace Cada Modo

### `backend`

- Sincroniza `backend/` con `rsync`.
- Excluye artefactos locales: `venv`, `__pycache__`, `app.log`, `.env`, DB local.
- Reinicia backend:
   - Primero intenta `systemd` si existe `specialwash-backend.service`.
   - Si no existe, usa fallback con `nohup ... python app.py`.

### `frontend`

- Ejecuta `npm run build` en `frontend/`.
- Sincroniza `frontend/build/` al servidor.
- Ajusta permisos de lectura/ejecucion.
- Valida y recarga Nginx (`nginx -t && nginx -s reload`).

### `all`

- Ejecuta `backend` y `frontend` en ese orden.

## Estructura Esperada en IONOS

```text
/root/specialwash/
   backend/
      app.py
      api/
      models/
      instance/
         specialwash.db
      venv/
   frontend/
      build/
         index.html
         static/
```

## Politica de Base de Datos

- La BD productiva no se pisa en deploy de codigo.
- Ubicacion esperada: `/root/specialwash/backend/instance/specialwash.db`.
- Si hay cambios de esquema, seguir `GUIA_ACTUALIZAR_BD.md`.

## Verificaciones Rapidas Post-Deploy

```bash
ssh root@194.164.164.78 "lsof -i tcp:5000 | cat"
ssh root@194.164.164.78 "tail -50 /root/specialwash/backend/app.log"
ssh root@194.164.164.78 "nginx -t"
```

Luego validar en navegador:

- `http://194.164.164.78`
- Hard refresh: `Ctrl + Shift + R`

## Troubleshooting

### Backend no responde

```bash
ssh root@194.164.164.78 "tail -100 /root/specialwash/backend/app.log"
ssh root@194.164.164.78 "fuser -k 5000/tcp || true"
ssh root@194.164.164.78 "cd /root/specialwash/backend && nohup /root/specialwash/backend/venv/bin/python app.py > app.log 2>&1 < /dev/null &"
```

### Nginx no recarga

```bash
ssh root@194.164.164.78 "nginx -t"
ssh root@194.164.164.78 "tail -50 /var/log/nginx/error.log"
```

### Error SSH/rsync

```bash
ssh-keygen -t rsa
ssh-copy-id root@194.164.164.78
```

## Recomendacion de Produccion

Si aun no lo tienes, conviene migrar backend a un servicio `systemd` dedicado
(`specialwash-backend.service`) para reinicios mas fiables tras reboot.
