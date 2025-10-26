const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// CREATE BOOKING
router.post('/',
  authMiddleware(['customer']),
  [
    body('valeterId').isInt(),
    body('postcode').trim().notEmpty(),
    body('bookingDate').isDate(),
    body('bookingTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('vehicleSize').isIn(['small', 'medium', 'large', 'van']),
    body('serviceTier').isIn(['budget', 'standard', 'premium']),
    body('price').isFloat({ min: 0 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { valeterId, postcode, bookingDate, bookingTime, vehicleSize, serviceTier, price, photos } = req.body;
      const userId = req.user.id;

      // Calculate 12.5% commission
      const commission = (price * 0.125).toFixed(2);

      // Insert booking
      const result = await db.query(
        `INSERT INTO bookings 
         (user_id, valeter_id, postcode, booking_date, booking_time, vehicle_size, service_tier, price, commission, photos, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending') 
         RETURNING *`,
        [userId, valeterId, postcode, bookingDate, bookingTime, vehicleSize, serviceTier, price, commission, JSON.stringify(photos || {})]
      );

      const booking = result.rows[0];

      // TODO: Send email notifications here

      res.status(201).json({
        message: 'Booking created successfully',
        booking: {
          id: booking.id,
          valeterId: booking.valeter_id,
          postcode: booking.postcode,
          date: booking.booking_date,
          time: booking.booking_time,
          service: booking.service_tier,
          price: parseFloat(booking.price),
          status: booking.status
        }
      });
    } catch (error) {
      console.error('Booking creation error:', error);
      res.status(500).json({ error: 'Failed to create booking' });
    }
  }
);

// GET USER'S BOOKINGS
router.get('/my-bookings', authMiddleware(['customer']), async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT b.*, v.business_name, v.phone, v.rating 
       FROM bookings b
       JOIN valeters v ON b.valeter_id = v.id
       WHERE b.user_id = $1
       ORDER BY b.booking_date DESC, b.booking_time DESC`,
      [userId]
    );

    const bookings = result.rows.map(row => ({
      id: row.id,
      valeter: {
        name: row.business_name,
        phone: row.phone,
        rating: parseFloat(row.rating)
      },
      postcode: row.postcode,
      date: row.booking_date,
      time: row.booking_time,
      vehicleSize: row.vehicle_size,
      service: row.service_tier,
      price: parseFloat(row.price),
      status: row.status,
      createdAt: row.created_at
    }));

    res.json({ bookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET VALETER'S BOOKINGS
router.get('/valeter-bookings', authMiddleware(['valeter']), async (req, res) => {
  try {
    const valeterId = req.user.id;

    const result = await db.query(
      `SELECT b.*, u.first_name, u.last_name, u.phone, u.email 
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE b.valeter_id = $1
       ORDER BY b.booking_date DESC, b.booking_time DESC`,
      [valeterId]
    );

    const bookings = result.rows.map(row => ({
      id: row.id,
      customer: {
        name: `${row.first_name} ${row.last_name}`,
        phone: row.phone,
        email: row.email
      },
      postcode: row.postcode,
      date: row.booking_date,
      time: row.booking_time,
      vehicleSize: row.vehicle_size,
      service: row.service_tier,
      price: parseFloat(row.price),
      commission: parseFloat(row.commission),
      photos: row.photos,
      status: row.status,
      createdAt: row.created_at
    }));

    res.json({ bookings });
  } catch (error) {
    console.error('Get valeter bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// UPDATE BOOKING STATUS (Valeter only)
router.patch('/:id/status',
  authMiddleware(['valeter']),
  [body('status').isIn(['confirmed', 'in_progress', 'completed', 'cancelled'])],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const valeterId = req.user.id;

      const result = await db.query(
        `UPDATE bookings 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 AND valeter_id = $3 
         RETURNING *`,
        [status, id, valeterId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      res.json({ message: 'Booking status updated', booking: result.rows[0] });
    } catch (error) {
      console.error('Update booking error:', error);
      res.status(500).json({ error: 'Failed to update booking' });
    }
  }
);

module.exports = router;
