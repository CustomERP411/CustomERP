# Seed mock data into this ERP

`seed-mock-data.js` is a self-contained, customization-resilient mock-data
generator that lives at the **root of this generated ERP**. It reads
`backend/src/systemConfig.js` and (when present) `sdf.json`, introspects
the live PostgreSQL schema via `information_schema.columns`, and inserts
realistic mock records into every entity table.

> Because the script discovers tables and columns at runtime, it keeps
> working even after you rename fields, add new fields, or even add new
> entities to the generated ERP. Anything it does not recognise is filled
> by a generic introspect-and-fill fallback.

## Prerequisites

- Docker Desktop is running.
- PostgreSQL is reachable from the host (the script uses the same env-var
  rules as `backend/src/repository/db.js` — `PGHOST`, `PGPORT`, `PGUSER`,
  `PGPASSWORD`, `PGDATABASE` or `DATABASE_URL`, with `localhost:5432`
  defaults). The bundled `docker-compose.yml` already publishes Postgres
  on host port 5432 with `erpuser/erppassword/erpdb`.

> The seeder needs three Node packages — `pg`, `uuid`, `bcryptjs`. It
> first tries to load them from `backend/node_modules`; if that's not
> populated on the host (Docker installs deps inside the image, so it
> usually isn't), the script automatically `npm install`s them into a
> sibling `.seed-mock-data-deps/` folder on first run. No manual
> install step is required.

## Quick start (the bulletproof one-liner)

The seeder is a plain Node script that only needs the PG* env vars
exported. This invocation works the same on Linux, macOS and Windows
shells, doesn't care about file permissions, line endings, or Gatekeeper:

```bash
# Linux / macOS / Windows (any shell that can set env vars)
PGHOST=localhost PGPORT=5432 PGUSER=erpuser \
  PGPASSWORD=erppassword PGDATABASE=erpdb \
  node seed-mock-data.js --reset --volume medium
```

```powershell
# Windows PowerShell
$env:PGHOST="localhost"; $env:PGPORT="5432"
$env:PGUSER="erpuser"; $env:PGPASSWORD="erppassword"; $env:PGDATABASE="erpdb"
node seed-mock-data.js --reset --volume medium
```

If you'd rather use the platform launcher scripts, read on.

## Cross-platform launcher scripts

Three thin launcher scripts live next to `seed-mock-data.js`. They set the
`PG*` env vars to the bundled docker-compose defaults and forward any
arguments to `node seed-mock-data.js`. With no arguments they default to
`--volume medium` (non-destructive; tables that already have rows are
skipped). Pass `--reset` if you want to wipe and refill.

| Platform | Command (run from the ERP root) |
|---|---|
| Linux / macOS | `chmod +x seed.sh && ./seed.sh` (or `bash seed.sh`) |
| Windows PowerShell | `.\seed.ps1` |
| Windows cmd | `seed.cmd` |

> **macOS / Linux quick notes**
> - **Do NOT use `sudo`.** The seeder doesn't need root, and `sudo` resets
>   `PATH` to a sanitized list that usually doesn't include Homebrew /
>   `nvm` / `fnm` / `asdf`, so `node` will be reported as "command not
>   found".
> - `permission denied: ./seed.sh` → the Unix execute bit is missing
>   (common after copying from Windows or unzipping on some systems).
>   `chmod +x seed.sh` once, or just call `bash seed.sh` which doesn't
>   need the bit.
> - **CRLF gotcha (`bash seed.sh` prints `: command not found`,
>   `set: invalid option: -`, or `syntax error: unexpected end of file`)**:
>   the file picked up Windows-style `\r\n` line endings during transfer
>   (download, AirDrop with some apps, git checkout with
>   `core.autocrlf=true`, etc.). Strip them in place with
>   `sed -i '' 's/\r$//' seed.sh` (BSD/macOS) or
>   `sed -i 's/\r$//' seed.sh` (Linux), or run `dos2unix seed.sh`. Or
>   just use the Node-direct invocation at the top of this doc and
>   sidestep the shell entirely.
> - **macOS:** `zsh: operation not permitted: ./seed.sh` after `chmod +x`
>   → that's the Gatekeeper quarantine attribute (`com.apple.quarantine`)
>   set on files that arrived via download / zip / AirDrop. Clear it
>   with `xattr -c seed.sh` and try again, or just call `bash seed.sh`
>   which bypasses the path-execution check. If the project folder lives
>   inside iCloud Drive, OneDrive, or a network share, move it to a plain
>   APFS path like `~/Projects/` first — those mounts can also block
>   execution regardless of bits.
> - As a fully launcher-free alternative, you can always call the seeder
>   directly:
>   ```bash
>   PGHOST=localhost PGPORT=5432 PGUSER=erpuser \
>     PGPASSWORD=erppassword PGDATABASE=erpdb \
>     node seed-mock-data.js --reset --volume medium
>   ```

Examples:

```bash
# Linux / macOS
./seed.sh                           # fill at medium volume
./seed.sh --reset --volume large    # wipe then fill at large volume
./seed.sh --only stock_articles     # only seed one entity
./seed.sh --dry-run                 # plan only
```

```powershell
# Windows
.\seed.ps1
.\seed.ps1 --reset --volume large
.\seed.ps1 --only stock_articles
.\seed.ps1 --dry-run
```

## Full demo runbook

```powershell
# 1. Bring up the stack (PostgreSQL, backend, frontend)
.\dev.ps1 start

# 2. Wait until the backend logs show:
#       "Server running on port 3000"
#    and migrations + RBAC seed have completed. Tail logs with:
.\dev.ps1 logs

# 3. Fill the database (env vars are set by the launcher)
.\seed.ps1 --reset --volume medium

# 4. Open the frontend
#    http://localhost:5173
```

If you'd rather call Node directly, you still can — the launchers are just
a convenience wrapper:

```powershell
$env:PGHOST="localhost"; $env:PGPORT="5432"
$env:PGUSER="erpuser"; $env:PGPASSWORD="erppassword"; $env:PGDATABASE="erpdb"
node seed-mock-data.js --reset --volume medium
```

## CLI flags

| Flag | Purpose |
|---|---|
| `--reset` | `TRUNCATE … RESTART IDENTITY CASCADE` every non-system business table first. System tables (`__erp_users` and friends) are preserved so RBAC stays intact. |
| `--volume small \| medium \| large` | Record counts. Default `medium`. |
| `--seed N` | RNG seed for reproducible demo runs. |
| `--only s,s,s` | Only seed the listed entity slugs (everything else skipped). |
| `--skip s,s,s` | Skip the listed entity slugs. |
| `--dry-run` | Print the plan, insert nothing. |

## What gets seeded

- Master data: stock sites, vendor partners, account clients, business
  units, workforce members.
- Demo logins (password `demo`): `ops.demo`, `billing.demo`, `hr.demo`,
  `auditor.demo`, `employee.demo` (linked to a workforce member).
- Stock: stock articles with consistent `quantity` /
  `reserved_quantity` / `committed_quantity` / `available_quantity` and a
  mix of expired / near-expiry / fresh items so the dashboards have
  signal.
- Stock ledger events: an `IN` chain whose net equals each article's
  on-hand, plus realistic `OUT`, `ADJUSTMENT`, and (where multi-location
  is on) `TRANSFER_IN`/`TRANSFER_OUT` rows.
- Stock holds (reservations) across `Pending` / `Released` / `Committed`
  / `Cancelled`.
- Procurement orders + lines, with status mix and matching arrival
  dockets + lines (Posted dockets get a `posted_at`).
- Dispatch orders + lines + stub `sales_orders`/`sales_order_lines` /
  `customers` rows for the auto-added cross-pack tables.
- Audit count sessions + lines with realistic variances.
- Billing dockets + lines with header totals computed from line totals
  (subtotal / discount_total / additional_charges_total / tax_total /
  grand_total / paid_total / outstanding_balance), spread across
  `Draft` / `Sent` / `Paid` / `Overdue` / `Cancelled`.
- Billing settlements + splits for the paid invoices.
- Billing adjustments (Credit / Debit notes).
- HR: time off balances per (employee, year, leave type), time off
  requests across statuses, attendance entries on the configured
  `work_days`, shift plans, timesheet entries (regular + overtime),
  compensation ledger lines for the last three pay periods, plus
  compensation snapshots.
- System: `__audit_logs` CREATE/UPDATE rows pointing at populated
  records, `__reports` daily snapshots covering the last 7 days
  (entity counts, low_stock, expiry, inventory_value).

## Resilience

- Unknown columns in any payload are silently dropped, so customised
  field names never break the run.
- Tables not in any per-entity playbook fall through to the generic
  fallback and still get filled.
- `--reset` only truncates business tables. `__erp_*` tables and
  `__migrations` are preserved so the RBAC seed stays in place.
- Re-running without `--reset` is safe: any table that already has rows
  is skipped (and its rows are still loaded into cache so downstream FKs
  resolve).

## Reusing this script in another generated ERP

This file is self-contained and discovers everything at runtime. Just
copy it into the root of any other CustomERP-generated project and run
`node seed-mock-data.js` from there.
