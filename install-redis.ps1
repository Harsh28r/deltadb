# Redis Installation Script for Windows
# Run this in PowerShell as Administrator

Write-Host "Installing Redis for Windows (Memurai)..." -ForegroundColor Green

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit
}

# Install Redis using Chocolatey
Write-Host "Installing Redis (Memurai Developer Edition)..." -ForegroundColor Cyan
choco install redis-64 -y

if ($LASTEXITCODE -eq 0) {
    Write-Host "Redis installed successfully!" -ForegroundColor Green

    # Start Redis service
    Write-Host "Starting Redis service..." -ForegroundColor Cyan
    Start-Service redis

    # Set to auto-start
    Write-Host "Setting Redis to auto-start..." -ForegroundColor Cyan
    Set-Service redis -StartupType Automatic

    Write-Host "`n✅ Redis is now running!" -ForegroundColor Green
    Write-Host "Redis is listening on localhost:6379" -ForegroundColor Yellow

    # Test connection
    Write-Host "`nTesting Redis connection..." -ForegroundColor Cyan
    $testScript = @"
const Redis = require('ioredis');
const client = new Redis();
client.ping()
    .then(() => {
        console.log('✅ Redis connection successful!');
        process.exit(0);
    })
    .catch((e) => {
        console.error('❌ Redis connection failed:', e.message);
        process.exit(1);
    });
"@

    $testScript | Out-File -FilePath "$PSScriptRoot\test-redis.js" -Encoding UTF8
    node "$PSScriptRoot\test-redis.js"

    Write-Host "`n🎉 Installation complete! You can now restart your application." -ForegroundColor Green

} else {
    Write-Host "❌ Installation failed. Trying alternative method..." -ForegroundColor Red

    # Alternative: Download Memurai directly
    Write-Host "Downloading Memurai installer..." -ForegroundColor Cyan
    $url = "https://www.memurai.com/get-memurai"
    Start-Process $url

    Write-Host "`nPlease:" -ForegroundColor Yellow
    Write-Host "1. Download Memurai from the opened browser" -ForegroundColor Yellow
    Write-Host "2. Run the installer" -ForegroundColor Yellow
    Write-Host "3. Restart this application" -ForegroundColor Yellow
}

pause
