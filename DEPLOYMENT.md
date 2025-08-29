# DeltaYards CRM - Deployment Guide

This guide covers different deployment options for your DeltaYards CRM system.

## 🚀 Quick Deployment Options

### Option 1: PM2 (Recommended for VPS/Dedicated Servers)

```bash
# Install PM2 globally
npm install -g pm2

# Install production dependencies
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Option 2: Docker (Recommended for Cloud/Container Platforms)

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t deltayards-crm .
docker run -p 5000:5000 --env-file .env deltayards-crm
```

### Option 3: Traditional Node.js

```bash
# Install production dependencies
npm run build

# Start the server
NODE_ENV=production npm start
```

## 🌐 Cloud Deployment Platforms

### Heroku
```bash
# Install Heroku CLI
heroku create deltayards-crm
heroku config:set NODE_ENV=production
heroku config:set MONGO_URI=your-mongodb-uri
heroku config:set JWT_SECRET=your-jwt-secret
git push heroku main
```

### DigitalOcean App Platform
1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically on push

### AWS EC2
```bash
# SSH to your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Clone repository
git clone https://github.com/yourusername/deltayards-crm.git
cd deltayards-crm

# Install dependencies
npm install

# Start with PM2
pm2 start ecosystem.config.js --env production
```

### Google Cloud Run
```bash
# Build and deploy
gcloud run deploy deltayards-crm \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## 🔧 Environment Setup

### 1. Copy Production Environment
```bash
cp env-production.txt .env
```

### 2. Update Environment Variables
```bash
# Edit .env file with your actual values
nano .env
```

### 3. Required Variables
- `MONGO_URI`: Your MongoDB connection string
- `JWT_SECRET`: Strong secret for JWT tokens
- `NODE_ENV`: Set to "production"
- `PORT`: Port number (usually 5000 or process.env.PORT)

## 📊 Monitoring & Logs

### PM2 Monitoring
```bash
# View logs
pm2 logs deltayards-crm

# Monitor processes
pm2 monit

# View status
pm2 status
```

### Docker Logs
```bash
# View API logs
docker logs deltayards-api

# View MongoDB logs
docker logs deltayards-mongodb
```

## 🔒 Security Considerations

### 1. Environment Variables
- Never commit `.env` files to Git
- Use strong, unique JWT secrets
- Rotate secrets regularly

### 2. Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 5000  # API (if exposed directly)
sudo ufw enable
```

### 3. SSL/TLS
```bash
# Install Certbot for Let's Encrypt
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com
```

## 📈 Performance Optimization

### 1. PM2 Cluster Mode
```bash
# Start with multiple instances
pm2 start ecosystem.config.js --env production -i max
```

### 2. Nginx Reverse Proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Database Optimization
- Use MongoDB indexes
- Monitor slow queries
- Consider read replicas for high traffic

## 🚨 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find process using port 5000
   lsof -i :5000
   
   # Kill the process
   kill -9 <PID>
   ```

2. **MongoDB Connection Failed**
   - Check MongoDB URI
   - Verify network access
   - Check authentication credentials

3. **PM2 Process Crashed**
   ```bash
   # View error logs
   pm2 logs deltayards-crm --err
   
   # Restart process
   pm2 restart deltayards-crm
   ```

4. **Docker Container Issues**
   ```bash
   # View container logs
   docker logs deltayards-api
   
   # Restart container
   docker restart deltayards-api
   ```

## 📋 Deployment Checklist

- [ ] Environment variables configured
- [ ] MongoDB connection tested
- [ ] JWT secret set
- [ ] SSL certificate installed (if needed)
- [ ] Firewall configured
- [ ] Monitoring setup
- [ ] Backup strategy implemented
- [ ] Health check endpoint working
- [ ] Logs being generated
- [ ] Performance metrics collected

## 🔄 Continuous Deployment

### GitHub Actions Example
```yaml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.KEY }}
          script: |
            cd /var/www/deltayards-crm
            git pull origin main
            npm install
            pm2 restart ecosystem.config.js --env production
```

## 📞 Support

For deployment issues:
1. Check the logs first
2. Verify environment variables
3. Test database connectivity
4. Check network/firewall settings
5. Review the troubleshooting section above

