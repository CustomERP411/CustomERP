#!/bin/bash
# =====================================================
# CustomERP - Update Production Deployment
# =====================================================
# Run from the project root:
#   sudo ./scripts/update.sh
# =====================================================
set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"

echo ""
echo "============================================"
echo "  CustomERP - Production Update"
echo "============================================"
echo ""

cd "$APP_DIR"

# Pull latest code
echo "[1/4] Pulling latest code..."
git pull origin main

# Rebuild changed services
echo "[2/4] Rebuilding containers..."
docker compose -f "$COMPOSE_FILE" build

# Restart with zero-downtime (recreate only changed)
echo "[3/4] Restarting services..."
docker compose -f "$COMPOSE_FILE" up -d

# Clean up old images
echo "[4/4] Cleaning up old images..."
docker image prune -f

# Health check
echo ""
echo "Waiting for health check..."
sleep 8
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo "  Health check: OK (200)"
else
    echo "  Health check: WARNING (HTTP $HTTP_CODE)"
    echo "  Check logs: docker compose -f $COMPOSE_FILE logs -f"
fi

echo ""
echo "Update complete. Current status:"
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}"
echo ""
