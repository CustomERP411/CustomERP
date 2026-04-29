@echo off
REM ============================================================
REM  CustomERP mock-data seeder - SQLite / standalone-bundle edition
REM  (Windows cmd / PowerShell launcher)
REM
REM  Drop this file together with seed-mock-data-sqlite.js (or
REM  seed-mock-data-sqlite.template.js) into the ROOT of a
REM  STANDALONE-PACKAGED CustomERP bundle - the folder that
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

setlocal EnableExtensions EnableDelayedExpansion

REM Switch into the bundle root regardless of how the launcher was invoked.
REM From here on we ONLY use bare relative filenames - this avoids any
REM %~dp0 / unicode / parens-in-path quirks (e.g. folders called
REM "Ankara Taze Cicek-windows-x64 (1)") that have bitten previous
REM versions of this script.
cd /d "%~dp0" || (
    echo [seed] Could not cd into the launcher's directory.
    echo        %~dp0
    exit /b 1
)

REM Find the seeder script. Accept either the renamed copy
REM ("seed-mock-data-sqlite.js") or the platform-side template name
REM ("seed-mock-data-sqlite.template.js") so users don't have to rename
REM after copying it in.
set "SCRIPT_PATH="
if exist "seed-mock-data-sqlite.js"          set "SCRIPT_PATH=seed-mock-data-sqlite.js"
if not defined SCRIPT_PATH if exist "seed-mock-data-sqlite.template.js" set "SCRIPT_PATH=seed-mock-data-sqlite.template.js"

if not defined SCRIPT_PATH (
    echo [seed] Seeder script was not found next to this launcher.
    echo        CWD : !CD!
    echo        Looked for these filenames in the current directory:
    echo          - seed-mock-data-sqlite.js
    echo          - seed-mock-data-sqlite.template.js
    echo.
    echo        Files actually present here ^(*.js / *.cmd^):
    for %%F in (*.js *.cmd) do echo          - %%F
    echo.
    echo        This launcher must live in the same folder as the seeder
    echo        script, app\, data\ and runtime\.
    exit /b 1
)

REM Pick the Node binary: bundled runtime first, then system Node.
set "NODE_BIN="
if exist "runtime\node.exe" set "NODE_BIN=runtime\node.exe"
if not defined NODE_BIN (
    where node >nul 2>nul
    if not errorlevel 1 set "NODE_BIN=node"
)

if not defined NODE_BIN (
    echo [seed] No Node runtime found.
    echo        Looked for the bundled runtime at: !CD!\runtime\node.exe
    echo        Then fell back to looking for 'node' on PATH - also missing.
    echo.
    echo        The standalone bundle should ship runtime\node.exe. If you
    echo        only have part of the bundle, re-extract the original ZIP.
    exit /b 1
)

echo [seed] Seeder script   : !SCRIPT_PATH!
echo [seed] Node runtime    : !NODE_BIN!
if defined SQLITE_PATH (
    echo [seed] SQLite database : !SQLITE_PATH!
) else (
    echo [seed] SQLite database : !CD!\data\erp.db
)

if "%~1"=="" (
    "!NODE_BIN!" "!SCRIPT_PATH!" --volume medium
) else (
    "!NODE_BIN!" "!SCRIPT_PATH!" %*
)

set "EXIT_CODE=!ERRORLEVEL!"
endlocal & exit /b %EXIT_CODE%
