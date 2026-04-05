#!/bin/bash
# ══════════════════════════════════════════════════════════════
# SpecialWash Deploy Script for IONOS VPS
# Usage: bash deploy.sh
# ══════════════════════════════════════════════════════════════

set -e

echo "🚀 SpecialWash Deploy Script - IONOS VPS"
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
# 2. Setup directories
# ──────────────────────────────────────────────────────────────
echo "Configurando directorios..."

mkdir -p /var/www/specialwash/{app,logs,data,backup}
chmod 755 /var/www/specialwash

success "Directorios listos"
echo ""

# ──────────────────────────────────────────────────────────────
# 3. Backend setup
# ──────────────────────────────────────────────────────────────
echo "Configurando backend Python..."

cd /var/www/specialwash/app/backend

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

success "Backend dependencias instaladas"
echo ""

# ──────────────────────────────────────────────────────────────
# 4. Environment check
# ──────────────────────────────────────────────────────────────
echo "Verificando configuración..."

if [[ ! -f ".env" ]]; then
    warning ".env no encontrado en backend/"
    warning "Por favor, copia el archivo .env.production a backend/.env"
    warning "y actualiza los valores de SECRET_KEY y JWT_SECRET_KEY"
    echo ""
    echo "Ejemplo:"
    echo "  cp /carpeta/deploy/env.example /var/www/specialwash/app/backend/.env"
    echo ""
    error "Configuración incompleta. Abortar."
fi

success ".env encontrado"
echo ""

# ──────────────────────────────────────────────────────────────
# 5. Database init (if needed)
# ──────────────────────────────────────────────────────────────
echo "Verificando base de datos..."

if [[ ! -f "/var/www/specialwash/data/specialwash.db" ]]; then
    warning "Base de datos no encontrada"
    warning "Se creará automáticamente al iniciar la app"
fi

mkdir -p /var/www/specialwash/data
chmod 755 /var/www/specialwash/data

success "Datos listos"
echo ""

# ──────────────────────────────────────────────────────────────
# 6. Nginx configuration
# ──────────────────────────────────────────────────────────────
echo "Configurando nginx..."

# Copy nginx config
if [[ -f "/root/deploy/nginx-specialwash.conf" ]]; then
    cp /root/deploy/nginx-specialwash.conf /etc/nginx/sites-available/specialwash
    ln -sf /etc/nginx/sites-available/specialwash /etc/nginx/sites-enabled/specialwash
    rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx config
    if nginx -t >/dev/null 2>&1; then
        systemctl restart nginx
        success "Nginx configurado y reiniciado"
    else
        error "Configuración de nginx inválida"
    fi
else
    warning "nginx-specialwash.conf no encontrado"
    warning "Copiar manualmente: /root/deploy/nginx-specialwash.conf → /etc/nginx/sites-available/specialwash"
fi

echo ""

# ──────────────────────────────────────────────────────────────
# 7. Systemd service
# ──────────────────────────────────────────────────────────────
echo "Configurando servicio systemd..."

if [[ -f "/root/deploy/specialwash-backend.service" ]]; then
    cp /root/deploy/specialwash-backend.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable specialwash-backend.service
    systemctl restart specialwash-backend.service
    
    success "Servicio systemd configurado"
else
    warning "specialwash-backend.service no encontrado"
    warning "Copiar manualmente: /root/deploy/specialwash-backend.service → /etc/systemd/system/"
fi

echo ""

# ──────────────────────────────────────────────────────────────
# 8. Verification
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
if systemctl is-active --quiet specialwash-backend; then
    success "Backend corriendo"
else
    error "Backend no activo - ver: journalctl -u specialwash-backend.service"
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
echo "1. Generar certificado SSL: certbot certonly --standalone -d specialwash.studio -d www.specialwash.studio"
echo "2. Verificar: https://specialwash.studio"
echo "3. Logs: journalctl -u specialwash-backend.service -f"
echo ""
