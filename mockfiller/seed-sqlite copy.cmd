@echo off
REM ============================================================
REM  CustomERP mock-data seeder — SQLite / standalone-bundle edition
REM  (Windows cmd / PowerShell launcher)
REM
REM  Drop this file together with seed-mock-data-sqlite.js into the
REM  ROOT of a STANDALONE-PACKAGED CustomERP bundle — the folder that
REM  contains app\, data\, runtime\ and start.bat.
REM
REM  With no arguments it runs '--volume medium' (non-destructive;
REM  tables that already have rows are skipped). Pass --reset to wipe
REM  business tables first (system tables like __erp_users are kept).
REM
REM  Examples:
REM    seed-sqlite.cmd
REM    seed-sqlite.cmd --reset --volume large
REM    seed-sqlite.cmd --only stock_articles
REM    seed-sqlite.cmd --dry-run
REM ============================================================

setlocal

cd /d "%~dp0"

REM Accept either the renamed copy ("seed-mock-data-sqlite.js") or the
REM platform-side template name ("seed-mock-data-sqlite.template.js"),
REM so users don't have to rename the file after copying it in.
set "SCRIPT_PATH=%~dp0seed-mock-data-sqlite.js"
if not exist "%SCRIPT_PATH%" set "SCRIPT_PATH=%~dp0seed-mock-data-sqlite.template.js"
if not exist "%SCRIPT_PATH%" (
    echo [seed] Seeder script was not found next to this launcher.
    echo        CWD: %CD%
    echo        Looked for:
    echo          - %~dp0seed-mock-data-sqlite.js
    echo          - %~dp0seed-mock-data-sqlite.template.js
    echo        This launcher must live in the same folder as:
    echo          - the seeder script (one of the two filenames above^)
    echo          - app\                      (the packaged backend^)
    echo          - data\                     (where erp.db lives^)
    echo          - runtime\node.exe          (the bundled Node runtime^)
    exit /b 1
)

REM Pick the Node binary: bundled runtime first, then system Node.
set "NODE_BIN="
if exist "%~dp0runtime\node.exe" set "NODE_BIN=%~dp0runtime\node.exe"
if not defined NODE_BIN (
    where node >nul 2>nul
    if not errorlevel 1 set "NODE_BIN=node"
)

if not defined NODE_BIN (
    echo [seed] No Node runtime found.
    echo        Looked for the bundled runtime at: %~dp0runtime\node.exe
    echo        Then fell back to looking for 'node' on PATH — also missing.
    echo.
    echo        The standalone bundle should ship runtime\node.exe. If you
    echo        only have part of the bundle, re-extract the original ZIP.
    exit /b 1
)

echo [seed] Using Node runtime: "%NODE_BIN%"
if defined SQLITE_PATH (
    echo [seed] SQLite database: %SQLITE_PATH%
) else (
    echo [seed] SQLite database: %~dp0data\erp.db
)

if "%~1"=="" (
    "%NODE_BIN%" "%SCRIPT_PATH%" --volume medium
) else (
    "%NODE_BIN%" "%SCRIPT_PATH%" %*
)

set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
