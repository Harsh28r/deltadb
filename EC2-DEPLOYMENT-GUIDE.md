# EC2 Deployment Guide - DeltaYards CRM Backend

## Prerequisites
- AWS Account with EC2 access
- Your application code ready
- Database connection string (MongoDB Atlas)
- Domain name (optional, for production)

---

## Step 1: Launch EC2 Instance

### 1.1 Go to EC2 Console
1. Login to AWS Console: https://console.aws.amazon.com/
2. Navigate to **EC2** service
3. Select region: **eu-north-1** (Stockholm) - same as your S3 bucket

### 1.2 Launch Instance
1. Click **"Launch Instance"** button
2. Configure:
   - **Name**: `deltayards-crm-backend`
   - **Application and OS Images (AMI)**:
     - Select **Ubuntu Server 22.04 LTS (Free tier eligible)**
   - **Instance type**:
     - `t3.micro` (1 vCPU, 1 GB RAM) - for testing
     - `t3.small` (2 vCPU, 2 GB RAM) - recommended for production
   - **Key pair (login)**:
     - Click **"Create new key pair"**
     - Name: `deltayards-crm-key`
     - Type: RSA
     - Format: `.pem` (for Mac/Linux) or `.ppk` (for PuTTY on Windows)
     - **Download and save this file securely!**

### 1.3 Network Settings
1. Click **"Edit"** in Network settings
2. Configure:
   - **Auto-assign public IP**: Enable
   - **Firewall (security groups)**: Create security group
     - Name: `deltayards-crm-sg`
     - Description: Security group for CRM backend
   - **Inbound Security Group Rules**:
     - Rule 1: SSH
       - Type: SSH
       - Port: 22
       - Source: My IP (or 0.0.0.0/0 for anywhere)
     - Rule 2: HTTP
       - Type: HTTP
       - Port: 80
       - Source: 0.0.0.0/0
     - Rule 3: HTTPS
       - Type: HTTPS
       - Port: 443
       - Source: 0.0.0.0/0
     - Rule 4: Custom TCP (Node.js)
       - Type: Custom TCP
       - Port: 5000
       - Source: 0.0.0.0/0

### 1.4 Configure Storage
- **Size**: 20 GB (minimum)
- **Volume type**: gp3 (General Purpose SSD)

### 1.5 Launch
1. Review your configuration
2. Click **"Launch instance"**
3. Wait for instance to be in **"Running"** state

---

## Step 2: Connect to EC2 Instance

### 2.1 Get Instance Details
1. Go to **EC2 Dashboard** > **Instances**
2. Select your instance
3. Note the **Public IPv4 address** (e.g., 13.51.XXX.XXX)

### 2.2 Connect via SSH

**For Windows (using PowerShell or CMD):**
```bash
# Navigate to where you saved the .pem file
cd C:\Users\harshgupta\Downloads

# Set correct permissions (in PowerShell as Admin)
icacls deltayards-crm-key.pem /inheritance:r
icacls deltayards-crm-key.pem /grant:r "%username%:R"

# Connect
ssh -i deltayards-crm-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

**Alternative: Use PuTTY on Windows**
1. Download PuTTY: https://www.putty.org/
2. Convert .pem to .ppk using PuTTYgen
3. Use PuTTY to connect with the .ppk key

---

## Step 3: Install Required Software on EC2

Once connected to EC2, run these commands:

### 3.1 Update System
```bash
sudo apt update
sudo apt upgrade -y
```

### 3.2 Install Node.js (v18 LTS)
```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 3.3 Install Git
```bash
sudo apt install -y git

# Verify
git --version
```

### 3.4 Install PM2 (Process Manager)
```bash
sudo npm install -g pm2

# Verify
pm2 --version
```

