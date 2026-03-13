# SpecialWash Deploy Guide (IONOS)

Esta guia define el deploy real de produccion en tu VPS de IONOS.

## Alcance

- Servidor: `root@specialwash.studio`
- Codigo remoto: `/root/specialwash`
- Backend: Flask en `:5000`
- Frontend: build estatico de React servido por Nginx desde `/var/www/specialwash/public_html`

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
SERVER="root@specialwash.studio" REMOTE_PATH="/root/specialwash" ./deploy.sh all
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
- Sincroniza `frontend/build/` a `/var/www/specialwash/public_html`.
- Copia `nginx-default.conf` a `/etc/nginx/sites-available/default`.
- Ajusta permisos para que Nginx (`www-data`) pueda leer los archivos.
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

/var/www/specialwash/public_html/
   index.html
   static/
```

## Politica de Base de Datos

- La BD productiva no se pisa en deploy de codigo.
- Ubicacion esperada: `/root/specialwash/backend/instance/specialwash.db`.
- Si hay cambios de esquema, seguir `GUIA_ACTUALIZAR_BD.md`.
- En el deploy actual a IONOS, el backend arranca con `ENABLE_DB_BOOTSTRAP=0` para no ejecutar `ensure_*_schema.py` ni `db.create_all()` sobre la base existente.

## Verificaciones Rapidas Post-Deploy

```bash
ssh root@specialwash.studio "lsof -i tcp:5000 | cat"
ssh root@specialwash.studio "tail -50 /root/specialwash/backend/app.log"
ssh root@specialwash.studio "nginx -t"
```

Luego validar en navegador:

- `https://specialwash.studio`
- Hard refresh: `Ctrl + Shift + R`

## Troubleshooting

### Backend no responde

```bash
ssh root@specialwash.studio "tail -100 /root/specialwash/backend/app.log"
ssh root@specialwash.studio "fuser -k 5000/tcp || true"
ssh root@specialwash.studio "cd /root/specialwash/backend && nohup /root/specialwash/backend/venv/bin/python app.py > app.log 2>&1 < /dev/null &"
```

### Nginx no recarga

```bash
ssh root@specialwash.studio "nginx -t"
ssh root@specialwash.studio "tail -50 /var/log/nginx/error.log"
```

### Error SSH/rsync

```bash
ssh-keygen -t rsa
ssh-copy-id root@specialwash.studio
```

## Recomendacion de Produccion

Si aun no lo tienes, conviene migrar backend a un servicio `systemd` dedicado
(`specialwash-backend.service`) para reinicios mas fiables tras reboot.
