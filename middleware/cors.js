const cors = require('cors');

// CORS configuration for DeltaYards CRM
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost for development
    if (origin === 'http://localhost:3000') return callback(null, true);
    
    // Allow any vercel.app domain
    if (origin.includes('vercel.app')) return callback(null, true);
    
    // Allow realtechmktg.com domain (your production domain)
    if (origin === 'https://www.realtechmktg.com' || origin === 'https://realtechmktg.com') {
      return callback(null, true);
    }
    
    // Allow all origins in development
    if (process.env.NODE_ENV === 'development') return callback(null, true);
    
    // Log blocked origins for debugging
    console.log('🚫 CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'Origin', 'Accept'],
  exposedHeaders: ['Authorization', 'x-auth-token'],
  preflightContinue: false,
  optionsSuccessStatus: 200
};

// Special CORS configuration for admin-login endpoint
const adminLoginCorsOptions = {
  origin: ['https://www.realtechmktg.com', 'https://realtechmktg.com', 'http://localhost:3000'],
  credentials: true,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'Origin', 'Accept'],
  exposedHeaders: ['Authorization', 'x-auth-token'],
  preflightContinue: false,
  optionsSuccessStatus: 200
};

// CORS debugging middleware
const corsDebug = (req, res, next) => {
  console.log('🔍 CORS Debug Info:');
  console.log('  Origin:', req.headers.origin);
  console.log('  Method:', req.method);
  console.log('  Path:', req.path);
  console.log('  User-Agent:', req.headers['user-agent']);
  
  // Set CORS headers manually for critical endpoints
  if (req.path === '/api/superadmin/admin-login') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token, Origin, Accept');
    res.header('Access-Control-Expose-Headers', 'Authorization, x-auth-token');
  }
  
  next();
};

module.exports = {
  corsOptions,
  adminLoginCorsOptions,
  corsDebug
};
