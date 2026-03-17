#!/usr/bin/env bash

# Deploy a IONOS VPS
# Uso:
#   ./deploy.sh backend
#   ./deploy.sh frontend
#   ./deploy.sh all
#
# Variables opcionales:
#   SERVER="root@x.x.x.x" REMOTE_PATH="/root/specialwash" LOCAL_PATH="/ruta/local/al/repo" ./deploy.sh all

set -euo pipefail

SERVER="${SERVER:-root@specialwash.studio}"
REMOTE_PATH="${REMOTE_PATH:-/root/specialwash}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_PATH="${LOCAL_PATH:-$SCRIPT_DIR}"
NGINX_WEB_ROOT="${NGINX_WEB_ROOT:-/var/www/specialwash/public_html}"
RUN_SCHEMA_UPDATES="${RUN_SCHEMA_UPDATES:-0}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
    echo "Uso: ./deploy.sh [backend|frontend|all]"
    echo ""
    echo "Opciones:"
    echo "  backend   - Sincroniza backend y reinicia el servicio/proceso"
    echo "  frontend  - Construye frontend, sincroniza build y recarga nginx"
    echo "  all       - Ejecuta backend + frontend"
}

require_cmd() {
    local cmd="$1"
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo -e "${RED}Error: falta el comando '$cmd' en este entorno${NC}" >&2
        exit 1
    fi
}

if [[ $# -lt 1 ]]; then
    usage
    exit 1
fi

DEPLOY_TYPE="$1"
case "$DEPLOY_TYPE" in
    backend|frontend|all) ;;
    *)
        usage
        exit 1
        ;;
esac

require_cmd rsync
require_cmd ssh
if [[ "$DEPLOY_TYPE" == "frontend" || "$DEPLOY_TYPE" == "all" ]]; then
    require_cmd npm
fi

echo -e "${YELLOW}=== SPECIALWASH DEPLOY (IONOS) ===${NC}"
echo "Server: $SERVER"
echo "Remote path: $REMOTE_PATH"
echo "Nginx web root: $NGINX_WEB_ROOT"
echo "Run schema updates: $RUN_SCHEMA_UPDATES"

deploy_backend() {
    echo -e "${YELLOW}[backend] Sincronizando codigo...${NC}"
    rsync -azv \
        --exclude='.env' \
        --exclude='venv' \
        --exclude='__pycache__' \
        --exclude='*.pyc' \
        --exclude='*.db' \
        --exclude='*.sqlite' \
        --exclude='*.sqlite3' \
        --exclude='instance/specialwash.db' \
        --exclude='specialwash.db' \
        --exclude='app.log' \
        --exclude='.git' \
        "$LOCAL_PATH/backend/" "$SERVER:$REMOTE_PATH/backend/"

    echo -e "${YELLOW}[backend] Reiniciando proceso...${NC}"
    ssh "$SERVER" "RUN_SCHEMA_UPDATES=$RUN_SCHEMA_UPDATES bash -s" <<'BASH_BACKEND'
set -euo pipefail

cd /root/specialwash/backend

# Mantener la base de datos productiva intacta durante este despliegue.
export ENABLE_DB_BOOTSTRAP=0

# No tocar DB por defecto. Solo ejecutar migraciones si se habilita explícitamente.
if [[ "${RUN_SCHEMA_UPDATES:-0}" == "1" ]]; then
    echo "RUN_SCHEMA_UPDATES=1 -> aplicando scripts de esquema"
    if [[ -f /root/specialwash/backend/venv/bin/python ]]; then
        DB_FILE="/root/specialwash/backend/instance/specialwash.db"
        BACKUP_DIR="/root/specialwash/backend/instance/backups"
        if [[ -f "$DB_FILE" ]]; then
            mkdir -p "$BACKUP_DIR"
            cp "$DB_FILE" "$BACKUP_DIR/specialwash.db.$(date +%Y%m%d_%H%M%S).bak"
            echo " -> backup creado en $BACKUP_DIR"
        else
            echo " -> aviso: no se encontro la BD en $DB_FILE (se omite backup)"
        fi

        PYTHON_BIN="/root/specialwash/backend/venv/bin/python"
        for script in \
            update_producto_schema.py \
            update_producto_codigos_schema.py \
            update_servicio_cliente_schema.py \
            update_servicio_catalogo_schema.py \
            update_user_schema.py \
            update_cita_schema.py \
            update_notificacion_schema.py \
            update_inspeccion_schema.py \
            update_acta_entrega_schema.py; do
            if [[ -f "$script" ]]; then
                echo " -> ejecutando $script"
                "$PYTHON_BIN" "$script" || true
            fi
        done
    fi
else
    echo "RUN_SCHEMA_UPDATES=0 -> no se ejecutan cambios de esquema"
fi

# Si existe un servicio systemd, usarlo (mas robusto para produccion).
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q '^specialwash-backend\.service'; then
    # Evitar colision con procesos legacy (nohup) que ocupen el puerto 5000.
    fuser -k 5000/tcp 2>/dev/null || true
    sleep 1
    mkdir -p /etc/systemd/system/specialwash-backend.service.d
    cat >/etc/systemd/system/specialwash-backend.service.d/override.conf <<'EOF'
[Service]
Environment=ENABLE_DB_BOOTSTRAP=0
Environment=FRONTEND_URLS=https://specialwash.studio,https://www.specialwash.studio
EOF
    systemctl daemon-reload
    systemctl restart specialwash-backend
    systemctl --no-pager --full status specialwash-backend | head -n 20 || true
    exit 0
fi

# Fallback: proceso con nohup.
fuser -k 5000/tcp 2>/dev/null || true
sleep 1
nohup env ENABLE_DB_BOOTSTRAP=0 /root/specialwash/backend/venv/bin/python app.py > app.log 2>&1 < /dev/null &
sleep 2
echo "PIDs backend app.py:"
ps aux | grep 'python.*app.py' | grep -v grep | awk '{print $2}' || true
BASH_BACKEND

    echo -e "${GREEN}[backend] Despliegue completado${NC}"
}

