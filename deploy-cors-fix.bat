@echo off
REM CORS Fix Deployment Script for Windows
REM This script helps deploy the CORS fixes to your Render.com application

echo 🔧 Deploying CORS Fix to Render.com...

REM Check if git is available
git --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git is not installed. Please install Git and try again.
    pause
    exit /b 1
)

REM Check if we're in a git repository
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Not in a git repository. Please initialize git first.
    pause
    exit /b 1
)

REM Check git status
echo [INFO] Checking git status...
git status --porcelain | findstr . >nul
if not errorlevel 1 (
    echo [INFO] Staging changes...
    git add .
    
    echo [INFO] Committing changes...
    git commit -m "Fix CORS configuration for realtechmktg.com domain

- Fixed syntax error in cron/deactivation.js
- Updated CORS middleware to handle preflight requests properly
- Added explicit OPTIONS handling for all routes
- Added CORS test endpoints for debugging
- Improved CORS debugging and logging"
    
    echo [SUCCESS] Changes committed successfully!
) else (
    echo [WARNING] No changes to commit.
)

REM Check if we have a remote origin
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No remote origin found. Please add your Render.com git remote.
    echo [INFO] Example: git remote add origin https://git.render.com/your-repo.git
    pause
    exit /b 1
)

REM Push to deploy
echo [INFO] Pushing to Render.com for deployment...
git push origin main
if errorlevel 1 (
    echo [ERROR] Failed to push to remote repository.
    pause
    exit /b 1
) else (
    echo [SUCCESS] Deployment triggered successfully!
    echo [INFO] Your application should be updating on Render.com...
    echo [INFO] Check your Render dashboard for deployment status.
)

echo.
echo [SUCCESS] 🎉 CORS Fix Deployment Complete!
echo.
echo 📋 Next Steps:
echo   1. Wait for Render.com to complete the deployment (usually 2-3 minutes)
echo   2. Test the CORS fix by visiting: https://www.realtechmktg.com
echo   3. Check the logs on Render.com if issues persist
echo.
echo 🧪 Test Endpoints:
echo   • CORS Test: https://deltadb-o1lh.onrender.com/api/cors-test-realtech
echo   • Admin Login Test: https://deltadb-o1lh.onrender.com/api/admin-login-test
echo   • Health Check: https://deltadb-o1lh.onrender.com/api/health
echo.
echo 📊 Monitor Logs:
echo   • Visit your Render.com dashboard
echo   • Check the 'Logs' tab for CORS debug information
echo.

echo [INFO] Deployment script completed!
pause

