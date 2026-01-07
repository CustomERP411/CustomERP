#!/bin/bash
# =====================================================
# CustomERP - Development Script (Bash)
# =====================================================
# Usage: ./scripts/dev.sh [command]
# =====================================================

set -e

COMMAND=${1:-help}

show_help() {
    echo ""
    echo "CustomERP - Development Commands"
    echo "================================="
    echo ""
    echo "Usage: ./scripts/dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start       - Start all services in Docker"
    echo "  stop/down   - Stop all services"
    echo "  restart     - Restart all services"
    echo "  logs        - View logs (follow mode)"
    echo "  build       - Rebuild all containers"
    echo "  clean       - Remove containers and volumes"
    echo "  migrate     - Run database migrations"
    echo "  db          - Open PostgreSQL shell"
    echo "  pgadmin     - Start pgAdmin UI"
    echo "  status      - Show running services"
    echo ""
}

start_services() {
    echo "Starting CustomERP services..."
    docker compose up -d
    echo ""
    echo "Services started!"
    echo "  Frontend: http://localhost:5173"
    echo "  Backend:  http://localhost:3000"
    echo "  AI Gateway: http://localhost:8000"
    echo ""
    echo "Run './scripts/dev.sh logs' to view logs"
}

stop_services() {
    echo "Stopping CustomERP services..."
    docker compose down
    echo "Services stopped."
}

case $COMMAND in
    help)
        show_help
        ;;
    start)
        start_services
        ;;
    stop|down)
        stop_services
        ;;
    restart)
        stop_services
        start_services
        ;;
    logs)
        docker compose logs -f
        ;;
    build)
        docker compose up -d --build
        ;;
    clean)
        docker compose down -v --remove-orphans
        ;;
    migrate)
        docker compose exec backend npm run migrate
        ;;
    db)
        # Use container env so custom POSTGRES_* in `.env` works
        docker compose exec postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
        ;;
    pgadmin)
        docker compose --profile tools up pgadmin -d
        echo "pgAdmin available at http://localhost:5050"
        ;;
    status)
        docker compose ps
        ;;
    *)
        echo "Unknown command: $COMMAND"
        show_help
        ;;
esac

