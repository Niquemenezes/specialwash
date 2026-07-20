#!/bin/bash
# ══════════════════════════════════════════════════════════════
# SW Studio Deploy Script for VPS
# Usage: bash deploy.sh
# ══════════════════════════════════════════════════════════════

set -e

echo "🚀 SW Studio Deploy Script - VPS"
echo "════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Functions
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; exit 1; }

# ──────────────────────────────────────────────────────────────
# 1. Check prerequisites
# ──────────────────────────────────────────────────────────────
echo "Verificando requisitos..."

[[ "$EUID" -eq 0 ]] || error "Este script debe ejecutarse como root"
command -v python3 >/dev/null || error "Python3 no instalado"
command -v nginx >/dev/null || error "Nginx no instalado"

success "Requisitos OK"
echo ""

# ──────────────────────────────────────────────────────────────
# 2. Create dedicated system user
# ──────────────────────────────────────────────────────────────
echo "Creando usuario del sistema 'swstudio'..."

if ! id -u swstudio >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin --groups www-data swstudio
    success "Usuario 'swstudio' creado"
else
    success "Usuario 'swstudio' ya existe"
fi
echo ""

# ──────────────────────────────────────────────────────────────
# 3. Setup directories
# ──────────────────────────────────────────────────────────────
echo "Configurando directorios..."

mkdir -p /var/www/swstudio/{app,logs,data,backup}
chmod 755 /var/www/swstudio
# Directories that the service user needs to write to
chown swstudio:www-data /var/www/swstudio/logs
chown swstudio:www-data /var/www/swstudio/data
chmod 750 /var/www/swstudio/logs
chmod 750 /var/www/swstudio/data

success "Directorios listos"
echo ""

# ──────────────────────────────────────────────────────────────
# 4. Backend setup
# ──────────────────────────────────────────────────────────────
echo "Configurando backend Python..."

cd /var/www/swstudio/app/backend

# Check if venv exists
if [[ ! -d "venv" ]]; then
    python3 -m venv venv
    success "Virtual environment creado"
fi

source venv/bin/activate

# Upgrade pip
pip install --upgrade pip setuptools wheel >/dev/null 2>&1

# Install requirements
pip install -r requirements.txt gunicorn >/dev/null 2>&1

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

success "Backend dependencias instaladas"
echo ""

# ──────────────────────────────────────────────────────────────
# 5. Environment check
# ──────────────────────────────────────────────────────────────
echo "Verificando configuración..."

if [[ ! -f ".env" ]]; then
    warning ".env no encontrado en backend/"
    warning "Por favor, copia el archivo env.example a backend/.env"
    warning "y actualiza los valores de SECRET_KEY y JWT_SECRET_KEY"
    echo ""
    echo "Ejemplo:"
    echo "  cp /root/swstudio/deploy/env.example /var/www/swstudio/app/backend/.env"
    echo ""
    error "Configuración incompleta. Abortar."
fi

success ".env encontrado"
echo ""

# ──────────────────────────────────────────────────────────────
# 6. Database init (if needed)
# ──────────────────────────────────────────────────────────────
echo "Verificando base de datos..."

mkdir -p /var/www/swstudio/data
chown swstudio:www-data /var/www/swstudio/data
chmod 750 /var/www/swstudio/data

python init_db.py 2>&1 || warning "init_db no pudo completarse"
python update_servicio_catalogo_schema.py 2>&1 || warning "schema update no aplicado"

success "Base de datos lista"
echo ""

# ──────────────────────────────────────────────────────────────
# 7. Nginx configuration
# ──────────────────────────────────────────────────────────────
echo "Configurando nginx..."

# Copy nginx config
if [[ -f "/root/swstudio/deploy/nginx-swstudio.conf" ]]; then
    cp /root/swstudio/deploy/nginx-swstudio.conf /etc/nginx/sites-available/swstudio
    ln -sf /etc/nginx/sites-available/swstudio /etc/nginx/sites-enabled/swstudio
    rm -f /etc/nginx/sites-enabled/default

    # Test nginx config
    if nginx -t >/dev/null 2>&1; then
        systemctl restart nginx
        success "Nginx configurado y reiniciado"
    else
        error "Configuración de nginx inválida"
    fi
else
    warning "nginx-swstudio.conf no encontrado"
    warning "Copiar manualmente: /root/swstudio/deploy/nginx-swstudio.conf → /etc/nginx/sites-available/swstudio"
fi

echo ""

# ──────────────────────────────────────────────────────────────
# 8. Systemd service
# ──────────────────────────────────────────────────────────────
echo "Configurando servicio systemd..."

if [[ -f "/root/swstudio/deploy/swstudio-backend.service" ]]; then
    cp /root/swstudio/deploy/swstudio-backend.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable swstudio-backend.service
    systemctl restart swstudio-backend.service

    success "Servicio systemd configurado"
else
    warning "swstudio-backend.service no encontrado"
    warning "Copiar manualmente: /root/swstudio/deploy/swstudio-backend.service → /etc/systemd/system/"
fi

echo ""

# ──────────────────────────────────────────────────────────────
# 9. Verification
# ──────────────────────────────────────────────────────────────
echo "Verificando status..."
echo ""

# Check nginx
if systemctl is-active --quiet nginx; then
    success "Nginx corriendo"
else
    error "Nginx no activo"
fi

# Check backend
sleep 2
if systemctl is-active --quiet swstudio-backend; then
    success "Backend corriendo"
else
    error "Backend no activo - ver: journalctl -u swstudio-backend.service"
fi

# Check connectivity
if curl -s http://127.0.0.1:8000/api/salud >/dev/null 2>&1; then
    success "Backend responde"
else
    warning "Backend no responde en /api/salud - puede estar inicializando"
fi

echo ""
echo "════════════════════════════════════════"
success "🎉 Deploy completado!"
echo ""
echo "Próximos pasos:"
echo "1. Generar certificado SSL: certbot certonly --standalone -d sw-studio.es -d www.sw-studio.es"
echo "2. Verificar: https://sw-studio.es"
echo "3. Logs: journalctl -u swstudio-backend.service -f"
echo ""
