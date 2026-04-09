#!/bin/bash
# =====================================================
# CustomERP - Health Monitor
# =====================================================
# Checks service health and logs results.
# Exits nonzero if any check fails (useful for alerting).
#
# Cron (every 5 minutes):
#   */5 * * * * /path/to/CustomERP/scripts/health-monitor.sh >> /var/log/customwerp-health.log 2>&1
# =====================================================

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
FAILURES=0

log() {
    echo "[$TIMESTAMP] $1"
}

check_http() {
    local name="$1" url="$2"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        log "OK   $name (HTTP $HTTP_CODE)"
    else
        log "FAIL $name (HTTP $HTTP_CODE)"
        FAILURES=$((FAILURES + 1))
    fi
}

check_container() {
    local name="$1"
    STATUS=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null || echo "missing")
    if [ "$STATUS" = "running" ]; then
        log "OK   container $name ($STATUS)"
    else
        log "FAIL container $name ($STATUS)"
        FAILURES=$((FAILURES + 1))
    fi
}

# ─── Service checks ─────────────────────────────────
check_http "backend-health" "http://localhost/health"
check_container "customwerp-postgres"
check_container "customwerp-backend"
check_container "customwerp-frontend"
check_container "customwerp-ai-gateway"
check_container "customwerp-nginx"

# ─── Disk usage ──────────────────────────────────────
DISK_USAGE=$(df / --output=pcent | tail -1 | tr -d ' %')
if [ "$DISK_USAGE" -gt 90 ]; then
    log "WARN disk usage at ${DISK_USAGE}%"
    FAILURES=$((FAILURES + 1))
else
    log "OK   disk usage at ${DISK_USAGE}%"
fi

# ─── Memory usage ────────────────────────────────────
MEM_AVAILABLE=$(free -m | awk '/Mem:/ {print $7}')
if [ "$MEM_AVAILABLE" -lt 256 ]; then
    log "WARN available memory: ${MEM_AVAILABLE}MB"
    FAILURES=$((FAILURES + 1))
else
    log "OK   available memory: ${MEM_AVAILABLE}MB"
fi

# ─── Docker volume disk ─────────────────────────────
PG_VOLUME_SIZE=$(docker system df -v 2>/dev/null | grep "customwerp.*postgres_data" | awk '{print $4}' || echo "?")
log "INFO postgres volume: $PG_VOLUME_SIZE"

# ─── Summary ─────────────────────────────────────────
if [ "$FAILURES" -gt 0 ]; then
    log "RESULT: $FAILURES failure(s) detected"
    exit 1
else
    log "RESULT: All checks passed"
    exit 0
fi
