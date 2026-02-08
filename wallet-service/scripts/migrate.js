/**
 * Database Migration Script
 * Runs SQL migrations and seeds
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/wallet_service';

async function runMigrations() {
    const pool = new Pool({ connectionString: DATABASE_URL });

    try {
        console.log('Connecting to database...');

        // Run migration
        const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '001_initial_schema.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('Running migration: 001_initial_schema.sql');
        await pool.query(migrationSQL);
        console.log('✅ Migration completed');

        // Run seed
        const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
        const seedSQL = fs.readFileSync(seedPath, 'utf8');

        console.log('Running seed: seed.sql');
        await pool.query(seedSQL);
        console.log('✅ Seed completed');

        console.log('\n🎉 Database setup complete!');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigrations();
