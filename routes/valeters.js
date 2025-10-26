const express = require('express');
const db = require('../config/database');

const router = express.Router();

// SEARCH VALETERS BY POSTCODE
router.get('/search', async (req, res) => {
  try {
    const { postcode, vehicleSize, serviceTier } = req.query;

    if (!postcode) {
      return res.status(400).json({ error: 'Postcode is required' });
    }

    // Get approved valeters
    // TODO: Add actual distance calculation using postcodes
    const result = await db.query(
      `SELECT id, business_name, rating, total_reviews, postcode, services, pricing
       FROM valeters 
       WHERE status = 'approved'
       ORDER BY rating DESC
       LIMIT 20`
    );

    const valeters = result.rows.map(row => ({
      id: row.id,
      name: row.business_name,
      rating: parseFloat(row.rating) || 0,
      reviews: row.total_reviews || 0,
      distance: '2.5 miles', // TODO: Calculate real distance
      services: row.services,
      pricing: row.pricing
    }));

    res.json({ valeters });
  } catch (error) {
    console.error('Search valeters error:', error);
    res.status(500).json({ error: 'Failed to search valeters' });
  }
});

// GET VALETER DETAILS
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, business_name, rating, total_reviews, postcode, services, pricing, created_at
       FROM valeters 
       WHERE id = $1 AND status = 'approved'`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Valeter not found' });
    }

    const valeter = result.rows[0];

    res.json({
      id: valeter.id,
      name: valeter.business_name,
      rating: parseFloat(valeter.rating) || 0,
      reviews: valeter.total_reviews || 0,
      postcode: valeter.postcode,
      services: valeter.services,
      pricing: valeter.pricing,
      memberSince: valeter.created_at
    });
  } catch (error) {
    console.error('Get valeter error:', error);
    res.status(500).json({ error: 'Failed to fetch valeter' });
  }
});

module.exports = router;