deploy_frontend() {
    echo -e "${YELLOW}[frontend] Construyendo build...${NC}"
    cd "$LOCAL_PATH/frontend"
    # API en subdominio dedicado (api.specialwash.studio)
    REACT_APP_BACKEND_URL=https://api.specialwash.studio npm run build

    echo -e "${YELLOW}[frontend] Sincronizando build a Nginx web root...${NC}"
    rsync -azv --delete "$LOCAL_PATH/frontend/build/" "$SERVER:$NGINX_WEB_ROOT/"

    echo -e "${YELLOW}[frontend] Publicando config Nginx, permisos y recarga...${NC}"
    ssh "$SERVER" 'bash -s' <<'BASH_FRONTEND'
set -euo pipefail

# Publicar configuracion Nginx desde el repo.
# Prioridad: HTTPS si existe, sino HTTP normal.
if [[ -f /root/specialwash/nginx-default-https.conf ]]; then
    cp /root/specialwash/nginx-default-https.conf /etc/nginx/sites-available/default
    echo "✓ Usando configuración HTTPS"
elif [[ -f /root/specialwash/nginx-default.conf ]]; then
    cp /root/specialwash/nginx-default.conf /etc/nginx/sites-available/default
    echo "✓ Usando configuración HTTP"
fi

# Crear carpeta web si no existe y ajustar permisos para www-data.
mkdir -p /var/www/specialwash/public_html
chown -R www-data:www-data /var/www/specialwash
find /var/www/specialwash -type d -exec chmod 755 {} \;
find /var/www/specialwash -type f -exec chmod 644 {} \;

nginx -t
nginx -s reload
BASH_FRONTEND

    echo -e "${GREEN}[frontend] Despliegue completado${NC}"
}

if [[ "$DEPLOY_TYPE" == "backend" || "$DEPLOY_TYPE" == "all" ]]; then
    deploy_backend
fi

if [[ "$DEPLOY_TYPE" == "frontend" || "$DEPLOY_TYPE" == "all" ]]; then
    deploy_frontend
fi

echo -e "${GREEN}Deploy completado exitosamente${NC}"
echo ""
echo "Verificar en:"
echo "  Frontend: https://specialwash.studio"
echo "  API:      https://api.specialwash.studio"
echo ""
echo "💡 Si aún no configuraste HTTPS con Certbot, ejecuta: ./deploy-https-setup.sh"

