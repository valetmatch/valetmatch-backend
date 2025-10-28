const express = require('express');
const db = require('../config/database');

const router = express.Router();

// SEARCH VALETERS BY POSTCODE
router.get('/search', async (req, res) => {
  try {
    const { postcode } = req.query;

    if (!postcode) {
      return res.status(400).json({ error: 'Postcode is required' });
    }

    // Get approved valeters with their pricing
    // Changed from 'approved' to 'active' to match our database setup
    const valetersResult = await db.query(
      `SELECT id, business_name, rating, total_reviews, postcode, services_offered
       FROM valeters 
       WHERE status = 'active'
       ORDER BY rating DESC
       LIMIT 20`
    );

    if (valetersResult.rows.length === 0) {
      return res.json([]); // Return empty array if no valeters found
    }

    // Get all valeter IDs
    const valeterIds = valetersResult.rows.map(v => v.id);

    // Get all pricing for these valeters
    const pricingResult = await db.query(
      `SELECT valeter_id, vehicle_size, service_tier, price
       FROM valeter_pricing
       WHERE valeter_id = ANY($1)`,
      [valeterIds]
    );

    // Build pricing lookup object
    const pricingByValeter = {};
    pricingResult.rows.forEach(row => {
      if (!pricingByValeter[row.valeter_id]) {
        pricingByValeter[row.valeter_id] = {
          small: {},
          medium: {},
          large: {},
          van: {}
        };
      }
      pricingByValeter[row.valeter_id][row.vehicle_size][row.service_tier] = parseFloat(row.price);
    });

    // Format response to match frontend expectations
    const valeters = valetersResult.rows.map(row => ({
      id: row.id,
      name: row.business_name,
      rating: parseFloat(row.rating) || 0,
      reviews: row.total_reviews || 0,
      distance: '2.5 miles', // TODO: Calculate real distance based on postcode
      prices: pricingByValeter[row.id] || {}
    }));

    res.json(valeters);
  } catch (error) {
    console.error('Search valeters error:', error);
    res.status(500).json({ error: 'Failed to search valeters' });
  }
});

// GET VALETER DETAILS
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const valeterResult = await db.query(
      `SELECT id, business_name, rating, total_reviews, postcode, services_offered, created_at
       FROM valeters 
       WHERE id = $1 AND status = 'active'`,
      [id]
    );

    if (valeterResult.rows.length === 0) {
      return res.status(404).json({ error: 'Valeter not found' });
    }

    const valeter = valeterResult.rows[0];

    // Get pricing for this valeter
    const pricingResult = await db.query(
      `SELECT vehicle_size, service_tier, price
       FROM valeter_pricing
       WHERE valeter_id = $1`,
      [id]
    );

    // Build pricing object
    const prices = {
      small: {},
      medium: {},
      large: {},
      van: {}
    };

    pricingResult.rows.forEach(row => {
      prices[row.vehicle_size][row.service_tier] = parseFloat(row.price);
    });

    res.json({
      id: valeter.id,
      name: valeter.business_name,
      rating: parseFloat(valeter.rating) || 0,
      reviews: valeter.total_reviews || 0,
      postcode: valeter.postcode,
      servicesOffered: valeter.services_offered,
      prices: prices,
      memberSince: valeter.created_at
    });
  } catch (error) {
    console.error('Get valeter error:', error);
    res.status(500).json({ error: 'Failed to fetch valeter' });
  }
});

module.exports = router;
