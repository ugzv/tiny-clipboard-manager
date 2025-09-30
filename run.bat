@echo off
echo ================================================
echo   Tiny Clipboard Manager - Restart Script
echo ================================================
echo.

echo [1/4] Stopping any running Electron instances...
taskkill /F /IM electron.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo       Killed existing Electron processes
) else (
    echo       No Electron processes running
)

echo.
echo [2/4] Stopping any running Node.js dev servers...
taskkill /F /FI "WINDOWTITLE eq npm*" >nul 2>&1

echo.
echo [3/4] Cleaning up...
timeout /t 1 /nobreak >nul

echo.
echo [4/4] Starting Tiny Clipboard Manager...
echo.
echo ================================================
echo   Server is starting...
echo   Press Ctrl+C to stop
echo ================================================
echo.

npm run dev