### 3.5 Install Nginx (Reverse Proxy)
```bash
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### 3.6 Install Redis (Optional - for caching)
```bash
sudo apt install -y redis-server

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Test Redis
redis-cli ping
# Should return: PONG
```

---

## Step 4: Deploy Your Application

### 4.1 Clone Your Repository

**Option A: If using Git (recommended)**
```bash
cd /home/ubuntu
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git deltadb
cd deltadb
```

**Option B: Upload files manually using SCP**
```bash
# From your local machine (Windows PowerShell)
scp -i deltayards-crm-key.pem -r C:\Users\harshgupta\Documents\Crmbackend\deltadb ubuntu@YOUR_EC2_PUBLIC_IP:/home/ubuntu/
```

### 4.2 Install Dependencies
```bash
cd /home/ubuntu/deltadb
npm install --production
```

### 4.3 Create Environment File
```bash
nano .env
```

Paste your environment variables:
```env
# Server Configuration
PORT=5000
NODE_ENV=production

# JWT Configuration
JWT_SECRET=deltayards-super-secure-jwt-secret-key-2024-production-ready
JWT_EXPIRES_IN=24h

# MongoDB Configuration
MONGO_URI=mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/deltacrm?retryWrites=true&w=majority&appName=Cluster0

# Superadmin Configuration
SUPERADMIN_EMAIL=superadmin@deltayards.com
SUPERADMIN_PASSWORD=123456

# CORS Configuration
CORS_ORIGIN=http://YOUR_FRONTEND_URL,https://realtechmktg.com

# AWS S3 Configuration
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=AKIA5WYOBP257QFGHCWL
AWS_SECRET_ACCESS_KEY=6bzY5mKw+jcF/aGWnaoV7s4tP7Hi0d9cmI9kZLvl
AWS_S3_BUCKET_NAME=deltayards-crm-file--eun1-az1--x-s3
AWS_S3_BUCKET_TYPE=express

# Redis Configuration
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

Save: `Ctrl+O` → `Enter` → `Ctrl+X`

### 4.4 Test Application
```bash
# Test run
node server.js

# If it works, stop it with Ctrl+C
```

---

## Step 5: Configure PM2 (Keep App Running)

### 5.1 Start Application with PM2
```bash
cd /home/ubuntu/deltadb
pm2 start server.js --name "deltayards-crm"
```

### 5.2 Configure PM2 Startup
```bash
# Save PM2 configuration
pm2 save

# Generate startup script
pm2 startup systemd

# Copy and run the command that PM2 outputs
# It will look like: sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### 5.3 PM2 Useful Commands
```bash
# View logs
pm2 logs deltayards-crm

# Monitor
pm2 monit

# Restart
pm2 restart deltayards-crm

# Stop
pm2 stop deltayards-crm

# Status
pm2 status
```

---

## Step 6: Configure Nginx as Reverse Proxy

### 6.1 Create Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/deltayards-crm
```

Paste this configuration:
```nginx
server {
    listen 80;
    server_name YOUR_EC2_PUBLIC_IP;  # Replace with your domain or IP

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Save: `Ctrl+O` → `Enter` → `Ctrl+X`

### 6.2 Enable Configuration
```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/deltayards-crm /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## Step 7: Test Deployment

### 7.1 Check if Application is Running
```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs deltayards-crm --lines 50

# Check if port 5000 is listening
sudo netstat -tulpn | grep 5000
```

### 7.2 Test API Endpoints
```bash
# Test from EC2 instance
curl http://localhost:5000/api/health

# Test from your local machine
curl http://YOUR_EC2_PUBLIC_IP/api/health
```

### 7.3 Test from Browser
Open browser and navigate to:
- `http://YOUR_EC2_PUBLIC_IP`
- `http://YOUR_EC2_PUBLIC_IP/api/health`

---

## Step 8: Setup SSL Certificate (HTTPS) - Optional but Recommended

### 8.1 Prerequisites
- A domain name pointed to your EC2 IP
- DNS A record: `api.yourdomain.com` → `YOUR_EC2_PUBLIC_IP`

### 8.2 Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 8.3 Obtain SSL Certificate
```bash
sudo certbot --nginx -d api.yourdomain.com
```

Follow the prompts:
- Enter email address
- Agree to terms
- Choose whether to redirect HTTP to HTTPS (recommended: Yes)

