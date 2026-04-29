@echo off
REM CustomERP mock-data seeder launcher (Windows cmd / PowerShell).
REM
REM Sets PG* environment variables to the docker-compose.yml defaults and
REM invokes 'node seed-mock-data.js' with any arguments you pass through.
REM With no arguments it defaults to '--volume medium' (non-destructive;
REM tables that already have rows are skipped). Pass --reset to wipe first.
REM
REM Examples:
REM   seed.cmd
REM   seed.cmd --reset --volume large
REM   seed.cmd --only stock_articles
REM   seed.cmd --dry-run

setlocal

cd /d "%~dp0"

if not defined PGHOST     set "PGHOST=localhost"
if not defined PGPORT     set "PGPORT=5432"
if not defined PGUSER     set "PGUSER=erpuser"
if not defined PGPASSWORD set "PGPASSWORD=erppassword"
if not defined PGDATABASE set "PGDATABASE=erpdb"

where node >nul 2>nul
if errorlevel 1 (
    echo [seed] 'node' was not found on PATH. Install Node.js 18+ and retry.
    exit /b 1
)

if not exist "%~dp0seed-mock-data.js" (
    echo [seed] seed-mock-data.js was not found next to this script.
    echo        Run this from the ROOT of a generated CustomERP project.
    exit /b 1
)

echo [seed] Postgres: %PGUSER%@%PGHOST%:%PGPORT%/%PGDATABASE%

if "%~1"=="" (
    node seed-mock-data.js --volume medium
) else (
    node seed-mock-data.js %*
)

set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
