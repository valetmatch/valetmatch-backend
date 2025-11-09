// migrate.js
// Run this once to set up your database
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const runMigration = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting database migration...');
    
    await client.query('BEGIN');
    
    // Drop old tables
    console.log('📦 Dropping old tables...');
    await client.query(`
      DROP TABLE IF EXISTS admin_actions CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS reviews CASCADE;
      DROP TABLE IF EXISTS booking_photos CASCADE;
      DROP TABLE IF EXISTS bookings CASCADE;
      DROP TABLE IF EXISTS valeters CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS customers CASCADE;
      DROP TABLE IF EXISTS valeter_pricing CASCADE;
    `);
    console.log('✅ Old tables dropped');
    
    // Enable UUID extension
    console.log('🔧 Enabling UUID extension...');
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    
    // Create users table
    console.log('👤 Creating users table...');
    await client.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(20),
        user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('customer', 'valeter', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        email_verified BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);
    await client.query(`CREATE INDEX idx_users_email ON users(email)`);
    await client.query(`CREATE INDEX idx_users_type ON users(user_type)`);
    console.log('✅ Users table created');
    
    // Create valeters table
    console.log('🚗 Creating valeters table...');
    await client.query(`
      CREATE TABLE valeters (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        business_name VARCHAR(255) NOT NULL,
        postcode VARCHAR(10) NOT NULL,
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        offers_budget BOOLEAN DEFAULT FALSE,
        offers_standard BOOLEAN DEFAULT FALSE,
        offers_premium BOOLEAN DEFAULT FALSE,
        price_small_budget DECIMAL(10, 2),
        price_small_standard DECIMAL(10, 2),
        price_small_premium DECIMAL(10, 2),
        price_medium_budget DECIMAL(10, 2),
        price_medium_standard DECIMAL(10, 2),
        price_medium_premium DECIMAL(10, 2),
        price_large_budget DECIMAL(10, 2),
        price_large_standard DECIMAL(10, 2),
        price_large_premium DECIMAL(10, 2),
        price_van_budget DECIMAL(10, 2),
        price_van_standard DECIMAL(10, 2),
        price_van_premium DECIMAL(10, 2),
        has_insurance BOOLEAN DEFAULT FALSE,
        insurance_expiry DATE,
        bio TEXT,
        profile_image_url VARCHAR(500),
        service_radius_miles INT DEFAULT 10,
        is_mobile BOOLEAN DEFAULT TRUE,
        has_premises BOOLEAN DEFAULT FALSE,
        premises_address TEXT,
        application_status VARCHAR(20) DEFAULT 'pending' CHECK (application_status IN ('pending', 'approved', 'rejected', 'suspended')),
        approved_at TIMESTAMP,
        approved_by UUID REFERENCES users(id),
        total_bookings INT DEFAULT 0,
        completed_bookings INT DEFAULT 0,
        average_rating DECIMAL(3, 2) DEFAULT 0.00,
        total_reviews INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX idx_valeters_postcode ON valeters(postcode)`);
    await client.query(`CREATE INDEX idx_valeters_status ON valeters(application_status)`);
    console.log('✅ Valeters table created');
    
    // Create bookings table
    console.log('📅 Creating bookings table...');
    await client.query(`
      CREATE TABLE bookings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
        valeter_id UUID REFERENCES valeters(id) ON DELETE SET NULL,
        customer_name VARCHAR(200),
        customer_email VARCHAR(255),
        customer_phone VARCHAR(20),
        postcode VARCHAR(10) NOT NULL,
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        booking_date DATE NOT NULL,
        booking_time TIME NOT NULL,
        vehicle_size VARCHAR(20) NOT NULL CHECK (vehicle_size IN ('small', 'medium', 'large', 'van')),
        vehicle_make VARCHAR(100),
        vehicle_model VARCHAR(100),
        vehicle_color VARCHAR(50),
        vehicle_registration VARCHAR(20),
        service_tier VARCHAR(20) NOT NULL CHECK (service_tier IN ('budget', 'standard', 'premium')),
        service_location VARCHAR(20) DEFAULT 'mobile' CHECK (service_location IN ('mobile', 'premises')),
        special_instructions TEXT,
        price_quoted DECIMAL(10, 2) NOT NULL,
        platform_commission DECIMAL(10, 2) NOT NULL,
        valeter_earnings DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'disputed')),
        confirmed_at TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        cancellation_reason TEXT,
        payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'authorized', 'paid', 'refunded', 'disputed')),
        payment_intent_id VARCHAR(255),
        paid_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX idx_bookings_customer ON bookings(customer_id)`);
    await client.query(`CREATE INDEX idx_bookings_valeter ON bookings(valeter_id)`);
    await client.query(`CREATE INDEX idx_bookings_date ON bookings(booking_date)`);
    await client.query(`CREATE INDEX idx_bookings_status ON bookings(status)`);
    console.log('✅ Bookings table created');
    
    // Create booking_photos table
    console.log('📸 Creating booking_photos table...');
    await client.query(`
      CREATE TABLE booking_photos (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
        photo_type VARCHAR(50) NOT NULL CHECK (photo_type IN ('exterior1', 'exterior2', 'frontInterior', 'rearInterior', 'after', 'proof')),
        photo_url VARCHAR(500) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX idx_photos_booking ON booking_photos(booking_id)`);
    console.log('✅ Booking photos table created');
    
    // Create reviews table
    console.log('⭐ Creating reviews table...');
    await client.query(`
      CREATE TABLE reviews (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        booking_id UUID UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
        customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
        valeter_id UUID REFERENCES valeters(id) ON DELETE CASCADE,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review_text TEXT,
        valeter_response TEXT,
        valeter_response_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX idx_reviews_valeter ON reviews(valeter_id)`);
    await client.query(`CREATE INDEX idx_reviews_rating ON reviews(rating)`);
    console.log('✅ Reviews table created');
    
    // Create notifications table
    console.log('🔔 Creating notifications table...');
    await client.query(`
      CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        notification_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(500),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX idx_notifications_user ON notifications(user_id)`);
    await client.query(`CREATE INDEX idx_notifications_read ON notifications(is_read)`);
    console.log('✅ Notifications table created');
    
    // Create admin_actions table
    console.log('👨‍💼 Creating admin_actions table...');
    await client.query(`
      CREATE TABLE admin_actions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action_type VARCHAR(50) NOT NULL,
        target_type VARCHAR(50),
        target_id UUID,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX idx_admin_actions_admin ON admin_actions(admin_id)`);
    await client.query(`CREATE INDEX idx_admin_actions_type ON admin_actions(action_type)`);
    console.log('✅ Admin actions table created');
    
    // Create triggers
    console.log('⚡ Creating triggers...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    
    await client.query(`CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    await client.query(`CREATE TRIGGER update_valeters_updated_at BEFORE UPDATE ON valeters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    await client.query(`CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    await client.query(`CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
    console.log('✅ Triggers created');
    
    // Create admin user
    console.log('👤 Creating admin user...');
    await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, user_type, email_verified, is_active)
      VALUES ('admin@valetmatch.co.uk', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', 'admin', TRUE, TRUE)
    `);
    console.log('✅ Admin user created (email: admin@valetmatch.co.uk, password: admin123)');
    
    await client.query('COMMIT');
    
    console.log('');
    console.log('🎉 DATABASE MIGRATION COMPLETE!');
    console.log('');
    console.log('📊 Tables created:');
    console.log('  ✓ users');
    console.log('  ✓ valeters');
    console.log('  ✓ bookings');
    console.log('  ✓ booking_photos');
    console.log('  ✓ reviews');
    console.log('  ✓ notifications');
    console.log('  ✓ admin_actions');
    console.log('');
    console.log('👤 Admin login:');
    console.log('  Email: admin@valetmatch.co.uk');
    console.log('  Password: admin123');
    console.log('  ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!');
    console.log('');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// Run migration
runMigration()
  .then(() => {
    console.log('✅ Migration script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
