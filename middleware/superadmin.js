// middleware/superadmin.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Extract token from various possible locations
function extractToken(req) {
  // Check Authorization header first
  if (req.headers.authorization) {
    return req.headers.authorization.replace('Bearer ', '');
  }
  
  // Check x-auth-token header
  if (req.headers['x-auth-token']) {
    return req.headers['x-auth-token'];
  }
  
  // Check query parameters
  if (req.query.token) {
    return req.query.token;
  }
  
  // Check body
  if (req.body && req.body.token) {
    return req.body.token;
  }
  
  return null;
}

const superadmin = async (req, res, next) => {
  try {
    console.log('=== SUPERADMIN MIDDLEWARE DEBUG ===');
    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0);
    
    const rawToken = extractToken(req);
    console.log('Raw token extracted:', rawToken ? rawToken.substring(0, 20) + '...' : 'No token');
    
    if (!rawToken) return res.status(401).json({ message: 'No token, authorization denied' });

    const token = String(rawToken).replace(/^"+|"+$/g, '').trim();
    console.log('Cleaned token:', token ? token.substring(0, 20) + '...' : 'No token');
    
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment variables');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token decoded successfully:', decoded);
    } catch (err) {
      console.error('=== SUPERADMIN JWT VERIFICATION ERROR ===');
      console.error('Error name:', err.name);
      console.error('Error message:', err.message);
      console.error('Full error:', err);
      
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token format' });
      } else if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token has expired' });
      } else if (err.name === 'NotBeforeError') {
        return res.status(401).json({ message: 'Token not active yet' });
      }
      
      return res.status(401).json({ message: 'Token verification failed' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    if (user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied. Superadmin role required.' });
    }

    console.log('Superadmin middleware - User authenticated:', { 
      id: user._id, 
      email: user.email, 
      role: user.role, 
      level: user.level 
    });

    req.user = user;
    next();
  } catch (error) {
    console.error('Superadmin middleware error:', error);
    res.status(500).json({ message: 'Server error in superadmin middleware' });
  }
};

module.exports = superadmin;