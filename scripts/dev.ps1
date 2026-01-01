# =====================================================
# CustomERP - Development Script (PowerShell)
# =====================================================
# Usage: .\scripts\dev.ps1 [command]
# =====================================================

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

$ErrorActionPreference = "Stop"

function Show-Help {
    Write-Host ""
    Write-Host "CustomERP - Development Commands" -ForegroundColor Cyan
    Write-Host "=================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\scripts\dev.ps1 [command]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  start       - Start all services in Docker"
    Write-Host "  stop/down   - Stop all services"
    Write-Host "  restart     - Restart all services"
    Write-Host "  logs        - View logs (follow mode)"
    Write-Host "  build       - Rebuild all containers"
    Write-Host "  clean       - Remove containers and volumes"
    Write-Host "  migrate     - Run database migrations"
    Write-Host "  db          - Open PostgreSQL shell"
    Write-Host "  pgadmin     - Start pgAdmin UI"
    Write-Host "  status      - Show running services"
    Write-Host "  local       - Start services locally (without Docker)"
    Write-Host ""
}

function Start-Services {
    Write-Host "Starting CustomERP services..." -ForegroundColor Green
    docker compose up -d
    Write-Host ""
    Write-Host "Services started!" -ForegroundColor Green
    Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
    Write-Host "  Backend:  http://localhost:3000" -ForegroundColor Cyan
    Write-Host "  AI Gateway: http://localhost:8000" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Run '.\scripts\dev.ps1 logs' to view logs" -ForegroundColor Yellow
}

function Stop-Services {
    Write-Host "Stopping CustomERP services..." -ForegroundColor Yellow
    docker compose down
    Write-Host "Services stopped." -ForegroundColor Green
}

function Start-Local {
    Write-Host "Starting services locally (without Docker)..." -ForegroundColor Green
    Write-Host ""
    
    # Check if PostgreSQL is needed
    Write-Host "Note: Make sure PostgreSQL is running locally or use Docker for database:" -ForegroundColor Yellow
    Write-Host "  docker compose up postgres -d" -ForegroundColor Cyan
    Write-Host ""
    
    # Start services in separate windows
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd platform\backend; npm run dev"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd platform\frontend; npm run dev"
    
    Write-Host "Started backend and frontend in separate windows." -ForegroundColor Green
}

switch ($Command.ToLower()) {
    "help" { Show-Help }
    "start" { Start-Services }
    "stop" { Stop-Services }
    "down" { Stop-Services }
    "restart" { Stop-Services; Start-Services }
    "logs" { docker compose logs -f }
    "build" { docker compose up -d --build }
    "clean" { docker compose down -v --remove-orphans }
    "migrate" { docker compose exec backend npm run migrate }
    "db" { docker compose exec postgres psql -U postgres -d customwerp }
    "pgadmin" { 
        docker compose --profile tools up pgadmin -d
        Write-Host "pgAdmin available at http://localhost:5050" -ForegroundColor Cyan
    }
    "status" { docker compose ps }
    "local" { Start-Local }
    default { 
        Write-Host "Unknown command: $Command" -ForegroundColor Red
        Show-Help 
    }
}

