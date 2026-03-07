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

SERVER="${SERVER:-root@194.164.164.78}"
REMOTE_PATH="${REMOTE_PATH:-/root/specialwash}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_PATH="${LOCAL_PATH:-$SCRIPT_DIR}"
NGINX_WEB_ROOT="${NGINX_WEB_ROOT:-/var/www/specialwash/public_html}"

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

deploy_backend() {
    echo -e "${YELLOW}[backend] Sincronizando codigo...${NC}"
    rsync -azv \
        --exclude='.env' \
        --exclude='venv' \
        --exclude='__pycache__' \
        --exclude='*.pyc' \
        --exclude='instance/specialwash.db' \
        --exclude='specialwash.db' \
        --exclude='app.log' \
        --exclude='.git' \
        "$LOCAL_PATH/backend/" "$SERVER:$REMOTE_PATH/backend/"

    echo -e "${YELLOW}[backend] Reiniciando proceso...${NC}"
    ssh "$SERVER" 'bash -s' <<'BASH_BACKEND'
set -euo pipefail

cd /root/specialwash/backend

# Si existe un servicio systemd, usarlo (mas robusto para produccion).
if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files | grep -q '^specialwash-backend\.service'; then
    systemctl restart specialwash-backend
    systemctl --no-pager --full status specialwash-backend | head -n 20 || true
    exit 0
fi

# Fallback: proceso con nohup.
fuser -k 5000/tcp 2>/dev/null || true
sleep 1
nohup /root/specialwash/backend/venv/bin/python app.py > app.log 2>&1 < /dev/null &
sleep 2
echo "PIDs backend app.py:"
ps aux | grep 'python.*app.py' | grep -v grep | awk '{print $2}' || true
BASH_BACKEND

    echo -e "${GREEN}[backend] Despliegue completado${NC}"
}

deploy_frontend() {
    echo -e "${YELLOW}[frontend] Construyendo build...${NC}"
    cd "$LOCAL_PATH/frontend"
    # Forzar API same-origin en produccion para evitar llamadas a Codespaces.
    REACT_APP_BACKEND_URL=/api npm run build

    echo -e "${YELLOW}[frontend] Sincronizando build a Nginx web root...${NC}"
    rsync -azv --delete "$LOCAL_PATH/frontend/build/" "$SERVER:$NGINX_WEB_ROOT/"

    echo -e "${YELLOW}[frontend] Publicando config Nginx, permisos y recarga...${NC}"
    ssh "$SERVER" 'bash -s' <<'BASH_FRONTEND'
set -euo pipefail

# Publicar configuracion Nginx desde el repo (si existe).
if [[ -f /root/specialwash/nginx-default.conf ]]; then
    cp /root/specialwash/nginx-default.conf /etc/nginx/sites-available/default
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
echo "Verificar en: http://194.164.164.78"
