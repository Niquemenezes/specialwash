#!/usr/bin/env bash

# Script para configurar HTTPS con Let's Encrypt en el servidor IONOS
# Este script debe ejecutarse UNA VEZ antes del primer deploy con dominio.
#
# REQUISITOS previos:
#   1. Los dominios ya apuntan a la IP del servidor en el panel DNS del registrador
#   2. Nginx está instalado y corriendo en el servidor
#   3. Tener acceso SSH al servidor
#
# Uso: ./deploy-https-setup.sh
# Opcional: LETSENCRYPT_EMAIL=tumail@ejemplo.com ./deploy-https-setup.sh

set -euo pipefail

SERVER="${SERVER:-root@specialwash.studio}"
REMOTE_PATH="${REMOTE_PATH:-/root/specialwash}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== CONFIGURACIÓN HTTPS (Let's Encrypt) PARA SPECIALWASH ===${NC}"
echo "Server: $SERVER"
echo ""
echo "Este script configurará:"
echo "  ✓ Certificados SSL reales y gratuitos (Let's Encrypt)"
echo "  ✓ Nginx con HTTPS (puerto 443) para specialwash.studio"
echo "  ✓ Nginx con HTTPS (puerto 443) para api.specialwash.studio"
echo "  ✓ Redirección automática de HTTP a HTTPS"
echo "  ✓ Renovación automática de certificados"
echo ""

# Verificar que existe rsync y ssh
command -v rsync >/dev/null 2>&1 || { echo -e "${RED}Error: rsync no está instalado${NC}"; exit 1; }
command -v ssh >/dev/null 2>&1 || { echo -e "${RED}Error: ssh no está instalado${NC}"; exit 1; }

# 1. Subir archivos necesarios al servidor
echo -e "${YELLOW}[1/3] Subiendo archivos de configuración...${NC}"
rsync -azv "$SCRIPT_DIR/nginx-default.conf"        "$SERVER:$REMOTE_PATH/"
rsync -azv "$SCRIPT_DIR/nginx-default-https.conf"  "$SERVER:$REMOTE_PATH/"
rsync -azv "$SCRIPT_DIR/setup-https.sh"            "$SERVER:$REMOTE_PATH/"

# 2. Dar permisos de ejecución al script
echo -e "${YELLOW}[2/3] Configurando permisos...${NC}"
ssh "$SERVER" "chmod +x $REMOTE_PATH/setup-https.sh"

# 3. Ejecutar script de configuración en el servidor
echo -e "${YELLOW}[3/3] Ejecutando configuración HTTPS en el servidor...${NC}"
echo ""
# Pasar email si fue definido localmente
MAIL_ENV=""
if [[ -n "${LETSENCRYPT_EMAIL:-}" ]]; then
    MAIL_ENV="LETSENCRYPT_EMAIL=$LETSENCRYPT_EMAIL"
fi
ssh "$SERVER" "$MAIL_ENV bash $REMOTE_PATH/setup-https.sh"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ HTTPS con Let's Encrypt configurado!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "🌐 Tu aplicación está disponible en:"
echo -e "   ${GREEN}https://specialwash.studio${NC}          (Frontend)"
echo -e "   ${GREEN}https://api.specialwash.studio${NC}      (API / Backend)"
echo ""
echo "🔁 Los certificados se renuevan automáticamente cada 90 días."
echo ""
echo "💡 Para desplegar código usa: ./deploy.sh all"


# Verificar que existe rsync y ssh
command -v rsync >/dev/null 2>&1 || { echo -e "${RED}Error: rsync no está instalado${NC}"; exit 1; }
command -v ssh >/dev/null 2>&1 || { echo -e "${RED}Error: ssh no está instalado${NC}"; exit 1; }

# 1. Subir archivos necesarios al servidor
echo -e "${YELLOW}[1/3] Subiendo archivos de configuración...${NC}"
rsync -azv "$SCRIPT_DIR/nginx-default.conf"        "$SERVER:$REMOTE_PATH/"
rsync -azv "$SCRIPT_DIR/nginx-default-https.conf"  "$SERVER:$REMOTE_PATH/"
rsync -azv "$SCRIPT_DIR/setup-https.sh"            "$SERVER:$REMOTE_PATH/"

# 2. Dar permisos de ejecución al script
echo -e "${YELLOW}[2/3] Configurando permisos...${NC}"
ssh "$SERVER" "chmod +x $REMOTE_PATH/setup-https.sh"

# 3. Ejecutar script de configuración en el servidor
echo -e "${YELLOW}[3/3] Ejecutando configuración HTTPS en el servidor...${NC}"
echo ""
# Pasar email si fue definido localmente
MAIL_ENV=""
if [[ -n "${LETSENCRYPT_EMAIL:-}" ]]; then
    MAIL_ENV="LETSENCRYPT_EMAIL=$LETSENCRYPT_EMAIL"
fi
ssh "$SERVER" "$MAIL_ENV bash $REMOTE_PATH/setup-https.sh"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ HTTPS con Let's Encrypt configurado!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "🌐 Tu aplicación está disponible en:"
echo -e "   ${GREEN}https://specialwash.studio${NC}          (Frontend)"
echo -e "   ${GREEN}https://api.specialwash.studio${NC}      (API / Backend)"
echo ""
echo "🔁 Los certificados se renuevan automáticamente cada 90 días."
echo ""
echo "💡 Para desplegar código usa: ./deploy.sh all"

