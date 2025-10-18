@echo off
echo ========================================
echo AWS S3 Express IAM Policy Setup
echo ========================================
echo.

REM Check if AWS CLI is installed
where aws >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: AWS CLI is not installed or not in PATH
    echo Please install AWS CLI from: https://aws.amazon.com/cli/
    pause
    exit /b 1
)

echo Checking AWS CLI configuration...
aws sts get-caller-identity >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: AWS CLI is not configured or credentials are invalid
    echo Run: aws configure
    pause
    exit /b 1
)

echo.
echo Current AWS Identity:
aws sts get-caller-identity
echo.

set /p IAM_USERNAME="Enter the IAM username to attach the policy to: "

if "%IAM_USERNAME%"=="" (
    echo ERROR: IAM username cannot be empty
    pause
    exit /b 1
)

echo.
echo Attaching policy to IAM user: %IAM_USERNAME%
echo.

aws iam put-user-policy --user-name %IAM_USERNAME% --policy-name S3ExpressAccessPolicy --policy-document file://s3-express-iam-policy.json

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS: Policy attached successfully!
    echo ========================================
    echo.
    echo You can now test S3 connection with: node test-s3.js
) else (
    echo.
    echo ========================================
    echo ERROR: Failed to attach policy
    echo ========================================
    echo.
    echo Possible issues:
    echo 1. You don't have IAM admin permissions
    echo 2. The IAM username is incorrect
    echo 3. AWS CLI credentials don't have iam:PutUserPolicy permission
    echo.
    echo Please contact your AWS administrator to apply the policy from:
    echo s3-express-iam-policy.json
)

echo.
pause
