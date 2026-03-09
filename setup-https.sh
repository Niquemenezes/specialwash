#!/bin/bash
# Script para configurar HTTPS con certificado autofirmado en IONOS
# Ejecutar en el servidor: bash setup-https.sh

set -e

echo "🔐 Configurando HTTPS para SpecialWash..."
echo ""

# 1. Crear directorio para certificados SSL
echo "📁 Creando directorio para certificados..."
mkdir -p /etc/nginx/ssl
cd /etc/nginx/ssl

# 2. Generar certificado SSL autofirmado (válido por 365 días)
echo "🔑 Generando certificado SSL autofirmado..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout specialwash.key \
  -out specialwash.crt \
  -subj "/C=ES/ST=Madrid/L=Madrid/O=SpecialWash/CN=194.164.164.78"

# 3. Configurar permisos
echo "🔒 Configurando permisos..."
chmod 600 specialwash.key
chmod 644 specialwash.crt

# 4. Backup de configuración actual de Nginx
echo "💾 Haciendo backup de configuración actual..."
cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)

# 5. Copiar nueva configuración (debe haber sido subida previamente)
if [ -f /root/specialwash/nginx-default-https.conf ]; then
    echo "📋 Aplicando nueva configuración Nginx con HTTPS..."
    cp /root/specialwash/nginx-default-https.conf /etc/nginx/sites-available/default
else
    echo "⚠️  Advertencia: No se encontró nginx-default-https.conf"
    echo "   El archivo debe estar en /root/specialwash/"
fi

# 6. Validar configuración de Nginx
echo "✅ Validando configuración de Nginx..."
nginx -t

# 7. Recargar Nginx
echo "🔄 Recargando Nginx..."
systemctl reload nginx

echo ""
echo "✅ ¡HTTPS configurado correctamente!"
echo ""
echo "📱 Ahora puedes acceder desde tu móvil a:"
echo "   https://194.164.164.78"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   - El navegador mostrará una advertencia de seguridad"
echo "   - Haz clic en 'Avanzado' -> 'Continuar de todos modos'"
echo "   - Esto es normal con certificados autofirmados"
echo "   - Después de aceptar, la cámara funcionará correctamente"
echo ""
