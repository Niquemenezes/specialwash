#!/bin/bash

# Deploy Script para SW Studio en VPS
# =============================================

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          🚀 DEPLOY SW STUDIO 🚀                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Variables
APP_DIR="/var/www/swstudio/app"
DATA_DIR="/var/www/swstudio/data"
LOG_DIR="/var/www/swstudio/logs"
VENV_DIR="$APP_DIR/venv"

echo -e "${BLUE}📂 Paso 1: Crear estructura de directorios${NC}"
mkdir -p "$APP_DIR" "$DATA_DIR" "$LOG_DIR"
echo -e "${GREEN}✅ Directorios creados${NC}"
echo ""

echo -e "${BLUE}📥 Paso 2: Preparar aplicación${NC}"
cd "$APP_DIR"

# Si existe repo, hacer pull; si no, crear estructura
if [ -d ".git" ]; then
  echo "  Actualizando código..."
  git pull origin main || echo "  ⚠️  Pull failed, continuando..."
else
  echo "  ℹ️  Repo no encontrado, verificar código copiado/clonado (scp, rsync o git clone)"
fi

echo -e "${GREEN}✅ Código preparado${NC}"
echo ""

echo -e "${BLUE}🔐 Paso 3: Crear .env${NC}"
: "${SECRET_KEY:?Export SECRET_KEY antes de ejecutar el deploy}"
: "${JWT_SECRET_KEY:?Export JWT_SECRET_KEY antes de ejecutar el deploy}"
cat > backend/.env <<EOF
FLASK_ENV=production
ENABLE_ADMIN=0
ENABLE_DB_BOOTSTRAP=0
SECRET_KEY=${SECRET_KEY}
JWT_SECRET_KEY=${JWT_SECRET_KEY}
DATABASE_URL=sqlite:////var/www/swstudio/data/swstudio.db
FRONTEND_URLS=https://sw-studio.es,https://www.sw-studio.es
DEBUG=False
EOF
chmod 600 backend/.env
echo -e "${GREEN}✅ .env creado (solo lectura para root)${NC}"
echo ""

echo -e "${BLUE}🐍 Paso 4: Instalar dependencias Python${NC}"
if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
  echo "  Virtualenv creado"
fi

source "$VENV_DIR/bin/activate"
pip install --upgrade pip setuptools wheel >/dev/null 2>&1
pip install -r backend/requirements.txt >/dev/null 2>&1

python - <<'PY'
import importlib
import sys

modules = ["openpyxl", "gspread", "google.oauth2.service_account"]
for module_name in modules:
  try:
    importlib.import_module(module_name)
  except Exception as exc:
    print(f"Falta dependencia obligatoria: {module_name}: {exc}")
    sys.exit(1)
print("Validación de dependencias Python OK")
PY

echo -e "${GREEN}✅ Dependencias Python instaladas${NC}"
echo ""

echo -e "${BLUE}🗄️  Paso 5: Inicializar / migrar base de datos${NC}"
mkdir -p "$DATA_DIR"
cd backend
if [ "${ENABLE_DB_BOOTSTRAP:-0}" = "1" ]; then
  echo "  ENABLE_DB_BOOTSTRAP=1 → ejecutando bootstrap inicial"
  python init_db.py 2>&1 || echo "  ⚠️  init_db puede requerir configuracion extra"
  python update_servicio_catalogo_schema.py 2>&1 || echo "  ⚠️  schema update no aplicado"
else
  echo "  Bootstrap de BD desactivado (ENABLE_DB_BOOTSTRAP=0)"
fi
cd ..
echo -e "${GREEN}✅ Base de datos lista${NC}"
echo ""

echo -e "${BLUE}🌐 Paso 6: Configurar Nginx${NC}"
cp deploy/nginx-swstudio.conf /etc/nginx/sites-available/swstudio.conf
ln -sf /etc/nginx/sites-available/swstudio.conf /etc/nginx/sites-enabled/swstudio.conf
nginx -t >/dev/null 2>&1 && systemctl restart nginx
echo -e "${GREEN}✅ Nginx configurado${NC}"
echo ""

echo -e "${BLUE}⚙️  Paso 7: Crear servicio systemd${NC}"
cp deploy/swstudio-backend.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable swstudio-backend.service
systemctl restart swstudio-backend.service
systemctl status swstudio-backend.service | head -3
echo -e "${GREEN}✅ Servicio systemd activado${NC}"
echo ""

echo -e "${BLUE}✨ Paso 8: Crear carpetas de logs${NC}"
touch "$LOG_DIR/backend.log" "$LOG_DIR/nginx.log"
chmod 755 "$LOG_DIR"
echo -e "${GREEN}✅ Logs configurados${NC}"
echo ""

echo "═════════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}✅ DEPLOY COMPLETADO${NC}"
echo ""
echo -e "${YELLOW}📋 Próximos pasos:${NC}"
echo ""
echo "1️⃣  Generar SSL (ejecutar en el servidor):"
echo "    certbot certonly --standalone \\"
echo "      -d sw-studio.es -d www.sw-studio.es \\"
echo "      --agree-tos --non-interactive -m admin@sw-studio.es"
echo ""
echo "2️⃣  Verificar estado:"
echo "    bash deploy/monitor.sh"
echo ""
echo "3️⃣  Acceder a:"
echo -e "    ${BLUE}https://sw-studio.es${NC}"
echo ""
echo "═════════════════════════════════════════════════════════════════"
