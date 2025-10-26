const jwt = require('jsonwebtoken');

// Verify JWT token and attach user info to request
const authMiddleware = (allowedTypes = []) => {
  return (req, res, next) => {
    try {
      // Get token from header
      const token = req.header('Authorization')?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ error: 'No authentication token provided' });
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check user type if specified
      if (allowedTypes.length > 0 && !allowedTypes.includes(decoded.type)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Attach user info to request
      req.user = {
        id: decoded.id,
        type: decoded.type
      };

      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      res.status(500).json({ error: 'Authentication failed' });
    }
  };
};

module.exports = authMiddleware;
