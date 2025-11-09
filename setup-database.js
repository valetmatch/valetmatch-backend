// setup-database.js
// Run this with: node setup-database.js

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:aWXxmKzjVVjeHnMjuKJtAySaNakVEgYU@yamanote.proxy.rlwy.net:30277/railway';

const setupDatabase = async () => {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✓ Connected!');

    // Create valeters table
    console.log('\nCreating valeters table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS valeters (
        id SERIAL PRIMARY KEY,
        business_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        phone VARCHAR(50) NOT NULL,
        postcode VARCHAR(20) NOT NULL,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        logo_url TEXT,
        services_offered TEXT[] NOT NULL,
        insurance_confirmed BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'pending',
        rating DECIMAL(3, 2) DEFAULT 0,
        total_reviews INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Valeters table created');

    // Create valeter_pricing table
    console.log('Creating valeter_pricing table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS valeter_pricing (
        id SERIAL PRIMARY KEY,
        valeter_id INTEGER REFERENCES valeters(id) ON DELETE CASCADE,
        vehicle_size VARCHAR(20) NOT NULL,
        service_tier VARCHAR(20) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(valeter_id, vehicle_size, service_tier)
      )
    `);
    console.log('✓ Valeter_pricing table created');

    // Create customers table
    console.log('Creating customers table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Customers table created');

    // Create bookings table
    console.log('Creating bookings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        valeter_id INTEGER REFERENCES valeters(id),
        postcode VARCHAR(20) NOT NULL,
        booking_date DATE NOT NULL,
        booking_time TIME NOT NULL,
        vehicle_size VARCHAR(20) NOT NULL,
        service_tier VARCHAR(20) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        photo_urls TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Bookings table created');

    // Create indexes
    console.log('\nCreating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_valeters_postcode ON valeters(postcode)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_valeters_status ON valeters(status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_valeter ON bookings(valeter_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date)');
    console.log('✓ Indexes created');

    // Insert test valeters
    console.log('\n--- Adding Test Valeters ---');
    
    // Elite Auto Care
    console.log('Adding Elite Auto Care...');
    const eliteResult = await client.query(`
      INSERT INTO valeters (business_name, email, phone, postcode, latitude, longitude, services_offered, insurance_confirmed, status, rating, total_reviews)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `, ['Elite Auto Care', 'john@eliteautocare.co.uk', '07700900123', 'PR25 3XY', 53.6917, -2.6937, ['budget', 'standard', 'premium'], true, 'active', 4.9, 234]);
    
    if (eliteResult.rows.length > 0) {
      const eliteId = eliteResult.rows[0].id;
      console.log(`✓ Elite Auto Care added (ID: ${eliteId})`);
      
      // Add pricing for Elite Auto Care
      const elitePrices = [
        ['small', 'budget', 32], ['small', 'standard', 70], ['small', 'premium', 175],
        ['medium', 'budget', 38], ['medium', 'standard', 80], ['medium', 'premium', 195],
        ['large', 'budget', 45], ['large', 'standard', 95], ['large', 'premium', 230],
        ['van', 'budget', 55], ['van', 'standard', 110], ['van', 'premium', 280]
      ];
      
      for (const [size, tier, price] of elitePrices) {
        await client.query(
          'INSERT INTO valeter_pricing (valeter_id, vehicle_size, service_tier, price) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [eliteId, size, tier, price]
        );
      }
      console.log('  ✓ Added 12 prices');
    } else {
      console.log('  ⚠ Elite Auto Care already exists');
    }

    // Shine Masters
    console.log('Adding Shine Masters...');
    const shineResult = await client.query(`
      INSERT INTO valeters (business_name, email, phone, postcode, latitude, longitude, services_offered, insurance_confirmed, status, rating, total_reviews)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `, ['Shine Masters', 'sarah@shinemasters.co.uk', '07700900456', 'PR25 2XX', 53.7017, -2.7037, ['standard', 'premium'], true, 'active', 4.8, 189]);
    
    if (shineResult.rows.length > 0) {
      const shineId = shineResult.rows[0].id;
      console.log(`✓ Shine Masters added (ID: ${shineId})`);
      
      const shinePrices = [
        ['small', 'standard', 65], ['small', 'premium', 170],
        ['medium', 'standard', 75], ['medium', 'premium', 185],
        ['large', 'standard', 90], ['large', 'premium', 220],
        ['van', 'standard', 105], ['van', 'premium', 270]
      ];
      
      for (const [size, tier, price] of shinePrices) {
        await client.query(
          'INSERT INTO valeter_pricing (valeter_id, vehicle_size, service_tier, price) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [shineId, size, tier, price]
        );
      }
      console.log('  ✓ Added 8 prices');
    } else {
      console.log('  ⚠ Shine Masters already exists');
    }

    // Quick Valet Express
    console.log('Adding Quick Valet Express...');
    const quickResult = await client.query(`
      INSERT INTO valeters (business_name, email, phone, postcode, latitude, longitude, services_offered, insurance_confirmed, status, rating, total_reviews)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `, ['Quick Valet Express', 'info@quickvaletexpress.co.uk', '07700900789', 'PR26 7QR', 53.7117, -2.6837, ['budget', 'standard'], true, 'active', 4.7, 156]);
    
    if (quickResult.rows.length > 0) {
      const quickId = quickResult.rows[0].id;
      console.log(`✓ Quick Valet Express added (ID: ${quickId})`);
      
      const quickPrices = [
        ['small', 'budget', 28], ['small', 'standard', 62],
        ['medium', 'budget', 33], ['medium', 'standard', 72],
        ['large', 'budget', 40], ['large', 'standard', 85],
        ['van', 'budget', 48], ['van', 'standard', 100]
      ];
      
      for (const [size, tier, price] of quickPrices) {
        await client.query(
          'INSERT INTO valeter_pricing (valeter_id, vehicle_size, service_tier, price) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [quickId, size, tier, price]
        );
      }
      console.log('  ✓ Added 8 prices');
    } else {
      console.log('  ⚠ Quick Valet Express already exists');
    }

    // Premium Detail Co
    console.log('Adding Premium Detail Co...');
    const premiumResult = await client.query(`
      INSERT INTO valeters (business_name, email, phone, postcode, latitude, longitude, services_offered, insurance_confirmed, status, rating, total_reviews)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `, ['Premium Detail Co', 'contact@premiumdetail.co.uk', '07700900321', 'PR25 4AA', 53.6817, -2.7137, ['premium'], true, 'active', 4.95, 312]);
    
    if (premiumResult.rows.length > 0) {
      const premiumId = premiumResult.rows[0].id;
      console.log(`✓ Premium Detail Co added (ID: ${premiumId})`);
      
      const premiumPrices = [
        ['small', 'premium', 180],
        ['medium', 'premium', 200],
        ['large', 'premium', 240],
        ['van', 'premium', 290]
      ];
      
      for (const [size, tier, price] of premiumPrices) {
        await client.query(
          'INSERT INTO valeter_pricing (valeter_id, vehicle_size, service_tier, price) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
          [premiumId, size, tier, price]
        );
      }
      console.log('  ✓ Added 4 prices');
    } else {
      console.log('  ⚠ Premium Detail Co already exists');
    }

    // Verify data
    console.log('\n--- Verification ---');
    const valeterCount = await client.query('SELECT COUNT(*) FROM valeters');
    const pricingCount = await client.query('SELECT COUNT(*) FROM valeter_pricing');
    
    console.log(`✓ Total valeters: ${valeterCount.rows[0].count}`);
    console.log(`✓ Total prices: ${pricingCount.rows[0].count}`);

    console.log('\n🎉 Database setup complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n✓ Connection closed');
  }
};

setupDatabase();
