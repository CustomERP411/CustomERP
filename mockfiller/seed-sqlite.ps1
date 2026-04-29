# ============================================================
#  CustomERP mock-data seeder - SQLite / standalone-bundle edition
#  (PowerShell launcher)
#
#  Drop this together with seed-mock-data-sqlite.js into the ROOT
#  of a standalone-packaged CustomERP bundle (the folder that
#  contains app\, data\, runtime\ and start.bat).
#
#  Usage:
#    .\seed-sqlite.ps1
#    .\seed-sqlite.ps1 --reset --volume large
#    .\seed-sqlite.ps1 --only stock_articles
#
#  If you hit "running scripts is disabled on this system", run:
#    powershell -ExecutionPolicy Bypass -File .\seed-sqlite.ps1
#  or use seed-sqlite.cmd instead.
# ============================================================

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

$ScriptPath = Join-Path $PSScriptRoot 'seed-mock-data-sqlite.js'
if (-not (Test-Path $ScriptPath)) {
    Write-Host "[seed] seed-mock-data-sqlite.js was not found next to this launcher." -ForegroundColor Red
    Write-Host "       CWD: $PSScriptRoot"
    Write-Host "       This launcher must live in the same folder as the seeder script,"
    Write-Host "       app\, data\ and runtime\."
    exit 1
}

# Prefer bundled runtime\node.exe, then system Node.
$BundledNode = Join-Path $PSScriptRoot 'runtime\node.exe'
$NodeBin = $null
if (Test-Path $BundledNode) {
    $NodeBin = $BundledNode
} else {
    $sys = Get-Command node -ErrorAction SilentlyContinue
    if ($sys) { $NodeBin = $sys.Source }
}

if (-not $NodeBin) {
    Write-Host "[seed] No Node runtime found." -ForegroundColor Red
    Write-Host "       Looked for the bundled runtime at: $BundledNode"
    Write-Host "       Then fell back to looking for 'node' on PATH - also missing."
    Write-Host ""
    Write-Host "       The standalone bundle should ship runtime\node.exe. If you"
    Write-Host "       only have part of the bundle, re-extract the original ZIP."
    exit 1
}

Write-Host "[seed] Using Node runtime: $NodeBin"
if ($env:SQLITE_PATH) {
    Write-Host "[seed] SQLite database: $($env:SQLITE_PATH)"
} else {
    Write-Host "[seed] SQLite database: $(Join-Path $PSScriptRoot 'data\erp.db')"
}

$ForwardArgs = $args
if ($ForwardArgs.Count -eq 0) {
    $ForwardArgs = @('--volume', 'medium')
}

& $NodeBin $ScriptPath @ForwardArgs
exit $LASTEXITCODE
