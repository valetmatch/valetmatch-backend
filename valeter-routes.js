// valeter-routes.js
// Valeter portal dashboard and booking management

const express = require('express');
const router = express.Router();
const { verifyValeterToken } = require('./valeter-middleware');

// All routes require authentication
router.use(verifyValeterToken);

// GET /valeter/dashboard
// Get valeter dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const valeterId = req.valeterId;

    // Get valeter profile
    const valeterResult = await pool.query(
      `SELECT id, business_name, email, phone, postcode, rating, total_reviews, 
              services, created_at, last_login_at
       FROM valeters 
       WHERE id = $1`,
      [valeterId]
    );

    if (valeterResult.rows.length === 0) {
      return res.status(404).json({ error: 'Valeter not found' });
    }

    const valeter = valeterResult.rows[0];

    // Get available jobs (within 15 min acceptance window, not assigned yet)
    const availableJobsResult = await pool.query(
      `SELECT b.id, b.postcode, b.booking_date, b.booking_time, b.vehicle_size, 
              b.service_tier, b.service_price, b.notification_sent_at, b.acceptance_deadline,
              b.location_type,
              (b.service_price * 0.875) as valeter_earnings
       FROM bookings b
       WHERE b.status = 'pending'
       AND b.acceptance_deadline > NOW()
       AND $1 = ANY(b.notified_valeters)
       AND NOT EXISTS (
         SELECT 1 FROM booking_responses br 
         WHERE br.booking_id = b.id AND br.valeter_id = $1
       )
       ORDER BY b.notification_sent_at DESC`,
      [valeterId]
    );

    // Get confirmed bookings (assigned to this valeter)
    const confirmedJobsResult = await pool.query(
      `SELECT b.id, b.customer_name, b.customer_email, b.customer_phone, b.postcode,
              b.booking_date, b.booking_time, b.vehicle_size, b.service_tier, 
              b.service_price, b.location_type, b.status,
              (b.service_price * 0.875) as valeter_earnings
       FROM bookings b
       WHERE b.assigned_valeter_id = $1
       AND b.status IN ('confirmed', 'awaiting_approval')
       ORDER BY b.booking_date ASC, b.booking_time ASC`,
      [valeterId]
    );

    // Get completed jobs
    const completedJobsResult = await pool.query(
      `SELECT b.id, b.customer_name, b.booking_date, b.service_tier, b.service_price,
              b.completed_at, b.payment_approved_at, b.status,
              (b.service_price * 0.875) as valeter_earnings
       FROM bookings b
       WHERE b.assigned_valeter_id = $1
       AND b.status IN ('payment_approved', 'completed')
       ORDER BY b.completed_at DESC
       LIMIT 20`,
      [valeterId]
    );

    // Calculate stats
    const statsResult = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'completed') as total_jobs,
         SUM(service_price * 0.875) FILTER (WHERE status = 'completed') as total_earnings,
         AVG(rating) as avg_rating
       FROM bookings
       WHERE assigned_valeter_id = $1`,
      [valeterId]
    );

    const stats = statsResult.rows[0];

    res.json({
      valeter: {
        id: valeter.id,
        businessName: valeter.business_name,
        email: valeter.email,
        phone: valeter.phone,
        postcode: valeter.postcode,
        rating: valeter.rating || 0,
        reviewCount: valeter.total_reviews || 0,
        servicesOffered: valeter.services
      },
      availableJobs: availableJobsResult.rows.map(job => ({
        ...job,
        timeRemaining: Math.max(0, Math.floor((new Date(job.acceptance_deadline) - new Date()) / 1000))
      })),
      confirmedJobs: confirmedJobsResult.rows,
      completedJobs: completedJobsResult.rows,
      stats: {
        totalJobs: parseInt(stats.total_jobs) || 0,
        totalEarnings: parseFloat(stats.total_earnings) || 0,
        averageRating: parseFloat(stats.avg_rating) || 0
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Server error fetching dashboard data' });
  }
});

// POST /valeter/accept-job/:bookingId
// Accept an available job
router.post('/accept-job/:bookingId', async (req, res) => {
  const bookingId = parseInt(req.params.bookingId);
  const valeterId = req.valeterId;

  try {
    const pool = req.app.locals.pool;

    // Start transaction
    await pool.query('BEGIN');

    // Check if job is still available
    const bookingResult = await pool.query(
      `SELECT id, status, acceptance_deadline, notified_valeters
       FROM bookings
       WHERE id = $1
       FOR UPDATE`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // Check if still in acceptance window
    if (new Date(booking.acceptance_deadline) < new Date()) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'Acceptance window has closed' });
    }

    // Check if already assigned
    if (booking.status !== 'pending') {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'Job already assigned' });
    }

    // Check if this valeter was notified
    if (!booking.notified_valeters.includes(valeterId)) {
      await pool.query('ROLLBACK');
      return res.status(403).json({ error: 'You were not notified about this job' });
    }

    // Record the acceptance response
    await pool.query(
      `INSERT INTO booking_responses (booking_id, valeter_id, accepted)
       VALUES ($1, $2, true)
       ON CONFLICT (booking_id, valeter_id) DO NOTHING`,
      [bookingId, valeterId]
    );

    // Get valeter rating to determine if they win (highest rating wins)
    const valeterResult = await pool.query(
      'SELECT rating FROM valeters WHERE id = $1',
      [valeterId]
    );
    const valeterRating = valeterResult.rows[0].rating || 0;

    // Check if any other valeter with higher rating has already accepted
    const higherRatedResult = await pool.query(
      `SELECT br.valeter_id, v.rating
       FROM booking_responses br
       JOIN valeters v ON v.id = br.valeter_id
       WHERE br.booking_id = $1
       AND br.accepted = true
       AND v.rating > $2
       AND br.responded_at < NOW()`,
      [bookingId, valeterRating]
    );

    if (higherRatedResult.rows.length > 0) {
      await pool.query('COMMIT');
      return res.json({
        message: 'Response recorded',
        status: 'pending',
        note: 'You have accepted the job. The customer will choose from all accepted valeters after 15 minutes.'
      });
    }

    await pool.query('COMMIT');

    res.json({
      message: 'Job accepted successfully',
      status: 'accepted',
      note: 'You have accepted the job. The customer will choose from all accepted valeters after 15 minutes.'
    });

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Accept job error:', error);
    res.status(500).json({ error: 'Server error accepting job' });
  }
});

// POST /valeter/decline-job/:bookingId
// Decline an available job
router.post('/decline-job/:bookingId', async (req, res) => {
  const bookingId = parseInt(req.params.bookingId);
  const valeterId = req.valeterId;

  try {
    const pool = req.app.locals.pool;

    // Record the decline
    await pool.query(
      `INSERT INTO booking_responses (booking_id, valeter_id, accepted)
       VALUES ($1, $2, false)
       ON CONFLICT (booking_id, valeter_id) DO UPDATE SET accepted = false`,
      [bookingId, valeterId]
    );

    res.json({ message: 'Job declined' });

  } catch (error) {
    console.error('Decline job error:', error);
    res.status(500).json({ error: 'Server error declining job' });
  }
});

// POST /valeter/complete-job/:bookingId
// Mark job as complete and request payment approval
router.post('/complete-job/:bookingId', async (req, res) => {
  const bookingId = parseInt(req.params.bookingId);
  const valeterId = req.valeterId;

  try {
    const pool = req.app.locals.pool;

    // Verify this valeter is assigned to this booking
    const bookingResult = await pool.query(
      `SELECT id, customer_name, customer_email, customer_phone, status
       FROM bookings
       WHERE id = $1 AND assigned_valeter_id = $2`,
      [bookingId, valeterId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or not assigned to you' });
    }

    const booking = bookingResult.rows[0];

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Booking is not in confirmed status' });
    }

    // Generate payment approval token
    const crypto = require('crypto');
    const approvalToken = crypto.randomBytes(32).toString('hex');

    // Update booking status
    await pool.query(
      `UPDATE bookings
       SET status = 'awaiting_approval',
           completed_at = NOW(),
           payment_approval_token = $1
       WHERE id = $2`,
      [approvalToken, bookingId]
    );

    // TODO: Send email/SMS to customer with approval link

    res.json({
      message: 'Job marked as complete. Payment approval request sent to customer.',
      approvalToken: approvalToken,
      booking: {
        id: booking.id,
        customerName: booking.customer_name,
        customerEmail: booking.customer_email
      }
    });

  } catch (error) {
    console.error('Complete job error:', error);
    res.status(500).json({ error: 'Server error completing job' });
  }
});

// POST /valeter/approve-payment-device/:bookingId
// Customer approves payment on valeter's device
router.post('/approve-payment-device/:bookingId', async (req, res) => {
  const bookingId = parseInt(req.params.bookingId);
  const valeterId = req.valeterId;

  try {
    const pool = req.app.locals.pool;

    // Get booking
    const bookingResult = await pool.query(
      `SELECT id, assigned_valeter_id, status, service_price
       FROM bookings
       WHERE id = $1`,
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    if (booking.assigned_valeter_id !== valeterId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (booking.status !== 'awaiting_approval') {
      return res.status(400).json({ error: 'Booking not awaiting approval' });
    }

    // Capture IP and device info
    const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const deviceInfo = req.headers['user-agent'];

    // Calculate commission split
    const servicePrice = parseFloat(booking.service_price);
    const platformCommission = servicePrice * 0.125;
    const valeterPayout = servicePrice * 0.875;

    // Update booking with approval
    await pool.query(
      `UPDATE bookings
       SET status = 'payment_approved',
           payment_approved_at = NOW(),
           payment_approved_by = 'customer_device',
           payment_approval_ip = $1,
           payment_approval_device_info = $2,
           platform_commission = $3,
           valeter_payout = $4
       WHERE id = $5`,
      [ipAddress, deviceInfo, platformCommission, valeterPayout, bookingId]
    );

    res.json({
      message: 'Payment approved successfully',
      valeterEarnings: valeterPayout.toFixed(2)
    });

  } catch (error) {
    console.error('Approve payment device error:', error);
    res.status(500).json({ error: 'Server error approving payment' });
  }
});

module.exports = router;
