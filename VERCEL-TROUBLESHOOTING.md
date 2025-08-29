# Vercel Deployment Troubleshooting Guide

## 🚨 Common Issues & Solutions

### 1. **500 Internal Server Error / FUNCTION_INVOCATION_FAILED**

#### **Symptoms:**
- Function crashes immediately
- 500 error responses
- FUNCTION_INVOCATION_FAILED in logs

#### **Solutions:**

**A. Check Environment Variables**
```bash
# In Vercel Dashboard > Settings > Environment Variables
NODE_ENV=production
MONGO_URI=your-mongodb-connection-string
JWT_SECRET=your-jwt-secret
```

**B. Check MongoDB Connection**
- Ensure MongoDB URI is correct
- Check if MongoDB is accessible from Vercel
- Verify network access and authentication

**C. Check Function Logs**
1. Go to Vercel Dashboard
2. Click on your project
3. Go to **Functions** tab
4. Check the logs for specific errors

### 2. **Build Failures**

#### **Symptoms:**
- Build process fails
- Dependencies not installing
- Missing files

#### **Solutions:**

**A. Check package.json**
```json
{
  "scripts": {
    "build": "echo 'Vercel build completed'",
    "vercel-build": "echo 'Vercel build completed'"
  }
}
```

**B. Check .vercelignore**
- Ensure important files aren't excluded
- Don't exclude `api/` folder
- Don't exclude `routes/`, `models/`, `controllers/`

### 3. **API Routes Not Working**

#### **Symptoms:**
- 404 errors for API endpoints
- Routes not found
- Wrong responses

#### **Solutions:**

**A. Check vercel.json**
```json
{
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/index.js"
    }
  ]
}
```

**B. Check API Structure**
```
api/
├── index.js          # Main API entry point
├── test.js           # Test endpoint
└── other-files.js    # Other endpoints
```

### 4. **MongoDB Connection Issues**

#### **Symptoms:**
- Database connection errors
- Timeout errors
- Authentication failures

#### **Solutions:**

**A. Check MongoDB URI Format**
```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

**B. Check Network Access**
- Ensure MongoDB Atlas allows connections from anywhere (0.0.0.0/0)
- Check if IP whitelist is configured
- Verify username/password

**C. Check Connection Options**
```javascript
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  maxPoolSize: 5, // Reduced for serverless
  retryWrites: true,
  w: 'majority'
});
```

## 🔧 Debugging Steps

### **Step 1: Test Basic Endpoint**
```bash
# Test the simple endpoint first
curl https://your-project.vercel.app/api/test
```

### **Step 2: Check Health Endpoint**
```bash
# Test health check
curl https://your-project.vercel.app/api/health
```

### **Step 3: Check Function Logs**
1. Vercel Dashboard > Project > Functions
2. Look for error messages
3. Check execution time and memory usage

### **Step 4: Test Locally First**
```bash
# Test your API locally before deploying
npm run dev
curl http://localhost:5000/api/health
```

## 🚀 Quick Fixes

### **Fix 1: Reset Environment Variables**
1. Go to Vercel Dashboard
2. Settings > Environment Variables
3. Delete all variables
4. Re-add them one by one

### **Fix 2: Redeploy from Scratch**
1. Delete the project from Vercel
2. Re-import from GitHub
3. Set environment variables
4. Deploy again

### **Fix 3: Check Dependencies**
```bash
# Ensure all dependencies are in package.json
npm install
npm ls
```

## 📊 Monitoring & Debugging

### **Vercel Analytics**
- Function execution times
- Error rates
- Request volumes

### **Function Logs**
- Real-time error tracking
- Performance metrics
- Memory usage

### **Environment Variables**
- Verify all variables are set
- Check for typos
- Ensure proper formatting

## 🎯 Common Solutions

### **For 500 Errors:**
1. Check MongoDB connection
2. Verify environment variables
3. Check function logs
4. Test endpoints individually

### **For Build Failures:**
1. Check package.json scripts
2. Verify dependencies
3. Check .vercelignore
4. Review build logs

### **For Route Issues:**
1. Check vercel.json routing
2. Verify API structure
3. Test endpoints locally
4. Check function exports

## 📞 Getting Help

### **Vercel Support:**
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Community](https://github.com/vercel/vercel/discussions)
- [Vercel Status](https://vercel-status.com)

### **Project-Specific Issues:**
1. Check this troubleshooting guide
2. Review function logs
3. Test endpoints step by step
4. Verify configuration files

## 🔄 Next Steps After Fix

1. **Test all endpoints** systematically
2. **Monitor function performance**
3. **Set up alerts** for errors
4. **Document any custom fixes**
5. **Update frontend** to use new API URLs
