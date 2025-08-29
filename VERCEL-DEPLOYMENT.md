# DeltaYards CRM - Vercel Deployment Guide

This guide will help you deploy your DeltaYards CRM backend API to Vercel.

## 🚀 Quick Deploy to Vercel

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Go to [vercel.com](https://vercel.com)**
2. **Sign up/Login** with your GitHub account
3. **Click "New Project"**
4. **Import your GitHub repository**
5. **Configure the project:**
   - **Framework Preset**: `Node.js`
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (or leave empty)
   - **Output Directory**: `./` (leave as default)
   - **Install Command**: `npm install`

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from your project directory
vercel

# Follow the prompts to configure your project
```

## 🔧 Environment Variables Setup

In your Vercel dashboard, go to **Settings > Environment Variables** and add:

```
NODE_ENV=production
MONGO_URI=your-mongodb-connection-string
JWT_SECRET=your-super-secret-jwt-key
```

## 📁 Project Structure for Vercel

Your project now has the correct structure:

```
DeltaYardsCRM-master/
├── api/
│   └── index.js          # Vercel API entry point
├── routes/               # API route files
├── models/              # MongoDB models
├── controllers/         # Business logic
├── middleware/          # Auth & validation
├── vercel.json          # Vercel configuration
├── package.json         # Dependencies
└── .vercelignore        # Files to exclude
```

## 🌐 API Endpoints

After deployment, your API will be available at:

- **Base URL**: `https://your-project.vercel.app`
- **Health Check**: `https://your-project.vercel.app/api/health`
- **Projects**: `https://your-project.vercel.app/api/projects`
- **Leads**: `https://your-project.vercel.app/api/leads`
- **Users**: `https://your-project.vercel.app/api/users`

## 🔄 Update Your Frontend

Once deployed, update your frontend API calls:

```javascript
// Change from localhost to your Vercel URL
const API_BASE = 'https://your-project.vercel.app/api'

// Example API call
fetch(`${API_BASE}/projects`)
  .then(response => response.json())
  .then(data => console.log(data))
```

## 🚨 Important Notes

### Vercel Limitations:
- **Serverless Functions**: Each API call runs in a separate function
- **Cold Starts**: First request might be slower
- **Timeout**: Functions have a 10-second timeout by default
- **File System**: Read-only, no persistent file storage

### MongoDB Connection:
- **Connection Pooling**: Limited in serverless environment
- **Connection Timeouts**: Set appropriate timeouts
- **Environment Variables**: Use Vercel's environment variable system

## 🧪 Test Your Deployment

After deployment, test your API:

```bash
# Test health endpoint
curl https://your-project.vercel.app/api/health

# Test projects endpoint
curl https://your-project.vercel.app/api/projects
```

## 🔧 Troubleshooting

### Common Issues:

1. **Build Failed**
   - Check your `package.json` has all required dependencies
   - Ensure `vercel.json` is properly configured

2. **API Not Working**
   - Verify environment variables are set
   - Check MongoDB connection string
   - Review Vercel function logs

3. **CORS Issues**
   - Update CORS settings in your API
   - Add your frontend domain to allowed origins

### Check Logs:
- Go to your Vercel dashboard
- Click on your project
- Go to **Functions** tab
- Check the logs for any errors

## 📊 Monitoring

- **Vercel Analytics**: Built-in performance monitoring
- **Function Logs**: Real-time function execution logs
- **Error Tracking**: Automatic error reporting

## 🎯 Next Steps

1. **Deploy to Vercel** using the steps above
2. **Test your API endpoints**
3. **Update your frontend** to use the new API URL
4. **Monitor performance** and logs
5. **Set up custom domain** if needed

## 📞 Support

- **Vercel Documentation**: [vercel.com/docs](https://vercel.com/docs)
- **Vercel Community**: [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions)
- **Project Issues**: Check your project logs in Vercel dashboard
