#!/bin/bash
# Script para configurar HTTPS con Let's Encrypt (Certbot) en el servidor
# Ejecutar en el servidor: bash setup-https.sh
# REQUISITO: los dominios specialwash.studio y api.specialwash.studio deben
#            apuntar ya a la IP de este servidor en los DNS del registrador.

set -e

FRONTEND_DOMAIN="specialwash.studio"
API_DOMAIN="api.specialwash.studio"
EMAIL="${LETSENCRYPT_EMAIL:-admin@specialwash.studio}"   # cambia este email si quieres notificaciones de renovación

echo "🔐 Configurando HTTPS con Let's Encrypt para SpecialWash..."
echo ""
echo "  Frontend : $FRONTEND_DOMAIN (y www.$FRONTEND_DOMAIN)"
echo "  API      : $API_DOMAIN"
echo "  Email    : $EMAIL"
echo ""

# 1. Instalar Certbot si no está presente
if ! command -v certbot >/dev/null 2>&1; then
    echo "📦 Instalando Certbot..."
    apt-get update -q
    apt-get install -y certbot python3-certbot-nginx
fi

# 2. Crear directorio webroot para verificación ACME (por si nginx ya corre)
mkdir -p /var/www/certbot

# 3. Backup de la configuración actual de Nginx
echo "💾 Haciendo backup de configuración Nginx..."
cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true

# 4. Copiar configuración HTTP básica para que Nginx sirva los desafíos ACME
if [[ -f /root/specialwash/nginx-default.conf ]]; then
    echo "📋 Aplicando configuración HTTP temporal para verificación ACME..."
    cp /root/specialwash/nginx-default.conf /etc/nginx/sites-available/default
    nginx -t && nginx -s reload
fi

# 5. Obtener certificados de Let's Encrypt
echo ""
echo "🔑 Solicitando certificado para el frontend ($FRONTEND_DOMAIN, www.$FRONTEND_DOMAIN)..."
certbot certonly --nginx \
    -d "$FRONTEND_DOMAIN" \
    -d "www.$FRONTEND_DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --redirect

echo ""
echo "🔑 Solicitando certificado para la API ($API_DOMAIN)..."
certbot certonly --nginx \
    -d "$API_DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive

# 6. Copiar la configuración HTTPS final con los dos dominios
if [[ -f /root/specialwash/nginx-default-https.conf ]]; then
    echo ""
    echo "📋 Aplicando configuración HTTPS con subdominios..."
    cp /root/specialwash/nginx-default-https.conf /etc/nginx/sites-available/default
fi

# 7. Validar y recargar Nginx
echo "✅ Validando configuración de Nginx..."
nginx -t

echo "🔄 Recargando Nginx..."
nginx -s reload

# 8. Verificar autorenovación automática
echo ""
echo "🔁 Verificando timer de renovación automática..."
systemctl enable certbot.timer 2>/dev/null || true
systemctl start certbot.timer 2>/dev/null || true

echo ""
echo "✅ ¡HTTPS con Let's Encrypt configurado correctamente!"
echo ""
echo "🌐 Accede a tu aplicación en:"
echo "   https://$FRONTEND_DOMAIN"
echo "   https://$API_DOMAIN"
echo ""
echo "🔁 Los certificados se renuevan automáticamente (válidos 90 días)."

