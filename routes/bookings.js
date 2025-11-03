const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Create a new booking (public endpoint - no auth required)
router.post('/public', async (req, res) => {
  try {
    const {
      email,
      phone,
      postcode,
      date,
      time,
      vehicleSize,
      tier,
      valeterId,
      price,
      serviceType,    // NEW: 'mobile' or 'premises'
      address         // NEW: full address for mobile service
    } = req.body;

    console.log('📝 Creating new booking:', {
      email,
      phone,
      postcode,
      date,
      time,
      vehicleSize,
      tier,
      valeterId,
      price,
      serviceType,
      address: address ? 'provided' : 'none'
    });

    // Validation
    if (!email || !phone || !postcode || !date || !time || !vehicleSize || !tier || !valeterId || !price) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['email', 'phone', 'postcode', 'date', 'time', 'vehicleSize', 'tier', 'valeterId', 'price']
      });
    }

    // Validate service type
    const validServiceTypes = ['mobile', 'premises'];
    const bookingServiceType = serviceType || 'mobile';
    if (!validServiceTypes.includes(bookingServiceType)) {
      return res.status(400).json({ 
        error: 'Invalid service type. Must be "mobile" or "premises"'
      });
    }

    // If mobile service, address is recommended (but not strictly required)
    if (bookingServiceType === 'mobile' && !address) {
      console.log('⚠️  Mobile service booked without address');
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Create or get customer
      let customerResult = await client.query(
        'SELECT id FROM customers WHERE email = $1',
        [email]
      );

      let customerId;
      if (customerResult.rows.length > 0) {
        customerId = customerResult.rows[0].id;
        // Update phone if provided
        await client.query(
          'UPDATE customers SET phone = $1 WHERE id = $2',
          [phone, customerId]
        );
      } else {
        const insertCustomer = await client.query(
          'INSERT INTO customers (email, phone) VALUES ($1, $2) RETURNING id',
          [email, phone]
        );
        customerId = insertCustomer.rows[0].id;
      }

      // 2. Create booking with service type and address
      const bookingResult = await client.query(
        `INSERT INTO bookings 
         (customer_id, valeter_id, postcode, booking_date, booking_time, 
          vehicle_size, service_tier, price, service_type, address, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
         RETURNING *`,
        [
          customerId,
          valeterId,
          postcode,
          date,
          time,
          vehicleSize,
          tier,
          price,
          bookingServiceType,
          address || null,
          'pending'
        ]
      );

      await client.query('COMMIT');

      const booking = bookingResult.rows[0];
      
      console.log('✅ Booking created successfully:', booking.id);

      res.status(201).json({
        success: true,
        message: 'Booking created successfully',
        booking: {
          id: booking.id,
          customerId: customerId,
          valeterId: booking.valeter_id,
          date: booking.booking_date,
          time: booking.booking_time,
          vehicleSize: booking.vehicle_size,
          serviceTier: booking.service_tier,
          price: booking.price,
          serviceType: booking.service_type,
          address: booking.address,
          status: booking.status
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error creating booking:', error);
    res.status(500).json({ 
      error: 'Failed to create booking',
      details: error.message 
    });
  }
});

// Get all bookings (admin endpoint)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.*,
        c.email as customer_email,
        c.phone as customer_phone,
        v.business_name as valeter_name
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id
      JOIN valeters v ON b.valeter_id = v.id
      ORDER BY b.created_at DESC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      bookings: result.rows
    });

  } catch (error) {
    console.error('❌ Error fetching bookings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bookings',
      details: error.message 
    });
  }
});

// Get a single booking by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        b.*,
        c.email as customer_email,
        c.phone as customer_phone,
        v.business_name as valeter_name,
        v.business_address as valeter_address
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id
      JOIN valeters v ON b.valeter_id = v.id
      WHERE b.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      success: true,
      booking: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error fetching booking:', error);
    res.status(500).json({ 
      error: 'Failed to fetch booking',
      details: error.message 
    });
  }
});

// Update booking status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        validStatuses 
      });
    }

    const result = await pool.query(
      'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      success: true,
      message: 'Booking status updated',
      booking: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error updating booking:', error);
    res.status(500).json({ 
      error: 'Failed to update booking',
      details: error.message 
    });
  }
});

module.exports = router;
