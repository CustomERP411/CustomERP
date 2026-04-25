# Your ERP Application

Welcome! This folder contains your complete, ready-to-run ERP system. Everything you need is included -- no extra software to install.

---

## Getting Started

### Windows

1. Extract the entire ZIP file (right-click > **Extract All...**)
2. Open the extracted folder
3. Double-click **start.bat**
4. Your browser will open automatically at **http://localhost:3000**

### macOS

1. Double-click the ZIP file in Finder to extract it
2. Open the extracted folder
3. Double-click **start.command**
4. Your browser will open automatically at **http://localhost:3000**

> **First time on macOS?** If you see a security warning saying the file "cannot be opened because it is from an unidentified developer", right-click (or Control-click) the file and choose **Open** from the menu. You only need to do this once.

### Linux

1. Extract the ZIP: `unzip your-erp.zip` (or use your file manager)
2. Make the script executable: `chmod +x start.sh`
3. Run it: `./start.sh`
4. Your browser will open automatically at **http://localhost:3000**

**Tested on (any glibc-based x86_64 distribution):** Ubuntu 22.04+, Debian 12+, Fedora 38+, Arch / Manjaro, openSUSE, Linux Mint, Pop!_OS, Elementary OS.

**Not supported:**
- **Alpine Linux / musl libc** -- the bundled Node.js runtime requires glibc. Use a glibc distro or the Docker build instead.
- **ARM64 / aarch64 Linux** (Raspberry Pi, Apple Silicon VMs, most ARM single-board computers) -- this bundle is x86_64 only.
- **32-bit Linux** (`i386`, `i686`) -- 64-bit only.
- **NixOS** -- the bundled runtime will not find its loader out of the box. Run via `nix-ld` / `steam-run`, or use the Docker build.

---

## Your Data

All of your data is stored locally on your computer in the **app/data** folder. No data is sent to the cloud or internet.

- **Database file:** `app/data/erp.db`
- **To back up:** Copy the `app/data` folder to a USB drive, external hard drive, or cloud storage
- **To restore:** Replace the `app/data` folder with your backup copy, then restart the application

We recommend backing up your data regularly, especially before updating your ERP.

---

## Stopping the Application

- **Windows:** Close the black command window, or press **Ctrl+C** inside it
- **macOS:** Close the Terminal window, or press **Ctrl+C**
- **Linux:** Press **Ctrl+C** in the terminal

Your data is saved automatically. It is safe to stop at any time.

---

## Changing the Port

By default, the application runs on port 3000. If you need a different port:

**Windows:** Edit `app\.env` and change `PORT=3000` to your preferred port, then restart.

**macOS / Linux:**
```bash
PORT=8080 ./start.sh
```

---

## Troubleshooting

### "Port 3000 is already in use"
Another application is using port 3000. Either close that application, or change the port (see above).

### Windows SmartScreen warning
Windows may show a "Windows protected your PC" message. Click **More info**, then **Run anyway**. This is normal for applications not purchased through the Microsoft Store.

### macOS Gatekeeper warning
See the macOS section under Getting Started above for how to bypass this on first run.

### The application does not start
Make sure you extracted the **entire** ZIP file, not just individual files from inside it. The `runtime` folder, `app` folder, and startup script must all be in the same location.

### Linux: `./start.sh: Permission denied`
The extracted files lost their executable bit. Run `chmod +x start.sh` (and, if needed, `chmod +x runtime/bin/node`) and try again.

### Linux: `Exec format error` or `cannot execute binary file`
Your CPU architecture does not match this bundle. This bundle targets **x86_64 Linux only**. ARM64 (Raspberry Pi, Apple Silicon Linux VMs) and 32-bit Linux are not supported.

### Linux: Alpine / musl error from `start.sh`
The bundled Node.js runtime is built against glibc and cannot run on Alpine / musl. Switch to a glibc-based distribution (Ubuntu, Debian, Fedora, Arch, openSUSE, Mint, Pop!_OS) or use the Docker build instead.

### Browser does not open automatically
Open your browser manually and go to **http://localhost:3000**. On Linux, auto-open uses `xdg-open` and may silently fail on minimal or headless installs.

---

## What is Inside This Folder

| Folder/File | Purpose |
|---|---|
| `app/` | Your ERP backend and configuration |
| `app/data/` | Your database (back this up!) |
| `app/public/` | The web interface files |
| `runtime/` | The application engine (do not modify) |
| `start.bat` / `start.command` / `start.sh` | The startup script for your operating system |
