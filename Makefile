# =====================================================
# CustomERP - Makefile
# =====================================================
# Common commands for development and deployment
# Usage: make <command>
# =====================================================

.PHONY: help dev prod down logs clean migrate build test

# Default target
help:
	@echo "CustomERP - Available Commands:"
	@echo ""
	@echo "  Development:"
	@echo "    make dev          - Start all services in development mode"
	@echo "    make dev-build    - Rebuild and start development services"
	@echo "    make down         - Stop all services"
	@echo "    make logs         - View logs (follow mode)"
	@echo "    make ps           - List running services"
	@echo ""
	@echo "  Database:"
	@echo "    make migrate      - Run database migrations"
	@echo "    make db-shell     - Open PostgreSQL shell"
	@echo "    make pgadmin      - Start pgAdmin UI (port 5050)"
	@echo ""
	@echo "  Production:"
	@echo "    make prod         - Start production services"
	@echo "    make prod-build   - Build and start production"
	@echo ""
	@echo "  Cleanup:"
	@echo "    make clean        - Remove containers and volumes"
	@echo "    make clean-all    - Remove everything including images"
	@echo ""

# ─────────────────────────────────────────────────
# Development
# ─────────────────────────────────────────────────

dev:
	docker compose up

dev-build:
	docker compose up --build

dev-detach:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

# ─────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────

migrate:
	docker compose exec backend npm run migrate

db-shell:
	docker compose exec postgres psql -U postgres -d customwerp

pgadmin:
	docker compose --profile tools up pgadmin -d
	@echo "pgAdmin available at http://localhost:5050"

# ─────────────────────────────────────────────────
# Production
# ─────────────────────────────────────────────────

prod:
	docker compose -f docker-compose.prod.yml up -d

prod-build:
	docker compose -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

# ─────────────────────────────────────────────────
# Cleanup
# ─────────────────────────────────────────────────

clean:
	docker compose down -v --remove-orphans

clean-all:
	docker compose down -v --remove-orphans --rmi all
	docker compose -f docker-compose.prod.yml down -v --remove-orphans --rmi all

# ─────────────────────────────────────────────────
# Individual Services
# ─────────────────────────────────────────────────

backend-shell:
	docker compose exec backend sh

frontend-shell:
	docker compose exec frontend sh

ai-shell:
	docker compose exec ai-gateway sh

# ─────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────

build-backend:
	docker compose build backend

build-frontend:
	docker compose build frontend

build-ai:
	docker compose build ai-gateway

build-all:
	docker compose build

