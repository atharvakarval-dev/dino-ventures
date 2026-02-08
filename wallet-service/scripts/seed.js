/**
 * Database Seed Script
 * Runs only the seed data
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/wallet_service';

async function runSeed() {
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        console.log('Connecting to database...');

        // Run seed
        const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
        const seedSQL = fs.readFileSync(seedPath, 'utf8');

        console.log('Running seed: seed.sql');
        await pool.query(seedSQL);
        console.log('✅ Seed completed successfully');

    } catch (error) {
        console.error('❌ Error seeding database:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runSeed();
