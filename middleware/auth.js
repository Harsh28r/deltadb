const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function auth(req, res, next) {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment variables');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).lean();

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token format' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    } else if (error.name === 'NotBeforeError') {
      return res.status(401).json({ message: 'Token not active yet' });
    }

    console.error('Auth middleware error:', error.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
};