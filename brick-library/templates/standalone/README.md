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

1. Extract the ZIP: `unzip your-erp.zip`
2. Make the script executable: `chmod +x start.sh`
3. Run it: `./start.sh`
4. Your browser will open automatically at **http://localhost:3000**

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

### Browser does not open automatically
Open your browser manually and go to **http://localhost:3000**

---

## What is Inside This Folder

| Folder/File | Purpose |
|---|---|
| `app/` | Your ERP backend and configuration |
| `app/data/` | Your database (back this up!) |
| `app/public/` | The web interface files |
| `runtime/` | The application engine (do not modify) |
| `start.bat` / `start.command` / `start.sh` | The startup script for your operating system |
