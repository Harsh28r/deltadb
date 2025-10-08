# Redis Setup Guide for Windows

## Option 1: Using Docker (Recommended)

### Prerequisites
- Install Docker Desktop from https://www.docker.com/products/docker-desktop

### Steps
1. Open PowerShell or Command Prompt
2. Run Redis container:
```bash
docker run -d --name redis-crm -p 6379:6379 redis:latest
```

3. Verify Redis is running:
```bash
docker ps
```

4. To stop Redis:
```bash
docker stop redis-crm
```

5. To start Redis again:
```bash
docker start redis-crm
```

## Option 2: WSL2 (Windows Subsystem for Linux)

### Prerequisites
- Enable WSL2 on Windows

### Steps
1. Open WSL terminal
2. Install Redis:
```bash
sudo apt update
sudo apt install redis-server
```

3. Start Redis:
```bash
sudo service redis-server start
```

4. Verify Redis is running:
```bash
redis-cli ping
# Should return: PONG
```

## Option 3: Memurai (Windows Native)

### Steps
1. Download Memurai from https://www.memurai.com/
2. Install and run Memurai (Redis-compatible for Windows)
3. Default runs on localhost:6379

## Option 4: Cloud Redis (Production Ready)

### Redis Cloud (Free Tier Available)
1. Sign up at https://redis.com/try-free/
2. Create a free database
3. Update your `.env` file:
```env
REDIS_HOST=your-redis-cloud-host.com
REDIS_PORT=12345
REDIS_PASSWORD=your-password
REDIS_DB=0
```

### AWS ElastiCache / Azure Cache / Google Cloud Memorystore
- Use managed Redis services for production deployments

## Verify Connection

After installing Redis, test the connection:

```bash
cd D:\hiten\CRMBackend\deltadb
node -e "const Redis = require('ioredis'); const client = new Redis(); client.ping().then(() => console.log('✅ Redis connected!')).catch(e => console.error('❌ Redis error:', e.message));"
```

## Application Behavior Without Redis

The application will work WITHOUT Redis installed:
- ✅ All features will work normally
- ⚠️ Caching will be disabled (slower API responses)
- ⚠️ Rate limiting will fall back to MongoDB (slower)
- 📝 You'll see: "⚠️ Continuing without Redis cache" in logs

## Next Steps

1. Choose an installation method above
2. Start Redis server
3. Verify connection using the test command
4. Restart your Node.js application
5. Check logs for: "✅ Redis connected successfully"

## Troubleshooting

### Connection Refused
- Make sure Redis is running on port 6379
- Check firewall settings
- Verify `.env` configuration

### Authentication Failed
- If using Redis Cloud or managed service, set REDIS_PASSWORD in `.env`

### Performance Issues
- Monitor Redis memory usage
- Adjust TTL values in route files if needed
- Consider using Redis persistence (RDB/AOF) for production
