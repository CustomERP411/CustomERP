#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "  Starting your ERP application..."
echo ""
./runtime/bin/node app/src/index.js
