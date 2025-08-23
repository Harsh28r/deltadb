// middleware/superadmin.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function extractToken(req) {
  const authHeader = req.header('authorization') || req.header('Authorization');
  if (authHeader && typeof authHeader === 'string') {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
    if (!/\s/.test(authHeader)) return authHeader;
  }
  const xAuth = req.header('x-auth-token');
  if (xAuth) return xAuth;
  if (req.cookies && req.cookies.auth_token) return req.cookies.auth_token;
  if (req.query && req.query.token) return req.query.token;
  if (req.body && req.body.token) return req.body.token;
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
      return res.status(500).json({ message: 'JWT secret not configured on server' });
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
      
      if (err && err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
      }
      return res.status(401).json({ message: 'Token is not valid' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    const isSuperadmin =
      String(user.role).toLowerCase() === 'superadmin' || Number(user.level) === 1;
    if (!isSuperadmin) return res.status(403).json({ message: 'Superadmin access required' });

    console.log('Superadmin middleware - User authenticated:', { 
      id: user._id, 
      email: user.email, 
      role: user.role, 
      level: user.level 
    });

    req.user = user;
    res.locals.user = user;
    res.locals.token = token;
    next();
  } catch (error) {
    return res.status(500).json({ message: error?.message || 'Server error' });
  }
};

module.exports = superadmin;