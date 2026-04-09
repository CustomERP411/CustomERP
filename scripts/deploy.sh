#!/bin/bash
# =====================================================
# CustomERP - First-Time Production Deployment
# =====================================================
# Run on a fresh Ubuntu 22.04+ droplet:
#   chmod +x scripts/deploy.sh
#   sudo ./scripts/deploy.sh
# =====================================================
set -e

DOMAIN="customerp.site"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"

echo ""
echo "============================================"
echo "  CustomERP - Production Deployment"
echo "============================================"
echo "  Domain:  $DOMAIN"
echo "  App dir: $APP_DIR"
echo "============================================"
echo ""

# ─── 1. System updates ──────────────────────────────
echo "[1/7] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# ─── 2. Install Docker if missing ───────────────────
if ! command -v docker &> /dev/null; then
    echo "[2/7] Installing Docker Engine..."
    apt-get install -y -qq ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "  Docker installed: $(docker --version)"
else
    echo "[2/7] Docker already installed: $(docker --version)"
fi

# ─── 3. Configure firewall ──────────────────────────
echo "[3/7] Configuring UFW firewall..."
if command -v ufw &> /dev/null; then
    ufw allow OpenSSH
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    echo "  Firewall: SSH, HTTP, HTTPS allowed"
else
    echo "  UFW not found, skipping firewall config"
fi

# ─── 4. Set up .env ─────────────────────────────────
echo "[4/7] Setting up environment..."
if [ ! -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/.env.production.example" "$APP_DIR/.env"
    echo ""
    echo "  *** IMPORTANT ***"
    echo "  .env file created from template."
    echo "  You MUST edit it with real values before continuing:"
    echo ""
    echo "    nano $APP_DIR/.env"
    echo ""
    echo "  Required: POSTGRES_PASSWORD, JWT_SECRET, AI API keys"
    echo ""
    read -p "  Press Enter after editing .env to continue..." _
else
    echo "  .env already exists, skipping"
fi

# ─── 5. Create self-signed cert for initial boot ────
echo "[5/7] Preparing TLS certificates..."
CERT_DIR="$APP_DIR/certbot/conf/live/$DOMAIN"
if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
    mkdir -p "$CERT_DIR"
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout "$CERT_DIR/privkey.pem" \
        -out "$CERT_DIR/fullchain.pem" \
        -subj "/CN=$DOMAIN" 2>/dev/null
    echo "  Temporary self-signed cert created (will be replaced by Let's Encrypt)"
else
    echo "  Certificates already exist"
fi

# Map the local certbot dir into the Docker volume on first run
# by pre-populating it if the named volume is empty.
docker volume create customwerp_certbot_certs 2>/dev/null || true
docker run --rm \
    -v customwerp_certbot_certs:/etc/letsencrypt \
    -v "$CERT_DIR/fullchain.pem:/tmp/fullchain.pem:ro" \
    -v "$CERT_DIR/privkey.pem:/tmp/privkey.pem:ro" \
    alpine sh -c "
        mkdir -p /etc/letsencrypt/live/$DOMAIN &&
        cp /tmp/fullchain.pem /etc/letsencrypt/live/$DOMAIN/fullchain.pem &&
        cp /tmp/privkey.pem /etc/letsencrypt/live/$DOMAIN/privkey.pem
    "

# ─── 6. Build and start ─────────────────────────────
echo "[6/7] Building and starting services..."
cd "$APP_DIR"
docker compose -f docker-compose.prod.yml up -d --build

echo "  Waiting for services to become healthy..."
sleep 10

# ─── 7. Summary ─────────────────────────────────────
echo ""
echo "[7/7] Deployment complete!"
echo ""
echo "============================================"
echo "  Services:"
docker compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}"
echo ""
echo "  Next steps:"
echo "    1. Point DNS for $DOMAIN to this server's IP"
echo "    2. Run: sudo ./scripts/ssl-setup.sh"
echo "       to obtain a real Let's Encrypt certificate"
echo "    3. Set up backups: sudo crontab -e"
echo "       0 3 * * * $APP_DIR/scripts/backup.sh"
echo "    4. Set up monitoring: sudo crontab -e"
echo "       */5 * * * * $APP_DIR/scripts/health-monitor.sh"
echo "============================================"
echo ""
