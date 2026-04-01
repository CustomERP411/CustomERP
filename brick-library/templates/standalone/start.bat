@echo off
cd /d "%~dp0"

echo.
echo  ============================================
echo    Your ERP Application
echo  ============================================
echo.
echo   Starting up... please wait.
echo   Your browser will open automatically.
echo.

if not exist "runtime\node.exe" (
    echo  ERROR: Could not find the application runtime.
    echo  Make sure you extracted the entire ZIP file,
    echo  not just individual files from inside it.
    echo.
    echo  Press any key to close this window...
    pause >nul
    exit /b 1
)

if not exist "app\src\index.js" (
    echo  ERROR: Application files are missing.
    echo  Make sure you extracted the entire ZIP file.
    echo.
    echo  Press any key to close this window...
    pause >nul
    exit /b 1
)

echo   Once started, open your browser to:
echo   http://localhost:3000
echo.
echo   To stop the application, close this window
echo   or press Ctrl+C.
echo  ============================================
echo.

runtime\node.exe app\src\index.js

if errorlevel 1 (
    echo.
    echo  The application stopped unexpectedly.
    echo  If port 3000 is already in use, close the
    echo  other application using it and try again.
    echo.
    echo  Press any key to close this window...
    pause >nul
)
