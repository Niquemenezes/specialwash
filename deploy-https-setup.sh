#!/usr/bin/env bash

# Script para configurar HTTPS en el servidor IONOS
# Este script debe ejecutarse UNA VEZ antes del primer deploy
# Uso: ./deploy-https-setup.sh

set -euo pipefail

SERVER="${SERVER:-root@194.164.164.78}"
REMOTE_PATH="${REMOTE_PATH:-/root/specialwash}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== CONFIGURACIÓN HTTPS PARA SPECIALWASH ===${NC}"
echo "Server: $SERVER"
echo ""
echo "Este script configurará:"
echo "  ✓ Certificado SSL autofirmado"
echo "  ✓ Nginx con HTTPS (puerto 443)"
echo "  ✓ Redirección automática de HTTP a HTTPS"
echo ""

# Verificar que existe rsync y ssh
command -v rsync >/dev/null 2>&1 || { echo -e "${RED}Error: rsync no está instalado${NC}"; exit 1; }
command -v ssh >/dev/null 2>&1 || { echo -e "${RED}Error: ssh no está instalado${NC}"; exit 1; }

# 1. Subir archivos necesarios al servidor
echo -e "${YELLOW}[1/3] Subiendo archivos de configuración...${NC}"
rsync -azv "$SCRIPT_DIR/nginx-default-https.conf" "$SERVER:$REMOTE_PATH/"
rsync -azv "$SCRIPT_DIR/setup-https.sh" "$SERVER:$REMOTE_PATH/"

# 2. Dar permisos de ejecución al script
echo -e "${YELLOW}[2/3] Configurando permisos...${NC}"
ssh "$SERVER" "chmod +x $REMOTE_PATH/setup-https.sh"

# 3. Ejecutar script de configuración en el servidor
echo -e "${YELLOW}[3/3] Ejecutando configuración HTTPS en el servidor...${NC}"
echo ""
ssh "$SERVER" "bash $REMOTE_PATH/setup-https.sh"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ HTTPS configurado correctamente!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📱 Ahora puedes acceder desde tu móvil a:"
echo -e "   ${GREEN}https://194.164.164.78${NC}"
echo ""
echo "⚠️  IMPORTANTE - Primera vez:"
echo "   1. El navegador mostrará: 'Tu conexión no es privada'"
echo "   2. Haz clic en 'Avanzado' o 'Ver detalles'"
echo "   3. Haz clic en 'Continuar a 194.164.164.78 (no seguro)'"
echo "   4. Acepta el certificado"
echo ""
echo "   Después de aceptar:"
echo "   ✅ La cámara y galería funcionarán correctamente"
echo "   ✅ Podrás subir fotos y videos"
echo "   ✅ El navegador recordará tu decisión"
echo ""
echo "💡 Consejo: Cuando tengas el dominio listo, podrás obtener"
echo "   un certificado SSL válido gratis con Let's Encrypt"
echo ""
