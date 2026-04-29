<#
.SYNOPSIS
    CustomERP mock-data seeder launcher (Windows PowerShell).

.DESCRIPTION
    Sets PG* environment variables to the docker-compose.yml defaults and
    invokes 'node seed-mock-data.js' with any arguments you pass through.
    With no arguments it defaults to '--volume medium' (non-destructive;
    tables that already have rows are skipped). Pass --reset to wipe first.

.EXAMPLE
    .\seed.ps1
    Fill the ERP at medium volume.

.EXAMPLE
    .\seed.ps1 --reset --volume large
    Wipe the ERP and refill at large volume.

.EXAMPLE
    .\seed.ps1 --only stock_articles
    Only seed one entity.

.EXAMPLE
    .\seed.ps1 --dry-run
    Plan only, insert nothing.
#>

[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $SeederArgs
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $ScriptDir

if (-not $env:PGHOST)     { $env:PGHOST     = 'localhost' }
if (-not $env:PGPORT)     { $env:PGPORT     = '5432' }
if (-not $env:PGUSER)     { $env:PGUSER     = 'erpuser' }
if (-not $env:PGPASSWORD) { $env:PGPASSWORD = 'erppassword' }
if (-not $env:PGDATABASE) { $env:PGDATABASE = 'erpdb' }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "[seed] 'node' was not found on PATH. Install Node.js 18+ and retry."
    exit 1
}

$seederPath = Join-Path $ScriptDir 'seed-mock-data.js'
if (-not (Test-Path -LiteralPath $seederPath)) {
    Write-Error "[seed] seed-mock-data.js was not found next to this script. Run this from the ROOT of a generated CustomERP project."
    exit 1
}

Write-Host "[seed] Postgres: $($env:PGUSER)@$($env:PGHOST):$($env:PGPORT)/$($env:PGDATABASE)"

if (-not $SeederArgs -or $SeederArgs.Count -eq 0) {
    & node seed-mock-data.js --volume medium
} else {
    & node seed-mock-data.js @SeederArgs
}

exit $LASTEXITCODE
