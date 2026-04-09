#!/bin/bash
# =====================================================
# CustomERP - PostgreSQL Restore
# =====================================================
# Usage:
#   sudo ./scripts/restore.sh backups/customwerp_20260409_030000.sql.gz
# =====================================================
set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.yml"
BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file>"
    echo ""
    echo "Available backups:"
    ls -lh "$APP_DIR/backups/"customwerp_*.sql.gz 2>/dev/null || echo "  (none found)"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    BACKUP_FILE="$APP_DIR/$BACKUP_FILE"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $1"
    exit 1
fi

# Read DB credentials from .env
if [ -f "$APP_DIR/.env" ]; then
    PG_USER=$(grep -E '^POSTGRES_USER=' "$APP_DIR/.env" | cut -d= -f2)
    PG_DB=$(grep -E '^POSTGRES_DB=' "$APP_DIR/.env" | cut -d= -f2)
fi
PG_USER=${PG_USER:-customwerp}
PG_DB=${PG_DB:-customwerp}

echo ""
echo "============================================"
echo "  CustomERP - Database Restore"
echo "============================================"
echo "  Backup:   $(basename "$BACKUP_FILE")"
echo "  Database:  $PG_DB"
echo "  User:      $PG_USER"
echo "============================================"
echo ""
echo "  WARNING: This will OVERWRITE the current database."
echo ""
read -p "  Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "  Restore cancelled."
    exit 0
fi

echo ""
echo "Restoring database..."

gunzip -c "$BACKUP_FILE" \
    | docker compose -f "$COMPOSE_FILE" exec -T postgres \
        psql -U "$PG_USER" -d "$PG_DB" --quiet --no-psqlrc

echo ""
echo "Restore complete."
echo ""
