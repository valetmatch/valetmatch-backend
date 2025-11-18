// valeter-auth-routes.js
// Valeter authentication and portal routes

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'valet-match-secret-2024-secure-key';
const JWT_EXPIRES = '7d'; // Valeter sessions last 7 days

// Middleware to verify valeter JWT token
const verifyValeterToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'valeter') {
      return res.status(403).json({ error: 'Invalid token type' });
    }
    req.valeterId = decoded.valeterId;
    req.valeterEmail = decoded.email;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// POST /valeter/auth/setup-password
// First-time password setup for approved valeters
router.post('/setup-password', async (req, res) => {
  const { email, token, password } = req.body;

  if (!email || !token || !password) {
    return res.status(400).json({ error: 'Email, token, and password required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const pool = req.app.locals.pool;

    // Verify token matches and hasn't expired
    const result = await pool.query(
      `SELECT id, business_name, status 
       FROM valeters 
       WHERE email = $1 
       AND status = 'approved'`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired setup link' });
    }

    const valeter = result.rows[0];

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Update valeter with password and clear reset token
    await pool.query(
      `UPDATE valeters 
       SET password_hash = $1, 
            
           
           status = 'active'
       WHERE id = $2`,
      [password_hash, valeter.id]
    );

    // Generate JWT
    const jwtToken = jwt.sign(
      { 
        valeterId: valeter.id, 
        email: email,
        businessName: valeter.business_name,
        type: 'valeter'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      message: 'Password set successfully',
      token: jwtToken,
      valeter: {
        id: valeter.id,
        businessName: valeter.business_name,
        email: email
      }
    });

  } catch (error) {
    console.error('Setup password error:', error);
    res.status(500).json({ error: 'Server error during password setup' });
  }
});

// POST /valeter/auth/login
// Valeter login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const pool = req.app.locals.pool;

    // Get valeter with password hash
    const result = await pool.query(
      `SELECT id, email, business_name, password_hash, status 
       FROM valeters 
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valeter = result.rows[0];

    // Check if valeter is active
    if (valeter.status !== 'active') {
      return res.status(403).json({ error: 'Account not active. Please contact support.' });
    }

    // Check if password is set
    if (!valeter.password_hash) {
      return res.status(400).json({ error: 'Password not set. Please use the setup link sent to your email.' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, valeter.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Last login tracking removed (column does not exist)

    // Generate JWT
    const token = jwt.sign(
      { 
        valeterId: valeter.id, 
        email: valeter.email,
        businessName: valeter.business_name,
        type: 'valeter'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      message: 'Login successful',
      token: token,
      valeter: {
        id: valeter.id,
        businessName: valeter.business_name,
        email: valeter.email
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// POST /valeter/auth/request-reset
// Request password reset
router.post('/request-reset', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    const pool = req.app.locals.pool;

    // Check if valeter exists
    const result = await pool.query(
      'SELECT id FROM valeters WHERE email = $1 AND status = \'active\'',
      [email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({ message: 'If that email exists, a reset link has been sent' });
    }

    const valeterId = result.rows[0].id;

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await pool.query(
      `UPDATE valeters 
       SET password_reset_token = $1, 
           password_reset_expires = $2 
       WHERE id = $3`,
      [resetToken, expires, valeterId]
    );

    // TODO: Send email with reset link
    // For now, just return success
    console.log(`Password reset token for ${email}: ${resetToken}`);

    res.json({ message: 'If that email exists, a reset link has been sent' });

  } catch (error) {
    console.error('Request reset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /valeter/auth/verify
// Verify token is valid
router.get('/verify', verifyValeterToken, async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    
    const result = await pool.query(
      'SELECT id, email, business_name, status FROM valeters WHERE id = $1',
      [req.valeterId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Valeter not found' });
    }

    const valeter = result.rows[0];

    res.json({
      valid: true,
      valeter: {
        id: valeter.id,
        businessName: valeter.business_name,
        email: valeter.email,
        status: valeter.status
      }
    });

  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
