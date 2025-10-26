const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const setupDatabase = async () => {
  try {
    await pool.query(`
      -- Users (Customers)
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Valeters (Service Providers)
      CREATE TABLE IF NOT EXISTS valeters (
        id SERIAL PRIMARY KEY,
        business_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        postcode VARCHAR(10) NOT NULL,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        services JSONB DEFAULT '[]',
        pricing JSONB DEFAULT '{}',
        rating DECIMAL(3, 2) DEFAULT 0,
        total_reviews INTEGER DEFAULT 0,
        insurance_verified BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Bookings
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        valeter_id INTEGER REFERENCES valeters(id) ON DELETE CASCADE,
        postcode VARCHAR(10) NOT NULL,
        booking_date DATE NOT NULL,
        booking_time TIME NOT NULL,
        vehicle_size VARCHAR(20) NOT NULL,
        service_tier VARCHAR(20) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        commission DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        photos JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Reviews
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        valeter_id INTEGER REFERENCES valeters(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        photos JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Admin Users
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_valeter ON bookings(valeter_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
      CREATE INDEX IF NOT EXISTS idx_valeters_postcode ON valeters(postcode);
      CREATE INDEX IF NOT EXISTS idx_reviews_valeter ON reviews(valeter_id);
    `);

    console.log('✅ Database schema created successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
};

setupDatabase();
