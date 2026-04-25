<#
.SYNOPSIS
    Run a single unit test by its TC id (e.g. TC-UC1-008 or TC-UC11.3-003).

.DESCRIPTION
    Finds the test whose Jest title contains the given TC id and runs only
    that test. Works for any TC id whose title is prefixed with the id
    (e.g. `TC-UC11.3-003 — missing or empty reason...`).

.PARAMETER Id
    The TC identifier (e.g. TC-UC1-008, TC-UC11.3-003).

.PARAMETER Verbose
    Implicit: Jest is always run with --verbose so the TC title shows.

.EXAMPLE
    .\scripts\Run-TC.ps1 TC-UC1-008
    .\scripts\Run-TC.ps1 TC-UC11.3-003
#>
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Id
)

$testsRoot = Split-Path -Parent $PSScriptRoot
Push-Location $testsRoot
try {
    # Escape regex meta-characters (., -) so a TC id like TC-UC11.3-003
    # matches only itself, not "TC-UC11x3-003".
    $pattern = [regex]::Escape($Id)
    Write-Host "[Run-TC] Running: $Id" -ForegroundColor Cyan

    # Jest writes output to stderr; merge streams via cmd and then filter
    # down to only the lines that are relevant to THIS test case:
    #   - any [TC-<Id>] tcLog line (input / expected / got)
    #   - the test result line (√ TC-<Id> — ... or × TC-<Id> — ...)
    #   - the final "Tests:" summary
    $lines = cmd /c "npx jest -t `"$pattern`" --verbose 2>&1"

    $foundCount = 0
    foreach ($line in $lines) {
        if (
            $line -match [regex]::Escape($Id) -or
            $line -match '^Tests:\s'
        ) {
            if ($line -match '\bpassed\b') {
                Write-Host $line -ForegroundColor Green
            }
            elseif ($line -match '\bfailed\b') {
                Write-Host $line -ForegroundColor Red
            }
            else {
                Write-Host $line
            }

            # Count matches by looking for "N passed" / "N failed" in the
            # Jest summary line — this is robust to Windows encoding of √/×.
            if ($line -match '^Tests:') {
                if ($line -match '(\d+)\s+passed') { $foundCount += [int]$Matches[1] }
                if ($line -match '(\d+)\s+failed') { $foundCount += [int]$Matches[1] }
            }
        }
    }

    if ($foundCount -eq 0) {
        Write-Host "[Run-TC] No matching test found for '$Id'." -ForegroundColor Yellow
    }
}
finally {
    Pop-Location
}
