#!/bin/bash
# =====================================================
# CustomERP - PostgreSQL Backup
# =====================================================
# Usage:
#   sudo ./scripts/backup.sh
#
# Cron (daily at 3 AM):
#   0 3 * * * /path/to/CustomERP/scripts/backup.sh >> /var/log/customwerp-backup.log 2>&1
# =====================================================
set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"
BACKUP_DIR="$APP_DIR/backups"
RETENTION_DAYS=${RETENTION_DAYS:-30}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/customwerp_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting PostgreSQL backup..."

# Read DB credentials from .env
if [ -f "$APP_DIR/.env" ]; then
    PG_USER=$(grep -E '^POSTGRES_USER=' "$APP_DIR/.env" | cut -d= -f2)
    PG_DB=$(grep -E '^POSTGRES_DB=' "$APP_DIR/.env" | cut -d= -f2)
fi
PG_USER=${PG_USER:-customwerp}
PG_DB=${PG_DB:-customwerp}

# Dump and compress
docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U "$PG_USER" -d "$PG_DB" --clean --if-exists \
    | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# Prune old backups
DELETED=$(find "$BACKUP_DIR" -name "customwerp_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "[$(date)] Pruned $DELETED backup(s) older than $RETENTION_DAYS days"
fi

TOTAL=$(find "$BACKUP_DIR" -name "customwerp_*.sql.gz" | wc -l)
echo "[$(date)] Backup complete. $TOTAL backup(s) on disk."
