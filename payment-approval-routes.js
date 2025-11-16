// payment-approval-routes.js
// Public endpoint for customer to approve payment via email link

const express = require('express');
const router = express.Router();

// GET /approve-payment/:token
// Display payment approval page
router.get('/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const pool = req.app.locals.pool;

    // Find booking by approval token
    const result = await pool.query(
      `SELECT b.id, b.customer_name, b.service_tier, b.service_price, b.booking_date,
              b.status, v.business_name as valeter_name
       FROM bookings b
       JOIN valeters v ON v.id = b.assigned_valeter_id
       WHERE b.payment_approval_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(`
        <html>
          <head><title>Invalid Link</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>Invalid or Expired Link</h1>
            <p>This payment approval link is not valid.</p>
          </body>
        </html>
      `);
    }

    const booking = result.rows[0];

    if (booking.status === 'payment_approved' || booking.status === 'completed') {
      return res.send(`
        <html>
          <head><title>Already Approved</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>✓ Payment Already Approved</h1>
            <p>This service has already been approved.</p>
          </body>
        </html>
      `);
    }

    // Display approval form
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Approve Payment - Valet Match</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            margin: 0;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
            width: 100%;
          }
          h1 {
            color: #2563eb;
            margin-top: 0;
            font-size: 28px;
          }
          .booking-details {
            background: #f3f4f6;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .label {
            color: #6b7280;
            font-weight: 600;
          }
          .value {
            color: #111827;
            font-weight: 500;
          }
          .price {
            font-size: 32px;
            color: #2563eb;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
          }
          button {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
          }
          button:hover {
            transform: translateY(-2px);
          }
          button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .message {
            text-align: center;
            padding: 16px;
            border-radius: 12px;
            margin-top: 20px;
            display: none;
          }
          .message.success {
            background: #d1fae5;
            color: #065f46;
            display: block;
          }
          .message.error {
            background: #fee2e2;
            color: #991b1b;
            display: block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✓ Service Complete</h1>
          <p>Please confirm that ${booking.valeter_name} has completed your ${booking.service_tier} service to your satisfaction.</p>
          
          <div class="booking-details">
            <div class="detail-row">
              <span class="label">Customer:</span>
              <span class="value">${booking.customer_name}</span>
            </div>
            <div class="detail-row">
              <span class="label">Service:</span>
              <span class="value">${booking.service_tier}</span>
            </div>
            <div class="detail-row">
              <span class="label">Date:</span>
              <span class="value">${booking.booking_date}</span>
            </div>
            <div class="detail-row">
              <span class="label">Valeter:</span>
              <span class="value">${booking.valeter_name}</span>
            </div>
          </div>

          <div class="price">£${parseFloat(booking.service_price).toFixed(2)}</div>

          <button id="approveBtn" onclick="approvePayment()">
            Approve Payment
          </button>

          <div id="message" class="message"></div>
        </div>

        <script>
          async function approvePayment() {
            const btn = document.getElementById('approveBtn');
            const msg = document.getElementById('message');
            
            btn.disabled = true;
            btn.textContent = 'Processing...';
            
            try {
              const response = await fetch('/api/approve-payment/${token}', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });
              
              const data = await response.json();
              
              if (response.ok) {
                msg.className = 'message success';
                msg.textContent = '✓ Payment approved successfully! Thank you.';
                btn.textContent = '✓ Approved';
              } else {
                msg.className = 'message error';
                msg.textContent = data.error || 'Error approving payment';
                btn.disabled = false;
                btn.textContent = 'Try Again';
              }
            } catch (error) {
              msg.className = 'message error';
              msg.textContent = 'Connection error. Please try again.';
              btn.disabled = false;
              btn.textContent = 'Try Again';
            }
          }
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Payment approval page error:', error);
    res.status(500).send('Server error');
  }
});

// POST /approve-payment/:token
// Process payment approval
router.post('/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const pool = req.app.locals.pool;

    // Find booking
    const bookingResult = await pool.query(
      `SELECT id, status, service_price, assigned_valeter_id
       FROM bookings
       WHERE payment_approval_token = $1`,
      [token]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid approval token' });
    }

    const booking = bookingResult.rows[0];

    if (booking.status === 'payment_approved' || booking.status === 'completed') {
      return res.json({ message: 'Payment already approved' });
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

    // Update booking
    await pool.query(
      `UPDATE bookings
       SET status = 'payment_approved',
           payment_approved_at = NOW(),
           payment_approved_by = 'customer_email',
           payment_approval_ip = $1,
           payment_approval_device_info = $2,
           platform_commission = $3,
           valeter_payout = $4
       WHERE id = $5`,
      [ipAddress, deviceInfo, platformCommission, valeterPayout, booking.id]
    );

    // TODO: Trigger Stripe payment capture

    res.json({
      message: 'Payment approved successfully',
      amount: servicePrice.toFixed(2)
    });

  } catch (error) {
    console.error('Process approval error:', error);
    res.status(500).json({ error: 'Server error processing approval' });
  }
});

module.exports = router;
