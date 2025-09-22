#!/bin/bash

# CORS Fix Deployment Script
# This script helps deploy the CORS fixes to your Render.com application

echo "🔧 Deploying CORS Fix to Render.com..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if git is available
if ! command -v git &> /dev/null; then
    print_error "Git is not installed. Please install Git and try again."
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository. Please initialize git first."
    exit 1
fi

# Check git status
print_status "Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
    print_status "Staging changes..."
    git add .
    
    print_status "Committing changes..."
    git commit -m "Fix CORS configuration for realtechmktg.com domain

- Fixed syntax error in cron/deactivation.js
- Updated CORS middleware to handle preflight requests properly
- Added explicit OPTIONS handling for all routes
- Added CORS test endpoints for debugging
- Improved CORS debugging and logging"
    
    print_success "Changes committed successfully!"
else
    print_warning "No changes to commit."
fi

# Check if we have a remote origin
if ! git remote get-url origin > /dev/null 2>&1; then
    print_error "No remote origin found. Please add your Render.com git remote."
    print_status "Example: git remote add origin https://git.render.com/your-repo.git"
    exit 1
fi

# Push to deploy
print_status "Pushing to Render.com for deployment..."
if git push origin main; then
    print_success "Deployment triggered successfully!"
    print_status "Your application should be updating on Render.com..."
    print_status "Check your Render dashboard for deployment status."
else
    print_error "Failed to push to remote repository."
    exit 1
fi

echo ""
print_success "🎉 CORS Fix Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "  1. Wait for Render.com to complete the deployment (usually 2-3 minutes)"
echo "  2. Test the CORS fix by visiting: https://www.realtechmktg.com"
echo "  3. Check the logs on Render.com if issues persist"
echo ""
echo "🧪 Test Endpoints:"
echo "  • CORS Test: https://deltadb-o1lh.onrender.com/api/cors-test-realtech"
echo "  • Admin Login Test: https://deltadb-o1lh.onrender.com/api/admin-login-test"
echo "  • Health Check: https://deltadb-o1lh.onrender.com/api/health"
echo ""
echo "📊 Monitor Logs:"
echo "  • Visit your Render.com dashboard"
echo "  • Check the 'Logs' tab for CORS debug information"
echo ""

print_status "Deployment script completed!"
