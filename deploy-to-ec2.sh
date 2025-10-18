#!/bin/bash

# DeltaYards CRM - EC2 Deployment Script
# Run this script on your EC2 instance after SSH connection

set -e  # Exit on error

echo "=========================================="
echo "DeltaYards CRM - EC2 Deployment"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}Please do not run as root/sudo${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
sudo apt update
sudo apt upgrade -y

echo ""
echo -e "${YELLOW}Step 2: Installing Node.js 18.x...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    echo -e "${GREEN}Node.js installed successfully${NC}"
else
    echo -e "${GREEN}Node.js already installed: $(node --version)${NC}"
fi

echo ""
echo -e "${YELLOW}Step 3: Installing Git...${NC}"
if ! command -v git &> /dev/null; then
    sudo apt install -y git
    echo -e "${GREEN}Git installed successfully${NC}"
else
    echo -e "${GREEN}Git already installed: $(git --version)${NC}"
fi

echo ""
echo -e "${YELLOW}Step 4: Installing PM2 globally...${NC}"
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
    echo -e "${GREEN}PM2 installed successfully${NC}"
else
    echo -e "${GREEN}PM2 already installed: $(pm2 --version)${NC}"
fi

echo ""
echo -e "${YELLOW}Step 5: Installing Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    echo -e "${GREEN}Nginx installed and started${NC}"
else
    echo -e "${GREEN}Nginx already installed${NC}"
fi

echo ""
echo -e "${YELLOW}Step 6: Installing Redis...${NC}"
if ! command -v redis-cli &> /dev/null; then
    sudo apt install -y redis-server
    sudo systemctl start redis-server
    sudo systemctl enable redis-server
    echo -e "${GREEN}Redis installed and started${NC}"
else
    echo -e "${GREEN}Redis already installed${NC}"
fi

echo ""
echo -e "${YELLOW}Step 7: Creating application directory...${NC}"
APP_DIR="/home/ubuntu/deltadb"

if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}Directory exists. Backing up...${NC}"
    sudo mv "$APP_DIR" "${APP_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
fi

mkdir -p "$APP_DIR"
cd "$APP_DIR"

echo ""
echo -e "${GREEN}=========================================="
echo "Installation Complete!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Upload your application files to: $APP_DIR"
echo "2. Create .env file with your configuration"
echo "3. Run: npm install --production"
echo "4. Start app: pm2 start server.js --name deltayards-crm"
echo "5. Configure Nginx (see EC2-DEPLOYMENT-GUIDE.md)"
echo ""
echo "Useful commands:"
echo "  pm2 logs deltayards-crm    - View logs"
echo "  pm2 restart deltayards-crm - Restart app"
echo "  pm2 monit                  - Monitor resources"
echo ""
