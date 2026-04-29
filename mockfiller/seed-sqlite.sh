#!/bin/bash
# ============================================================
#  CustomERP mock-data seeder — SQLite / standalone-bundle edition
#  (macOS / Linux launcher)
#
#  Drop this together with seed-mock-data-sqlite.js into the ROOT
#  of a standalone-packaged CustomERP bundle — the folder that
#  contains app/, data/, runtime/ and start.command/start.sh.
#
#  Usage:
#    ./seed-sqlite.sh
#    ./seed-sqlite.sh --reset --volume large
#    ./seed-sqlite.sh --only stock_articles
#
#  Troubleshooting:
#    - "permission denied":           chmod +x seed-sqlite.sh
#    - "command not found" with sudo: do NOT use sudo, just ./seed-sqlite.sh
#    - "syntax error: unexpected end of file" / ": command not found":
#        the file has Windows CRLF line endings. Strip them with:
#          sed -i '' 's/\r$//' seed-sqlite.sh   # macOS
#          dos2unix seed-sqlite.sh              # Linux (or sed -i ...)
# ============================================================

set -e

cd "$(dirname "$0")"
HERE="$(pwd)"

SCRIPT_PATH="$HERE/seed-mock-data-sqlite.js"
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "[seed] seed-mock-data-sqlite.js was not found next to this launcher."
    echo "       CWD: $HERE"
    echo "       This launcher must live in the same folder as the seeder script,"
    echo "       app/, data/ and runtime/."
    exit 1
fi

# Prefer the bundled runtime, then fall back to system node.
BUNDLED_NODE="$HERE/runtime/bin/node"
if [ -x "$BUNDLED_NODE" ]; then
    NODE_BIN="$BUNDLED_NODE"
elif command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
else
    echo "[seed] No Node runtime found."
    echo "       Looked for the bundled runtime at: $BUNDLED_NODE"
    echo "       Then fell back to looking for 'node' on PATH — also missing."
    echo ""
    echo "       The standalone bundle should ship runtime/bin/node. If you"
    echo "       only have part of the bundle, re-extract the original archive."
    exit 1
fi

echo "[seed] Using Node runtime: $NODE_BIN"
if [ -n "${SQLITE_PATH:-}" ]; then
    echo "[seed] SQLite database: $SQLITE_PATH"
else
    echo "[seed] SQLite database: $HERE/data/erp.db"
fi

if [ "$#" -eq 0 ]; then
    "$NODE_BIN" "$SCRIPT_PATH" --volume medium
else
    "$NODE_BIN" "$SCRIPT_PATH" "$@"
fi
