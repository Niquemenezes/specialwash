#!/bin/bash

# Script de deploy automático a producción
# Uso: ./deploy.sh [backend|frontend|all]

set -e

SERVIDOR="root@194.164.164.78"
REMOTE_PATH="/root/specialwash"
LOCAL_PATH="/workspaces/specialwash"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== SPECIALWASH DEPLOY ===${NC}"

# Validar argumento
if [ -z "$1" ]; then
    echo "Uso: ./deploy.sh [backend|frontend|all]"
    echo ""
    echo "Opciones:"
    echo "  backend   - Desplegar solo código backend"
    echo "  frontend  - Construir y desplegar frontend"
    echo "  all       - Desplegar backend, construir y desplegar frontend"
    exit 1
fi

DEPLOY_TYPE="$1"

# ============ BACKEND ============
if [ "$DEPLOY_TYPE" = "backend" ] || [ "$DEPLOY_TYPE" = "all" ]; then
    echo -e "${YELLOW}📦 Sincronizando código backend...${NC}"
    rsync -avz --exclude='.env' --exclude='node_modules' --exclude='venv' --exclude='.git' --exclude='__pycache__' --exclude='*.pyc' --exclude='build' --exclude='instance/specialwash.db' \
        "$LOCAL_PATH/backend/" "$SERVIDOR:$REMOTE_PATH/backend/"
    
    echo -e "${YELLOW}🔄 Reiniciando servidor Flask...${NC}"
    ssh "$SERVIDOR" 'bash -s' << 'BASH_SCRIPT'
cd /root/specialwash/backend
fuser -k 5000/tcp 2>/dev/null || true
sleep 2
nohup /root/specialwash/backend/venv/bin/python app.py > app.log 2>&1 < /dev/null &
sleep 3
echo "Backend iniciado con PID:"
ps aux | grep 'python.*app.py' | grep -v grep | awk '{print $2}'
BASH_SCRIPT
    
    echo -e "${GREEN}✅ Backend desplegado correctamente${NC}"
fi

# ============ FRONTEND ============
if [ "$DEPLOY_TYPE" = "frontend" ] || [ "$DEPLOY_TYPE" = "all" ]; then
    echo -e "${YELLOW}🏗️  Construyendo frontend...${NC}"
    cd "$LOCAL_PATH/frontend"
    npm run build
    
    echo -e "${YELLOW}📤 Sincronizando frontend al servidor...${NC}"
    rsync -avz --delete "$LOCAL_PATH/frontend/build/" "$SERVIDOR:$REMOTE_PATH/frontend/build/"
    
    echo -e "${YELLOW}� Ajustando permisos...${NC}"
    ssh "$SERVIDOR" 'bash -s' << 'BASH_FIX'
chmod +rx /root /root/specialwash /root/specialwash/frontend /root/specialwash/frontend/build
chmod -R +r /root/specialwash/frontend/build/
find /root/specialwash/frontend/build/ -type d -exec chmod +x {} \;
BASH_FIX
    
    echo -e "${YELLOW}�🔄 Recargando Nginx...${NC}"
    ssh "$SERVIDOR" 'nginx -s reload && echo "Nginx reloaded"'
    
    echo -e "${GREEN}✅ Frontend desplegado correctamente${NC}"
fi

echo -e "${GREEN}🎉 Deploy completado exitosamente${NC}"
echo ""
echo "Verificar en: http://194.164.164.78"
