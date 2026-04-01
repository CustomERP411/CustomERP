# Your Generated ERP

This is a self-contained ERP application. No additional software needs to be installed.

## Quick Start

### macOS
Double-click **start.command** (or run `./start.sh` in Terminal).

### Windows
Double-click **start.bat** (or run `start.bat` in Command Prompt).

### Linux
Run `./start.sh` in a terminal (you may need `chmod +x start.sh` first).

Your browser will open automatically at **http://localhost:3000**.

## Data

Your data is stored in `app/data/erp.db` (SQLite database). Back up this file to preserve your data.

## Stopping

Press **Ctrl+C** in the terminal window to stop the server.

## Changing the Port

Set the `PORT` environment variable before starting:

```bash
PORT=8080 ./start.sh
```
