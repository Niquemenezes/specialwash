#!/bin/bash
# ══════════════════════════════════════════════════════════════
# Generar claves secretas seguras para SpecialWash
# Uso: bash generate-secrets.sh
# ══════════════════════════════════════════════════════════════

echo "🔐 SpecialWash Secret Generator"
echo "════════════════════════════════════════"
echo ""

# Generar SECRET_KEY
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
echo "SECRET_KEY:"
echo "$SECRET_KEY"
echo ""

# Generar JWT_SECRET_KEY
JWT_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
echo "JWT_SECRET_KEY:"
echo "$JWT_SECRET_KEY"
echo ""

echo "════════════════════════════════════════"
echo "✅ Copiar estos valores a .env en el servidor"
echo ""
echo "Archivo: /var/www/specialwash/app/backend/.env"
echo ""
