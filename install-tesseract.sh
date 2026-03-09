#!/bin/bash
# Script para instalar Tesseract OCR en el servidor de producción (Ubuntu/Debian)
# Ejecutar en el servidor: bash install-tesseract.sh

set -e

echo "📦 Instalando Tesseract OCR y dependencias..."
echo ""

# Actualizar paquetes
echo "1️⃣ Actualizando lista de paquetes..."
apt-get update

# Instalar Tesseract y paquetes de idiomas
echo "2️⃣ Instalando Tesseract OCR con soporte para español e inglés..."
apt-get install -y tesseract-ocr tesseract-ocr-spa tesseract-ocr-eng

# Instalar dependencias de Python
echo "3️⃣ Instalando librerías Python: pytesseract y Pillow..."
cd /root/specialwash/backend
source venv/bin/activate
pip install pytesseract Pillow

# Verificar instalación
echo ""
echo "✅ Verificando instalación..."
echo "Versión de Tesseract:"
tesseract --version

echo ""
echo "Idiomas instalados:"
tesseract --list-langs

echo ""
if python -c "import pytesseract; import PIL; print('✅ Python: pytesseract y PIL importados correctamente')" 2>/dev/null; then
    echo "✅ Instalación completada exitosamente!"
else
    echo "⚠️  Advertencia: Hay un problema con las librerías Python"
fi

echo ""
echo "🔄 Reiniciando backend..."
if systemctl list-unit-files | grep -q '^specialwash-backend\.service'; then
    systemctl restart specialwash-backend
    echo "✅ Backend reiniciado con systemd"
else
    fuser -k 5000/tcp 2>/dev/null || true
    sleep 1
    nohup /root/specialwash/backend/venv/bin/python /root/specialwash/backend/app.py > /root/specialwash/backend/app.log 2>&1 < /dev/null &
    echo "✅ Backend reiniciado con nohup"
fi

echo ""
echo "======================================"
echo "✅ Tesseract OCR instalado!"
echo "======================================"
echo ""
echo "Ahora puedes usar el escaneo de facturas desde la aplicación."
echo ""
