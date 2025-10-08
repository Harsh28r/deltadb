@echo off
echo ===============================================
echo   DOWNLOADING AND INSTALLING REDIS
echo ===============================================
echo.

echo Downloading Memurai Developer Edition...
echo.

REM Download Memurai directly
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://dist.memurai.com/releases/Memurai-Developer/4.1.6/Memurai-Developer-v4.1.6.msi' -OutFile '%TEMP%\Memurai-Installer.msi'}"

if exist "%TEMP%\Memurai-Installer.msi" (
    echo Download complete!
    echo.
    echo Installing Memurai...
    echo You may need to click 'Yes' for Admin permission
    echo.

    REM Install silently
    msiexec /i "%TEMP%\Memurai-Installer.msi" /qn /norestart

    timeout /t 10 /nobreak

    echo.
    echo Starting Memurai service...
    net start Memurai

    echo.
    echo ===============================================
    echo   TESTING CONNECTION
    echo ===============================================

    cd "D:\hiten\CRMBackend\deltadb"
    node -e "const Redis = require('ioredis'); const client = new Redis({retryStrategy: () => null}); setTimeout(() => {client.ping().then(() => { console.log('\n✅ SUCCESS! Redis is running!'); console.log('\nNow restart your app with: npm start'); process.exit(0); }).catch(e => { console.error('\n❌ Redis not responding yet. Wait 30 seconds and try again.'); process.exit(1); });}, 2000);"

    echo.
    pause
) else (
    echo.
    echo ❌ Download failed!
    echo.
    echo Please download manually from:
    echo https://www.memurai.com/get-memurai
    echo.
    echo Then run the installer and restart your app.
    pause
)
