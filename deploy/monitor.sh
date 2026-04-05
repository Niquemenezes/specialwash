#!/bin/bash
# ══════════════════════════════════════════════════════════════
# SpecialWash Status & Health Check
# Uso: bash monitor.sh
# ══════════════════════════════════════════════════════════════

echo "📊 SpecialWash Health Check"
echo "════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

status_ok() { echo -e "${GREEN}✅ $1${NC}"; }
status_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
status_err() { echo -e "${RED}❌ $1${NC}"; }

# ──────────────────────────────────────────────────────────────
# 1. Services Status
# ──────────────────────────────────────────────────────────────
echo "📋 SERVICE STATUS"
echo "─────────────────────────────────────────"

if systemctl is-active --quiet nginx; then
    status_ok "Nginx running"
else
    status_err "Nginx DOWN"
fi

if systemctl is-active --quiet specialwash-backend.service; then
    status_ok "Backend running"
else
    status_err "Backend DOWN"
fi

echo ""

# ──────────────────────────────────────────────────────────────
# 2. Port Checks
# ──────────────────────────────────────────────────────────────
echo "🔌 PORTS"
echo "─────────────────────────────────────────"

if netstat -tlnp 2>/dev/null | grep -q ":80 "; then
    status_ok "Port 80 (HTTP)"
else
    status_warn "Port 80 not listening"
fi

if netstat -tlnp 2>/dev/null | grep -q ":443 "; then
    status_ok "Port 443 (HTTPS)"
else
    status_warn "Port 443 not listening"
fi

if netstat -tlnp 2>/dev/null | grep -q ":8000 "; then
    status_ok "Port 8000 (Backend)"
else
    status_warn "Port 8000 not listening"
fi

echo ""

# ──────────────────────────────────────────────────────────────
# 3. Backend Connectivity
# ──────────────────────────────────────────────────────────────
echo "🔗 CONNECTIVITY"
echo "─────────────────────────────────────────"

if curl -s http://127.0.0.1:8000/api/salud >/dev/null 2>&1; then
    status_ok "Backend responds (http://127.0.0.1:8000/api/salud)"
else
    status_err "Backend not responding"
fi

if curl -s -o /dev/null -w "%{http_code}" https://specialwash.studio 2>/dev/null | grep -q "200"; then
    status_ok "Frontend (https://specialwash.studio)"
else
    status_warn "Frontend may not be responding"
fi

echo ""

# ──────────────────────────────────────────────────────────────
# 4. SSL Certificate
# ──────────────────────────────────────────────────────────────
echo "🔐 SSL CERTIFICATE"
echo "─────────────────────────────────────────"

if [[ -f "/etc/letsencrypt/live/specialwash.studio/cert.pem" ]]; then
    EXPIRY=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/specialwash.studio/cert.pem | cut -d= -f2)
    DAYS_LEFT=$(( ($(date -d "$EXPIRY" +%s) - $(date +%s)) / 86400 ))
    
    if [[ $DAYS_LEFT -gt 30 ]]; then
        status_ok "SSL valid ($DAYS_LEFT days left)"
    elif [[ $DAYS_LEFT -gt 0 ]]; then
        status_warn "SSL expires in $DAYS_LEFT days"
    else
        status_err "SSL expired"
    fi
else
    status_warn "SSL certificate not found"
fi

echo ""

# ──────────────────────────────────────────────────────────────
# 5. Disk Space
# ──────────────────────────────────────────────────────────────
echo "💾 DISK USAGE"
echo "─────────────────────────────────────────"

USAGE=$(df /var/www/specialwash | tail -1 | awk '{print $5}' | sed 's/%//')

if [[ $USAGE -lt 80 ]]; then
    status_ok "/var/www/specialwash: ${USAGE}%"
elif [[ $USAGE -lt 90 ]]; then
    status_warn "/var/www/specialwash: ${USAGE}%"
else
    status_err "/var/www/specialwash: ${USAGE}% - CRITICAL"
fi

echo ""

# ──────────────────────────────────────────────────────────────
# 6. Database
# ──────────────────────────────────────────────────────────────
echo "🗄️  DATABASE"
echo "─────────────────────────────────────────"

if [[ -f "/var/www/specialwash/data/specialwash.db" ]]; then
    SIZE=$(du -h /var/www/specialwash/data/specialwash.db | cut -f1)
    status_ok "Database exists (${SIZE})"
else
    status_warn "Database not found (will be created on first run)"
fi

echo ""

# ──────────────────────────────────────────────────────────────
# 7. Logs Summary
# ──────────────────────────────────────────────────────────────
echo "📝 RECENT LOGS"
echo "─────────────────────────────────────────"

echo "Backend errors (last 5):"
tail -5 /var/www/specialwash/logs/gunicorn-error.log 2>/dev/null | sed 's/^/  /'

echo ""
echo "Nginx errors (last 5):"
tail -5 /var/www/specialwash/logs/nginx-error.log 2>/dev/null | sed 's/^/  /'

echo ""

# ──────────────────────────────────────────────────────────────
# 8. Summary
# ──────────────────────────────────────────────────────────────
echo "════════════════════════════════════════"
echo "📍 Logs Location:"
echo "   Backend:  journalctl -u specialwash-backend.service -f"
echo "   Nginx:    tail -100 /var/www/specialwash/logs/nginx-error.log"
echo ""
echo "📍 Config:"
echo "   Backend:  /var/www/specialwash/app/backend/.env"
echo "   Nginx:    /etc/nginx/sites-available/specialwash"
echo ""
echo "🔄 Restart Commands:"
echo "   systemctl restart specialwash-backend.service"
echo "   systemctl restart nginx"
echo ""
