const { Pool } = require('pg');

// Railway PostgreSQL connection
const pool = new Pool({
  connectionString: 'postgresql://postgres:aWXxmKzjVVjeHnMjuKJtAySaNakVEgYU@yamanote.proxy.rlwy.net:30277/railway',
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting migration: Adding mobile vs premises columns...\n');

    // 1. Add columns to valeters table
    console.log('1️⃣ Adding columns to valeters table...');
    
    await client.query(`
      ALTER TABLE valeters 
      ADD COLUMN IF NOT EXISTS service_types TEXT[] DEFAULT ARRAY['mobile'];
    `);
    console.log('   ✅ Added service_types column');

    await client.query(`
      ALTER TABLE valeters 
      ADD COLUMN IF NOT EXISTS business_address TEXT;
    `);
    console.log('   ✅ Added business_address column');

    await client.query(`
      UPDATE valeters 
      SET service_types = ARRAY['mobile'] 
      WHERE service_types IS NULL OR service_types = '{}';
    `);
    console.log('   ✅ Updated existing valeters to offer mobile service');

    // 2. Add columns to bookings table
    console.log('\n2️⃣ Adding columns to bookings table...');
    
    await client.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) DEFAULT 'mobile';
    `);
    console.log('   ✅ Added service_type column');

    await client.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS address TEXT;
    `);
    console.log('   ✅ Added address column');

    await client.query(`
      UPDATE bookings 
      SET service_type = 'mobile' 
      WHERE service_type IS NULL;
    `);
    console.log('   ✅ Updated existing bookings to mobile service');

    // 3. Update test valeters with varied service types
    console.log('\n3️⃣ Updating test valeters with service types...');
    
    // Elite Auto Care - offers both
    await client.query(`
      UPDATE valeters 
      SET service_types = ARRAY['mobile', 'premises'],
          business_address = '123 Preston Road, Leyland, Lancashire, PR25 3AB'
      WHERE business_name = 'Elite Auto Care';
    `);
    console.log('   ✅ Elite Auto Care: mobile + premises');

    // Shine Masters - mobile only
    await client.query(`
      UPDATE valeters 
      SET service_types = ARRAY['mobile']
      WHERE business_name = 'Shine Masters';
    `);
    console.log('   ✅ Shine Masters: mobile only');

    // Quick Valet Express - premises only
    await client.query(`
      UPDATE valeters 
      SET service_types = ARRAY['premises'],
          business_address = '45 Industrial Estate, Leyland, Lancashire, PR25 1XY'
      WHERE business_name = 'Quick Valet Express';
    `);
    console.log('   ✅ Quick Valet Express: premises only');

    // Premium Detail Co - both
    await client.query(`
      UPDATE valeters 
      SET service_types = ARRAY['mobile', 'premises'],
          business_address = '78 High Street, Preston, Lancashire, PR1 2QR'
      WHERE business_name = 'Premium Detail Co';
    `);
    console.log('   ✅ Premium Detail Co: mobile + premises');

    // 4. Verify changes
    console.log('\n4️⃣ Verifying changes...');
    const result = await client.query(`
      SELECT business_name, service_types, business_address 
      FROM valeters 
      ORDER BY id;
    `);
    
    console.log('\n📊 Valeters service types:');
    console.log('─────────────────────────────────────────────────────────────');
    result.rows.forEach(row => {
      console.log(`\n${row.business_name}:`);
      console.log(`  Service types: ${row.service_types.join(', ')}`);
      if (row.business_address) {
        console.log(`  Address: ${row.business_address}`);
      } else {
        console.log(`  Address: (none - mobile only)`);
      }
    });
    console.log('\n─────────────────────────────────────────────────────────────');

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - Added service_types[] to valeters table');
    console.log('   - Added business_address to valeters table');
    console.log('   - Added service_type to bookings table');
    console.log('   - Added address to bookings table');
    console.log('   - Updated test valeters with varied service types');
    console.log('\n🎉 Database is ready for mobile vs premises feature!\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
console.log('═══════════════════════════════════════════════════════════');
console.log('  VALET MATCH - MOBILE VS PREMISES MIGRATION');
console.log('═══════════════════════════════════════════════════════════\n');

runMigration()
  .then(() => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ALL DONE! ✨');
    console.log('═══════════════════════════════════════════════════════════\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Error:', error.message);
    process.exit(1);
  });
