const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Search for valeters by postcode and service type
router.get('/search', async (req, res) => {
  try {
    const { postcode, serviceType } = req.query;

    console.log('🔍 Searching valeters:', { postcode, serviceType });

    if (!postcode) {
      return res.status(400).json({ error: 'Postcode is required' });
    }

    // Build the query based on service type
    let query = `
      SELECT 
        v.id,
        v.business_name,
        v.rating,
        v.total_reviews,
        v.postcode,
        v.service_types,
        v.business_address,
        json_agg(
          json_build_object(
            'vehicle_size', vp.vehicle_size,
            'service_tier', vp.service_tier,
            'price', vp.price
          )
        ) as pricing
      FROM valeters v
      LEFT JOIN valeter_pricing vp ON v.id = vp.valeter_id
      WHERE v.status = 'active'
    `;

    // Add service type filter if provided
    const params = [postcode];
    if (serviceType && (serviceType === 'mobile' || serviceType === 'premises')) {
      query += ` AND $2 = ANY(v.service_types)`;
      params.push(serviceType);
    }

    query += `
      GROUP BY v.id
      ORDER BY v.rating DESC, v.total_reviews DESC
    `;

    const result = await pool.query(query, params);

    // Transform the data to match frontend expectations
    const valeters = result.rows.map(row => {
      // Convert pricing array to object structure
      const prices = {
        small: {},
        medium: {},
        large: {},
        van: {}
      };

      row.pricing.forEach(p => {
        if (p.vehicle_size && p.service_tier) {
          prices[p.vehicle_size][p.service_tier] = parseFloat(p.price);
        }
      });

      return {
        id: row.id,
        name: row.business_name,
        rating: parseFloat(row.rating),
        reviews: row.total_reviews,
        distance: '2.5 miles', // TODO: Calculate real distance based on postcodes
        postcode: row.postcode,
        serviceTypes: row.service_types,
        businessAddress: row.business_address,
        prices: prices
      };
    });

    console.log(`✅ Found ${valeters.length} valeters`);
    
    res.json({
      success: true,
      count: valeters.length,
      valeters: valeters,
      serviceType: serviceType || 'all'
    });

  } catch (error) {
    console.error('❌ Error searching valeters:', error);
    res.status(500).json({ 
      error: 'Failed to search valeters',
      details: error.message 
    });
  }
});

// Get a single valeter by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        v.*,
        json_agg(
          json_build_object(
            'vehicle_size', vp.vehicle_size,
            'service_tier', vp.service_tier,
            'price', vp.price
          )
        ) as pricing
      FROM valeters v
      LEFT JOIN valeter_pricing vp ON v.id = vp.valeter_id
      WHERE v.id = $1
      GROUP BY v.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Valeter not found' });
    }

    res.json({
      success: true,
      valeter: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error fetching valeter:', error);
    res.status(500).json({ 
      error: 'Failed to fetch valeter',
      details: error.message 
    });
  }
});

module.exports = router;
