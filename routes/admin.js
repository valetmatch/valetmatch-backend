// admin-routes.js - Add this to your backend

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendPasswordSetupEmail } = require('../emailService');

// Hardcoded admin credentials
const ADMIN_EMAIL = 'deputymitchell@me.com';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('Wanderers039!', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'valet-match-secret-key-2024';

// Admin login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check email
    if (email !== ADMIN_EMAIL) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const passwordMatch = bcrypt.compareSync(password, ADMIN_PASSWORD_HASH);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { email: ADMIN_EMAIL, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: { email: ADMIN_EMAIL, role: 'admin' }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get admin dashboard stats
router.get('/stats', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = req.app.locals;

    // Get total bookings
    const bookingsResult = await pool.query('SELECT COUNT(*) as count FROM bookings');
    const totalBookings = parseInt(bookingsResult.rows[0].count);

    // Get completed bookings for commission calculation
    const completedResult = await pool.query(
      `SELECT SUM(CAST(price AS DECIMAL)) as total 
       FROM bookings 
       WHERE status = 'completed'`
    );
    const totalRevenue = parseFloat(completedResult.rows[0].total || 0);
    const commissionEarned = (totalRevenue * 0.125).toFixed(2);

    // Get active valeters
    const valetersResult = await pool.query(
      `SELECT COUNT(*) as count 
       FROM valeters 
       WHERE status = 'approved'`
    );
    const activeValeters = parseInt(valetersResult.rows[0].count);

    // Get pending applications
    const pendingResult = await pool.query(
      `SELECT COUNT(*) as count 
       FROM valeters 
       WHERE status = 'pending'`
    );
    const pendingApplications = parseInt(pendingResult.rows[0].count);

    res.json({
      totalBookings,
      commissionEarned,
      activeValeters,
      pendingApplications
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get pending valeters
router.get('/pending-valeters', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = req.app.locals;
    
    const result = await pool.query(
      `SELECT id, business_name, email, phone, postcode, 
              services, created_at
       FROM valeters 
       WHERE status = 'pending'
       ORDER BY created_at DESC`
    );

    const valeters = result.rows.map(v => ({
      id: v.id,
      name: v.business_name,
      email: v.email,
      phone: v.phone,
      postcode: v.postcode,
      services: v.services || [],
      createdAt: v.created_at
    }));

    res.json(valeters);

  } catch (error) {
    console.error('Pending valeters error:', error);
    res.status(500).json({ error: 'Failed to fetch pending valeters' });
  }
});

// Get recent bookings
router.get('/bookings', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = req.app.locals;
    
    const result = await pool.query(
      `SELECT b.id, b.service_tier, b.price, 
              b.booking_date, b.status, v.business_name as valeter_name
       FROM bookings b
       LEFT JOIN valeters v ON b.valeter_id = v.id
       ORDER BY b.created_at DESC
       LIMIT 20`
    );

    const bookings = result.rows.map(b => ({
      id: b.id,
      customer: 'N/A',
      valeter: b.valeter_name,
      valeter: b.valeter_name,
      service: b.service_tier,
      price: b.price,
      date: b.booking_date,
      status: b.status
    }));

    res.json(bookings);

  } catch (error) {
    console.error('Bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Approve valeter - WITH AUTOMATIC EMAIL SENDING
router.post('/approve-valeter/:id', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = req.app.locals;
    const { id } = req.params;
    const bcrypt = require('bcryptjs');
    const { generateTempPassword } = require('../utils/temp_password_generator');
    const { sendTempPasswordEmail } = require('../emailService');
    
    // Get valeter details
    const valeterResult = await pool.query(
      'SELECT email, business_name FROM valeters WHERE id = $1',
      [id]
    );
    
    if (valeterResult.rows.length === 0) {
      return res.status(404).json({ error: 'Valeter not found' });
    }

    const valeter = valeterResult.rows[0];

    // Generate temporary password
    const tempPassword = generateTempPassword(valeter.business_name);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Update valeter: set password, mark as approved, flag for password change
    await pool.query(
      `UPDATE valeters 
       SET status = 'active', 
           password_hash = $1,
           must_change_password = true
       WHERE id = $2`,
      [hashedPassword, id]
    );

    // Send email with temp password
    console.log(`📧 Sending temp password email to ${valeter.email}...`);
    
    const emailResult = await sendTempPasswordEmail(
      valeter.email,
      valeter.business_name,
      tempPassword
    );

    if (emailResult.success) {
      console.log(`✅ Email sent successfully to ${valeter.email}`);
      
      res.json({ 
        success: true,
        message: `Valeter approved and credentials sent to ${valeter.email}`,
        emailSent: true
      });
    } else {
      console.error(`⚠️ Email failed to send: ${emailResult.error}`);
      
      res.json({ 
        success: true,
        message: `Valeter approved but email failed. Temp password: ${tempPassword}`,
        tempPassword: tempPassword,
        emailSent: false,
        emailError: emailResult.error
      });
    }

  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Failed to approve valeter', details: error.message });
  }
});

// Reject valeter
router.post('/reject-valeter/:id', verifyAdminToken, async (req, res) => {
  try {
    const { pool } = req.app.locals;
    const { id } = req.params;

    await pool.query(
      `UPDATE valeters 
       SET status = 'rejected', rejected_at = NOW()
       WHERE id = $1`,
      [id]
    );

    res.json({ success: true });

  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ error: 'Failed to reject valeter' });
  }
});

module.exports = router;
