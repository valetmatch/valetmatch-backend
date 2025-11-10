// routes/bookings.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');

// Create a new booking
router.post('/', [
  body('postcode').trim().notEmpty().withMessage('Postcode is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid time is required'),
  body('vehicleSize').isIn(['small', 'medium', 'large', 'van']).withMessage('Valid vehicle size required'),
  body('tier').isIn(['budget', 'standard', 'premium']).withMessage('Valid service tier required'),
  body('valeterId').isUUID().withMessage('Valid valeter ID required'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price required')
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      postcode, 
      date, 
      time, 
      vehicleSize, 
      tier, 
      valeterId, 
      price,
      customerName,
      customerEmail,
      customerPhone,
      specialInstructions
    } = req.body;

    // Calculate commission split
    const platformCommission = (price * 0.125).toFixed(2); // 12.5%
    const valeterEarnings = (price * 0.875).toFixed(2); // 87.5%

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Verify valeter exists and is approved
      const valeterCheck = await client.query(
        'SELECT id FROM valeters WHERE id = $1 AND application_status = $2',
        [valeterId, 'approved']
      );

      if (valeterCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Valeter not available' });
      }

      // Create booking
      const bookingResult = await client.query(
        `INSERT INTO bookings (
          valeter_id,
          customer_name,
          customer_email,
          customer_phone,
          postcode,
          booking_date,
          booking_time,
          vehicle_size,
          service_tier,
          price_quoted,
          platform_commission,
          valeter_earnings,
          special_instructions,
          status,
          payment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending', 'unpaid')
        RETURNING id, created_at`,
        [
          valeterId,
          customerName,
          customerEmail,
          customerPhone,
          postcode.toUpperCase(),
          date,
          time,
          vehicleSize,
          tier,
          price,
          platformCommission,
          valeterEarnings,
          specialInstructions || null
        ]
      );

      const bookingId = bookingResult.rows[0].id;

      // If photos are included, save them (simplified - in production use cloud storage)
      // TODO: Add photo upload handling with Cloudinary/S3

      await client.query('COMMIT');

      res.status(201).json({ 
        message: 'Booking created successfully',
        bookingId: bookingId,
        booking: {
          id: bookingId,
          status: 'pending',
          date: date,
          time: time,
          price: price,
          createdAt: bookingResult.rows[0].created_at
        }
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Get booking by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        b.*,
        v.business_name as valeter_name,
        v.postcode as valeter_postcode
      FROM bookings b
      JOIN valeters v ON b.valeter_id = v.id
      WHERE b.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ booking: result.rows[0] });

  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Get all bookings (for admin or valeter)
router.get('/', async (req, res) => {
  try {
    const { status, valeterId, limit = 50 } = req.query;

    let query = `
      SELECT 
        b.*,
        v.business_name as valeter_name
      FROM bookings b
      JOIN valeters v ON b.valeter_id = v.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND b.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (valeterId) {
      query += ` AND b.valeter_id = $${paramCount}`;
      params.push(valeterId);
      paramCount++;
    }

    query += ` ORDER BY b.created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    const result = await pool.query(query, params);

    res.json({ 
      bookings: result.rows,
      count: result.rows.length 
    });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Update booking status
router.patch('/:id/status', [
  body('status').isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed'])
    .withMessage('Valid status required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE bookings 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ 
      message: 'Booking status updated',
      booking: result.rows[0] 
    });

  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

module.exports = router;
