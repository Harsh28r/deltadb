const jwt = require('jsonwebtoken');
const User = require('../models/User');

const extractToken = (req) => {
  const authHeader = req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7).trim();

  return req.header('x-auth-token')?.trim() || 
         req.cookies?.auth_token?.trim() || 
         req.query?.token?.trim() || 
         req.body?.token?.trim() || null;
};

const superadmin = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await User.findById(decoded.id).select('_id role level').lean();

    if (!user) return res.status(401).json({ message: 'User not found' });

    const isSuperadmin = user.role === 'superadmin' || user.level === 1;
    if (!isSuperadmin) return res.status(403).json({ message: 'Superadmin access required' });

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Invalid token format' });
    if (error.name === 'TokenExpiredError') return res.status(401).json({ message: 'Token expired' });
    if (error.name === 'NotBeforeError') return res.status(401).json({ message: 'Token not active yet' });

    console.error('Superadmin middleware error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = superadmin;