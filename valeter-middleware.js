const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'valet-match-secret-key-2024';

const verifyValeterToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.valeter = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { verifyValeterToken };
