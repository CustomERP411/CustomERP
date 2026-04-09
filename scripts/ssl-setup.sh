#!/bin/bash
# =====================================================
# CustomERP - Let's Encrypt SSL Setup
# =====================================================
# Obtains a real TLS certificate from Let's Encrypt,
# replacing the temporary self-signed cert created by
# deploy.sh. Run AFTER services are up and DNS points
# to this server.
#
# Usage:
#   sudo ./scripts/ssl-setup.sh
# =====================================================
set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"

# Read domain and email from .env
if [ -f "$APP_DIR/.env" ]; then
    DOMAIN=$(grep -E '^DOMAIN=' "$APP_DIR/.env" | cut -d= -f2)
    EMAIL=$(grep -E '^CERTBOT_EMAIL=' "$APP_DIR/.env" | cut -d= -f2)
fi
DOMAIN=${DOMAIN:-customerp.site}
EMAIL=${EMAIL:-admin@customerp.site}

echo ""
echo "============================================"
echo "  CustomERP - SSL Certificate Setup"
echo "============================================"
echo "  Domain: $DOMAIN"
echo "  Email:  $EMAIL"
echo "============================================"
echo ""

# Verify DNS resolves to this server
echo "[1/4] Verifying DNS..."
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")
DNS_IP=$(dig +short "$DOMAIN" 2>/dev/null | tail -1 || echo "unresolved")

echo "  Server IP: $SERVER_IP"
echo "  DNS resolves to: $DNS_IP"

if [ "$SERVER_IP" != "$DNS_IP" ]; then
    echo ""
    echo "  WARNING: DNS for $DOMAIN does not point to this server."
    echo "  Let's Encrypt will fail if DNS is not configured."
    echo ""
    read -p "  Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        echo "  Aborted. Configure DNS first, then re-run this script."
        exit 1
    fi
fi

# Request certificate via certbot container
echo "[2/4] Requesting Let's Encrypt certificate..."
docker compose -f "$COMPOSE_FILE" run --rm certbot \
    certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal

# Reload nginx to pick up the new cert
echo "[3/4] Reloading nginx..."
docker compose -f "$COMPOSE_FILE" exec nginx nginx -s reload

# Set up auto-renewal cron if not already present
echo "[4/4] Setting up auto-renewal cron..."
CRON_CMD="0 0,12 * * * cd $APP_DIR && docker compose -f docker-compose.prod.yml run --rm certbot certbot renew --quiet && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload"

if ! (crontab -l 2>/dev/null | grep -q "certbot renew"); then
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "  Renewal cron installed (runs twice daily)"
else
    echo "  Renewal cron already exists, skipping"
fi

echo ""
echo "============================================"
echo "  SSL setup complete!"
echo "  https://$DOMAIN should now work."
echo "  Certificates auto-renew via cron."
echo "============================================"
echo ""