### 8.4 Test Auto-Renewal
```bash
sudo certbot renew --dry-run
```

---

## Step 9: Setup Monitoring and Logs

### 9.1 View Application Logs
```bash
# PM2 logs
pm2 logs deltayards-crm

# Application logs (if you're using file logging)
tail -f /home/ubuntu/deltadb/logs/access-*.log
tail -f /home/ubuntu/deltadb/logs/error-*.log
```

### 9.2 View Nginx Logs
```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### 9.3 System Resources
```bash
# CPU and Memory
htop

# Disk space
df -h

# PM2 monitoring
pm2 monit
```

---

## Step 10: Maintenance & Updates

### 10.1 Update Application Code
```bash
cd /home/ubuntu/deltadb

# Pull latest code
git pull origin main

# Install new dependencies
npm install --production

# Restart application
pm2 restart deltayards-crm
```

### 10.2 Backup Important Data
```bash
# Backup .env file
cp .env .env.backup

# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/
```

### 10.3 System Updates
```bash
# Update system packages
sudo apt update
sudo apt upgrade -y

# Reboot if needed
sudo reboot
```

---

## Troubleshooting

### Application Not Starting
```bash
# Check PM2 logs
pm2 logs deltayards-crm --lines 100

# Check if port is in use
sudo lsof -i :5000

# Restart PM2
pm2 restart deltayards-crm
```

### Cannot Connect to EC2
```bash
# Check security group rules in AWS Console
# Ensure port 22 (SSH), 80 (HTTP), 5000 are open

# Check if Nginx is running
sudo systemctl status nginx
```

### Database Connection Issues
```bash
# Test MongoDB connection
mongo "mongodb+srv://db1:123456g@cluster0.fcyiy3l.mongodb.net/deltacrm"

# Check if EC2 IP is whitelisted in MongoDB Atlas Network Access
```

### High Memory/CPU Usage
```bash
# Check process usage
htop

# Restart application
pm2 restart deltayards-crm

# Consider upgrading instance type if needed
```

---

## Security Checklist

- [ ] Changed default SSH port (optional but recommended)
- [ ] Disabled root login
- [ ] Setup firewall (ufw)
- [ ] Regular system updates
- [ ] Strong passwords in .env
- [ ] SSL certificate installed
- [ ] MongoDB Atlas IP whitelist configured
- [ ] Regular backups
- [ ] CloudWatch or monitoring setup

---

## Additional Security Hardening (Optional)

### Setup UFW Firewall
```bash
# Enable UFW
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5000/tcp
sudo ufw enable

# Check status
sudo ufw status
```

### Disable Root Login
```bash
sudo nano /etc/ssh/sshd_config

# Find and change:
# PermitRootLogin no
# PasswordAuthentication no

# Restart SSH
sudo systemctl restart sshd
```

---

## Quick Reference Commands

```bash
# Application
pm2 start server.js --name deltayards-crm
pm2 restart deltayards-crm
pm2 logs deltayards-crm
pm2 monit

# Nginx
sudo systemctl restart nginx
sudo nginx -t
sudo tail -f /var/log/nginx/error.log

# System
sudo systemctl status nginx
sudo systemctl status redis-server
df -h
htop

# Updates
cd /home/ubuntu/deltadb && git pull && npm install && pm2 restart deltayards-crm
```

---

## Next Steps After Deployment

1. Test all API endpoints
2. Update frontend CORS settings
3. Setup domain name and SSL
4. Configure MongoDB Atlas IP whitelist
5. Setup automated backups
6. Configure monitoring/alerts
7. Document API endpoints
8. Load testing

---

## Support

For issues:
1. Check PM2 logs: `pm2 logs`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Check system resources: `htop`
4. Review this guide's Troubleshooting section

---

**Your EC2 Instance Details:**
- Region: eu-north-1
- Instance ID: (Fill after creation)
- Public IP: (Fill after creation)
- Domain: (Fill if using domain)

**Deployment Date:** _______________
