const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');

const router = express.Router();

// Generate JWT token
const generateToken = (id, type) => {
  return jwt.sign({ id, type }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// CUSTOMER REGISTRATION
router.post('/customer/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('phone').optional().trim()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, firstName, lastName, phone } = req.body;

      // Check if user exists
      const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Insert user
      const result = await db.query(
        'INSERT INTO users (email, password_hash, first_name, last_name, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name',
        [email, passwordHash, firstName, lastName, phone || null]
      );

      const user = result.rows[0];
      const token = generateToken(user.id, 'customer');

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// CUSTOMER LOGIN
router.post('/customer/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];

      // Check password
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken(user.id, 'customer');

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// VALETER REGISTRATION
router.post('/valeter/register',
  [
    body('businessName').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('phone').trim().notEmpty(),
    body('postcode').trim().notEmpty(),
    body('services').isArray().notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { businessName, email, password, phone, postcode, services } = req.body;

      // Check if valeter exists
      const existingValeter = await db.query('SELECT id FROM valeters WHERE email = $1', [email]);
      if (existingValeter.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // Insert valeter (status = pending until admin approves)
      const result = await db.query(
        `INSERT INTO valeters (business_name, email, password_hash, phone, postcode, services, status) 
         VALUES ($1, $2, $3, $4, $5, $6, 'pending') 
         RETURNING id, business_name, email, status`,
        [businessName, email, passwordHash, phone, postcode, JSON.stringify(services)]
      );

      const valeter = result.rows[0];

      res.status(201).json({
        message: 'Application submitted successfully. We will review and contact you within 24 hours.',
        valeter: {
          id: valeter.id,
          businessName: valeter.business_name,
          email: valeter.email,
          status: valeter.status
        }
      });
    } catch (error) {
      console.error('Valeter registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// VALETER LOGIN
router.post('/valeter/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find valeter
      const result = await db.query('SELECT * FROM valeters WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valeter = result.rows[0];

      // Check if approved
      if (valeter.status !== 'approved') {
        return res.status(403).json({ error: 'Account pending approval' });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, valeter.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = generateToken(valeter.id, 'valeter');

      res.json({
        token,
        valeter: {
          id: valeter.id,
          businessName: valeter.business_name,
          email: valeter.email,
          rating: parseFloat(valeter.rating),
          totalReviews: valeter.total_reviews
        }
      });
    } catch (error) {
      console.error('Valeter login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

module.exports = router;
