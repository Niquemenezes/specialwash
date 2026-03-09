#!/usr/bin/env bash

# Script para instalar Tesseract OCR en el servidor IONOS
# Ejecutar desde Codespaces: ./deploy-install-tesseract.sh

set -euo pipefail

SERVER="${SERVER:-root@194.164.164.78}"
REMOTE_PATH="${REMOTE_PATH:-/root/specialwash}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== INSTALACIÓN DE TESSERACT OCR ===${NC}"
echo "Server: $SERVER"
echo ""

# Verificar ssh
command -v ssh >/dev/null 2>&1 || { echo -e "${RED}Error: ssh no está instalado${NC}"; exit 1; }
command -v rsync >/dev/null 2>&1 || { echo -e "${RED}Error: rsync no está instalado${NC}"; exit 1; }

# 1. Subir script de instalación
echo -e "${YELLOW}[1/2] Subiendo script de instalación...${NC}"
rsync -azv "$SCRIPT_DIR/install-tesseract.sh" "$SERVER:$REMOTE_PATH/"

# 2. Dar permisos y ejecutar
echo -e "${YELLOW}[2/2] Ejecutando instalación en el servidor...${NC}"
echo ""
ssh "$SERVER" "chmod +x $REMOTE_PATH/install-tesseract.sh && bash $REMOTE_PATH/install-tesseract.sh"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Tesseract OCR instalado!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📱 Ahora puedes usar el escaneo de facturas:"
echo "   1. Ve a 'Registrar Entrada'"
echo "   2. Haz clic en '📷 Escanear Factura/Albarán'"
echo "   3. Toma una foto del documento"
echo "   4. Los datos se extraerán automáticamente"
echo ""
echo "💡 El OCR funciona mejor con:"
echo "   - Imágenes claras y enfocadas"
echo "   - Buena iluminación"
echo "   - Texto horizontal (no inclinado)"
echo ""
