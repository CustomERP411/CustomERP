#!/bin/bash
cd "$(dirname "$0")"

echo ""
echo "  ============================================"
echo "    Your ERP Application"
echo "  ============================================"
echo ""
echo "  Starting up... please wait."
echo "  Your browser will open automatically."
echo ""

if [ ! -f "./runtime/bin/node" ]; then
    echo "  ERROR: Could not find the application runtime."
    echo "  Make sure you extracted the entire ZIP file,"
    echo "  not just individual files from inside it."
    echo ""
    exit 1
fi

if [ ! -f "./app/src/index.js" ]; then
    echo "  ERROR: Application files are missing."
    echo "  Make sure you extracted the entire ZIP file."
    echo ""
    exit 1
fi

echo "  Once started, open your browser to:"
echo "  http://localhost:3000"
echo ""
echo "  To stop the application, press Ctrl+C."
echo "  ============================================"
echo ""

./runtime/bin/node app/src/index.js
