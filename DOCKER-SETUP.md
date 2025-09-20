# DeltaYards CRM - Docker Setup Guide

This guide covers the complete Docker setup for the DeltaYards CRM system, including the main API service and the cron job service.

## 🏗️ Architecture Overview

The Docker setup includes three main services:

1. **API Service** (`deltayards-api`) - Main CRM application
2. **Cron Service** (`deltayards-cron`) - Scheduled tasks (deactivation job)
3. **MongoDB Service** (`deltayards-mongodb`) - Database
4. **Nginx Service** (`deltayards-nginx`) - Reverse proxy (optional)

## 📁 Project Structure

```
deltadb/
├── Dockerfile              # Main API service
├── Dockerfile.cron         # Cron service
├── docker-compose.yml      # Multi-service orchestration
├── cron/
│   ├── deactivation.js     # Cron job logic
│   └── cron-runner.js      # Cron service entry point
├── docker-deploy.sh        # Linux/Mac deployment script
├── docker-deploy.bat       # Windows deployment script
└── DOCKER-SETUP.md         # This file
```

## 🚀 Quick Start

### Prerequisites

- Docker Desktop installed and running
- Docker Compose v2.0+
- At least 4GB RAM available for Docker

### Windows Deployment

```bash
# Run the deployment script
docker-deploy.bat
```

### Linux/Mac Deployment

```bash
# Make script executable and run
chmod +x docker-deploy.sh
./docker-deploy.sh
```

### Manual Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 🔧 Service Details

### API Service

- **Container**: `deltayards-api`
- **Port**: 5000
- **Health Check**: `http://localhost:5000/api/health`
- **Features**:
  - Express.js server
  - Socket.io for real-time updates
  - File upload handling
  - Authentication middleware

### Cron Service

- **Container**: `deltayards-cron`
- **Purpose**: Runs scheduled deactivation tasks
- **Schedule**: Daily at midnight (`0 0 * * *`)
- **Tasks**:
  - Deactivates ChannelPartners with no recent lead activity (30+ days)
  - Deactivates CPSourcings with no recent lead activity (30+ days)

### MongoDB Service

- **Container**: `deltayards-mongodb`
- **Port**: 27017
- **Database**: `deltayards_crm`
- **Credentials**: `admin:password123`

## 🛠️ Configuration

### Environment Variables

The services use the following environment variables:

```bash
# API Service
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb://admin:password123@mongodb:27017/deltayards_crm?authSource=admin
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Cron Service
NODE_ENV=production
MONGO_URI=mongodb://admin:password123@mongodb:27017/deltayards_crm?authSource=admin
```

### Volumes

- `./logs:/app/logs` - Application logs
- `./uploads:/app/uploads` - File uploads
- `mongodb_data:/data/db` - MongoDB data persistence

## 📊 Monitoring & Logs

### View All Logs
```bash
docker-compose logs -f
```

### View Specific Service Logs
```bash
# API service logs
docker-compose logs -f api

# Cron service logs
docker-compose logs -f cron

# MongoDB logs
docker-compose logs -f mongodb
```

### Health Checks

```bash
# Check API health
curl http://localhost:5000/api/health

# Check container status
docker-compose ps
```

## 🔄 Maintenance Commands

### Restart Services
```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart api
docker-compose restart cron
```

### Update Services
```bash
# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Clean Up
```bash
# Stop and remove containers
docker-compose down

# Remove containers, networks, and volumes
docker-compose down -v

# Remove unused Docker resources
docker system prune -a
```

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using port 5000
   netstat -tulpn | grep :5000
   
   # Stop the conflicting service or change port in docker-compose.yml
   ```

2. **MongoDB Connection Issues**
   ```bash
   # Check MongoDB logs
   docker-compose logs mongodb
   
   # Verify MongoDB is running
   docker-compose ps mongodb
   ```

3. **Cron Service Not Running**
   ```bash
   # Check cron logs
   docker-compose logs cron
   
   # The cron service may appear "unhealthy" but still work
   # This is normal for scheduled tasks
   ```

4. **Permission Issues (Linux/Mac)**
   ```bash
   # Fix log directory permissions
   sudo chown -R $USER:$USER logs/
   sudo chmod -R 755 logs/
   ```

### Debug Mode

Run services in foreground for debugging:
```bash
docker-compose up
```

## 🔒 Security Considerations

1. **Change Default Passwords**
   - Update MongoDB credentials in `docker-compose.yml`
   - Set a strong JWT_SECRET

2. **Network Security**
   - Services communicate through internal Docker network
   - Only API service is exposed to host

3. **File Permissions**
   - Containers run as non-root users
   - Proper ownership of volumes

## 📈 Scaling

### Horizontal Scaling
```bash
# Scale API service
docker-compose up -d --scale api=3
```

### Resource Limits
Add resource limits to `docker-compose.yml`:
```yaml
services:
  api:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
```

## 🚀 Production Deployment

For production deployment:

1. Update environment variables with production values
2. Use external MongoDB instance
3. Configure proper SSL certificates
4. Set up monitoring and alerting
5. Implement backup strategies

## 📞 Support

For issues or questions:
1. Check the logs first: `docker-compose logs -f`
2. Verify all services are running: `docker-compose ps`
3. Test API health: `curl http://localhost:5000/api/health`
4. Check Docker resources: `docker system df`
