const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Simple admin auth for demo - replace with proper auth later
const adminAuth = (req, res, next) => {
  // For now, just check if request has admin key
  // TODO: Implement proper admin authentication
  next();
};

// GET PENDING VALETERS
router.get('/pending-valeters', adminAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, business_name, email, phone, postcode, services, created_at
       FROM valeters 
       WHERE status = 'pending'
       ORDER BY created_at DESC`
    );

    const valeters = result.rows.map(row => ({
      id: row.id,
      name: row.business_name,
      email: row.email,
      phone: row.phone,
      postcode: row.postcode,
      services: row.services,
      appliedAt: row.created_at
    }));

    res.json({ valeters });
  } catch (error) {
    console.error('Get pending valeters error:', error);
    res.status(500).json({ error: 'Failed to fetch pending valeters' });
  }
});

// APPROVE VALETER
router.post('/approve-valeter/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE valeters 
       SET status = 'approved' 
       WHERE id = $1 
       RETURNING id, business_name, email`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Valeter not found' });
    }

    // TODO: Send approval email

    res.json({ 
      message: 'Valeter approved successfully',
      valeter: result.rows[0]
    });
  } catch (error) {
    console.error('Approve valeter error:', error);
    res.status(500).json({ error: 'Failed to approve valeter' });
  }
});

// REJECT VALETER
router.post('/reject-valeter/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE valeters 
       SET status = 'rejected' 
       WHERE id = $1 
       RETURNING id, business_name, email`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Valeter not found' });
    }

    // TODO: Send rejection email

    res.json({ 
      message: 'Valeter rejected',
      valeter: result.rows[0]
    });
  } catch (error) {
    console.error('Reject valeter error:', error);
    res.status(500).json({ error: 'Failed to reject valeter' });
  }
});

// GET DASHBOARD STATS
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [bookingsResult, valetersResult, commissionResult] = await Promise.all([
      db.query('SELECT COUNT(*) as total FROM bookings'),
      db.query('SELECT COUNT(*) as total FROM valeters WHERE status = $1', ['approved']),
      db.query('SELECT SUM(commission) as total FROM bookings WHERE status = $1', ['completed'])
    ]);

    res.json({
      totalBookings: parseInt(bookingsResult.rows[0].total),
      activeValeters: parseInt(valetersResult.rows[0].total),
      totalCommission: parseFloat(commissionResult.rows[0].total || 0)
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET ALL BOOKINGS (Admin view)
router.get('/bookings', adminAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT b.*, 
              u.first_name, u.last_name, u.email as customer_email,
              v.business_name, v.email as valeter_email
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN valeters v ON b.valeter_id = v.id
       ORDER BY b.created_at DESC
       LIMIT 100`
    );

    const bookings = result.rows.map(row => ({
      id: row.id,
      customer: `${row.first_name} ${row.last_name}`,
      customerEmail: row.customer_email,
      valeter: row.business_name,
      valeterEmail: row.valeter_email,
      service: row.service_tier,
      price: parseFloat(row.price),
      commission: parseFloat(row.commission),
      date: row.booking_date,
      status: row.status,
      createdAt: row.created_at
    }));

    res.json({ bookings });
  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

module.exports = router;
