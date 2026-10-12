const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    // Expected format: "Bearer <token>" or raw token
    const rawToken = token.startsWith('Bearer ') ? token.slice(7).trim() : (token.split(' ')[1] || token).trim();
    
    let decoded;
    try {
      decoded = jwt.verify(rawToken, process.env.JWT_SECRET || 'secret_key');
    } catch (jwtErr) {
      // Fallback a 'secret_key' para tokens válidos emitidos antes del cambio de JWT_SECRET
      if (process.env.JWT_SECRET && process.env.JWT_SECRET !== 'secret_key') {
        try {
          decoded = jwt.verify(rawToken, 'secret_key');
        } catch (fallbackErr) {
          throw jwtErr;
        }
      } else {
        throw jwtErr;
      }
    }
    
    // Check if user still exists in DB
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists. Please log in again.' });
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = authMiddleware;
