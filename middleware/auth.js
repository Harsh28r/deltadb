const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function auth(req, res, next) {
  try {
    console.log('=== AUTH MIDDLEWARE DEBUG ===');
    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0);
    
    const authHeader = req.header('Authorization');
    console.log('Authorization header:', authHeader);
    
    const token = authHeader?.replace('Bearer ', '');
    console.log('Extracted token:', token ? token.substring(0, 20) + '...' : 'No token');
    
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment variables');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    console.log('Authenticated user:', { id: user._id, email: user.email, role: user.role });
    req.user = user;
    next();
  } catch (error) {
    console.error('=== AUTH ERROR DETAILS ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token format' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' });
    } else if (error.name === 'NotBeforeError') {
      return res.status(401).json({ message: 'Token not active yet' });
    }
    
    res.status(401).json({ message: 'Token is not valid' });
  }
};