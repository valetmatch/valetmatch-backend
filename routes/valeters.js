// routes/valeters.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');

// Apply as a valeter
router.post('/apply', [
  body('businessName').trim().notEmpty().withMessage('Business name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('postcode').trim().notEmpty().withMessage('Postcode is required'),
  body('services').isArray({ min: 1 }).withMessage('At least one service must be selected'),
  body('insurance').isBoolean().withMessage('Insurance confirmation is required'),
  body('terms').isBoolean().withMessage('Terms acceptance is required')
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { businessName, email, phone, postcode, services, insurance, terms } = req.body;

    // Check if insurance and terms are true
    if (!insurance || !terms) {
      return res.status(400).json({ error: 'Insurance and terms must be accepted' });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if email already exists
      // Check if email already exists in valeters
      const existingValeter = await client.query(
        'SELECT id FROM valeters WHERE email = $1',
        [email]
      );

      if (existingValeter.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Create valeter application
      const valeterResult = await client.query(
        `INSERT INTO valeters (business_name, email, password_hash, phone, postcode, services, insurance_verified, status)
         VALUES ($1, $2, '', $3, $4, $5, $6, 'pending')
         RETURNING id`,
        [businessName, email, phone, postcode, JSON.stringify(services), insurance]
      );

      await client.query('COMMIT');

      res.status(201).json({ 
        message: 'Application submitted successfully',
        valeterId: valeterResult.rows[0].id
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error in valeter application:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Search valeters by postcode
router.get('/search', async (req, res) => {
  try {
    const { postcode, vehicleSize, tier } = req.query;

    if (!postcode) {
      return res.status(400).json({ error: 'Postcode is required' });
    }

    // Simple search - get approved valeters near the postcode
    // In production, you'd use PostGIS for proper distance calculation
    const result = await pool.query(
      `SELECT 
        v.id,
        v.business_name,
        v.postcode,
        v.average_rating,
        v.total_reviews,
        v.is_mobile,
        v.has_premises,
        v.price_small_budget,
        v.price_small_standard,
        v.price_small_premium,
        v.price_medium_budget,
        v.price_medium_standard,
        v.price_medium_premium,
        v.price_large_budget,
        v.price_large_standard,
        v.price_large_premium,
        v.price_van_budget,
        v.price_van_standard,
        v.price_van_premium,
        v.offers_budget,
        v.offers_standard,
        v.offers_premium
      FROM valeters v
      WHERE v.application_status = 'approved'
      AND v.postcode LIKE $1
      ORDER BY v.average_rating DESC, v.total_reviews DESC
      LIMIT 10`,
      [postcode.substring(0, 4) + '%'] // Match first part of postcode
    );

    // Format for frontend
    const valeters = result.rows.map(v => ({
      id: v.id,
      name: v.business_name,
      rating: parseFloat(v.average_rating),
      reviews: v.total_reviews,
      distance: '2.5 miles', // TODO: Calculate actual distance
      prices: {
        small: {
          budget: v.price_small_budget,
          standard: v.price_small_standard,
          premium: v.price_small_premium
        },
        medium: {
          budget: v.price_medium_budget,
          standard: v.price_medium_standard,
          premium: v.price_medium_premium
        },
        large: {
          budget: v.price_large_budget,
          standard: v.price_large_standard,
          premium: v.price_large_premium
        },
        van: {
          budget: v.price_van_budget,
          standard: v.price_van_standard,
          premium: v.price_van_premium
        }
      }
    }));

    res.json({ valeters });

  } catch (error) {
    console.error('Error searching valeters:', error);
    res.status(500).json({ error: 'Failed to search valeters' });
  }
});

// Get valeter profile
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        v.*,
        u.email,
        u.phone
      FROM valeters v
      JOIN users u ON v.user_id = u.id
      WHERE v.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Valeter not found' });
    }

    res.json({ valeter: result.rows[0] });

  } catch (error) {
    console.error('Error fetching valeter:', error);
    res.status(500).json({ error: 'Failed to fetch valeter' });
  }
});

module.exports = router;
