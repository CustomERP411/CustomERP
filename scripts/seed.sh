#!/usr/bin/env bash
# CustomERP mock-data seeder launcher (Linux + macOS).
#
# Run this from anywhere — it cd's to its own directory and invokes
#   node seed-mock-data.js <args>
# If you don't pass any args, it defaults to "--volume medium" (non-destructive;
# tables that already have rows are skipped). Pass --reset to wipe first.
#
# Examples:
#   ./seed.sh                                # fill the ERP at medium volume
#   ./seed.sh --reset --volume large         # wipe, then fill at large volume
#   ./seed.sh --only stock_articles          # only seed one entity
#   ./seed.sh --dry-run                      # plan only
#
# Heads-up
#   - "command not found", "set: invalid option: -", or
#     "syntax error: unexpected end of file" almost always means the file
#     picked up Windows-style \r\n line endings in transit. Strip them
#     in place with `sed -i '' 's/\r$//' seed.sh` (BSD/macOS) or
#     `sed -i 's/\r$//' seed.sh` (Linux). Or skip the wrapper and call
#     `node seed-mock-data.js` directly with the PG* env vars set.
#   - If you see "permission denied: ./seed.sh", run `chmod +x seed.sh`
#     once (the execute bit is dropped on Windows hosts), or just use
#     `bash seed.sh` which doesn't need the bit.
#   - macOS only: if you see "zsh: operation not permitted: ./seed.sh"
#     after chmod +x, that's the Gatekeeper quarantine attribute on a
#     downloaded/unzipped file. Clear it with `xattr -c seed.sh` and try
#     again, or just use `bash seed.sh` which bypasses the path-exec
#     check. iCloud Drive / OneDrive / network shares can also block
#     execution regardless of the +x bit — move the project into a plain
#     APFS path like ~/Projects/ if the xattr fix doesn't help.
#   - Don't run this with `sudo`. The script doesn't need root, and sudo
#     resets PATH to a sanitized list that usually drops Homebrew, nvm,
#     fnm and asdf — so `node` gets reported as "command not found".

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Defaults match the bundled docker-compose.yml. Env vars already set by the
# caller are preserved so you can point this at any reachable Postgres.
export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-erpuser}"
export PGPASSWORD="${PGPASSWORD:-erppassword}"
export PGDATABASE="${PGDATABASE:-erpdb}"

if ! command -v node >/dev/null 2>&1; then
  echo "[seed] 'node' was not found on PATH. Install Node.js 18+ and retry." >&2
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/seed-mock-data.js" ]; then
  echo "[seed] seed-mock-data.js was not found next to this script." >&2
  echo "       Run this from the ROOT of a generated CustomERP project." >&2
  exit 1
fi

echo "[seed] Postgres: $PGUSER@$PGHOST:$PGPORT/$PGDATABASE"

if [ "$#" -eq 0 ]; then
  exec node seed-mock-data.js --volume medium
else
  exec node seed-mock-data.js "$@"
fi
