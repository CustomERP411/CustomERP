#!/bin/sh
cd "$(dirname "$0")"

echo ""
echo "  ============================================"
echo "    Your ERP Application"
echo "  ============================================"
echo ""

ARCH="$(uname -m 2>/dev/null || echo unknown)"
case "$ARCH" in
    x86_64|amd64)
        ;;
    aarch64|arm64|armv7l|armv6l)
        echo "  ERROR: This bundle only supports x86_64 Linux."
        echo "  Detected CPU architecture: $ARCH"
        echo ""
        echo "  ARM / Raspberry Pi / Apple Silicon Linux are not"
        echo "  supported yet. Run this ERP on an x86_64 machine,"
        echo "  or use the Docker build instead."
        echo ""
        exit 1
        ;;
    i386|i486|i586|i686)
        echo "  ERROR: 32-bit Linux is not supported."
        echo "  Detected CPU architecture: $ARCH"
        echo "  Use a 64-bit (x86_64) Linux distribution."
        echo ""
        exit 1
        ;;
    *)
        echo "  WARNING: Unknown CPU architecture: $ARCH"
        echo "  This bundle is built for x86_64 Linux and may not run."
        echo ""
        ;;
esac

if command -v ldd >/dev/null 2>&1; then
    if ldd --version 2>&1 | grep -qi musl; then
        echo "  ERROR: Alpine / musl libc is not supported."
        echo ""
        echo "  The bundled Node.js runtime is built against glibc."
        echo "  Use a glibc-based distribution instead, for example:"
        echo "    Ubuntu, Debian, Fedora, Arch, openSUSE, Mint, Pop!_OS."
        echo ""
        echo "  Alternatively, use the Docker build of this ERP."
        echo ""
        exit 1
    fi
fi

if [ ! -f "./runtime/bin/node" ]; then
    echo "  ERROR: Could not find the application runtime."
    echo "  Make sure you extracted the entire ZIP file,"
    echo "  not just individual files from inside it."
    echo "  Keep file permissions when extracting."
    echo ""
    exit 1
fi

if [ ! -x "./runtime/bin/node" ]; then
    echo "  The runtime is not executable. Fixing permissions..."
    chmod +x ./runtime/bin/node 2>/dev/null || {
        echo "  ERROR: Could not make ./runtime/bin/node executable."
        echo "  Run: chmod +x ./runtime/bin/node"
        echo ""
        exit 1
    }
fi

if [ ! -f "./app/src/index.js" ]; then
    echo "  ERROR: Application files are missing."
    echo "  Make sure you extracted the entire ZIP file."
    echo ""
    exit 1
fi

echo "  Starting up... please wait."
echo "  Your browser will open automatically."
echo ""
echo "  Once started, open your browser to:"
echo "  http://localhost:3000"
echo ""
echo "  To stop the application, press Ctrl+C."
echo "  ============================================"
echo ""

./runtime/bin/node app/src/index.js
