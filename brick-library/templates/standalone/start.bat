@echo off
cd /d "%~dp0"
echo.
echo   Starting your ERP application...
echo.
runtime\node.exe app\src\index.js
