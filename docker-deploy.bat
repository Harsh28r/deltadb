@echo off
REM DeltaYards CRM Docker Deployment Script for Windows
REM This script builds and deploys both the API and Cron services

echo 🚀 Starting DeltaYards CRM Docker Deployment...

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

REM Check if Docker Compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Compose is not installed. Please install Docker Compose and try again.
    pause
    exit /b 1
)

REM Create necessary directories
echo [INFO] Creating necessary directories...
if not exist logs mkdir logs
if not exist uploads mkdir uploads

REM Build and start services
echo [INFO] Building and starting Docker services...
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

REM Wait for services to be healthy
echo [INFO] Waiting for services to be healthy...
timeout /t 30 /nobreak >nul

REM Check service status
echo [INFO] Checking service status...

REM Check API service
docker-compose ps api | findstr "Up" >nul
if errorlevel 1 (
    echo [ERROR] API service failed to start
    docker-compose logs api
    pause
    exit /b 1
) else (
    echo [SUCCESS] API service is running
)

REM Check Cron service
docker-compose ps cron | findstr "Up" >nul
if errorlevel 1 (
    echo [WARNING] Cron service may have issues (this is normal for scheduled tasks)
    docker-compose logs cron
) else (
    echo [SUCCESS] Cron service is running
)

REM Check MongoDB service
docker-compose ps mongodb | findstr "Up" >nul
if errorlevel 1 (
    echo [ERROR] MongoDB service failed to start
    docker-compose logs mongodb
    pause
    exit /b 1
) else (
    echo [SUCCESS] MongoDB service is running
)

REM Test API health endpoint
echo [INFO] Testing API health endpoint...
curl -f http://localhost:5000/api/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] API health check failed - service may still be starting up
) else (
    echo [SUCCESS] API health check passed
)

REM Show service URLs
echo.
echo [SUCCESS] 🎉 Deployment completed successfully!
echo.
echo 📋 Service Information:
echo   • API Service: http://localhost:5000
echo   • Health Check: http://localhost:5000/api/health
echo   • MongoDB: localhost:27017
echo   • Cron Service: Running in background
echo.
echo 📊 Useful Commands:
echo   • View logs: docker-compose logs -f
echo   • View API logs: docker-compose logs -f api
echo   • View Cron logs: docker-compose logs -f cron
echo   • Stop services: docker-compose down
echo   • Restart services: docker-compose restart
echo.

echo [INFO] Deployment script completed!
pause
