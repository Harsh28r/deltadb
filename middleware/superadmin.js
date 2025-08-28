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
    const rawToken = extractToken(req);
    if (!rawToken) return res.status(401).json({ message: 'No token, authorization denied' });

    const token = String(rawToken).replace(/^"+|"+$/g, '').trim();
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'JWT secret not configured on server' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
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

    req.user = user;
    res.locals.user = user;
    res.locals.token = token;
    next();
  } catch (error) {
    return res.status(500).json({ message: error?.message || 'Server error' });
  }
};

module.exports = superadmin;