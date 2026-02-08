/**
 * Database Configuration
 * PostgreSQL connection pool with optimized settings
 */

import { Pool, PoolConfig, PoolClient } from 'pg';
import { logger } from '../utils/logger';

// ============================================
// Environment Configuration
// ============================================

const getDatabaseUrl = (): string => {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is required');
    }

    return databaseUrl;
};

// ============================================
// Pool Configuration
// ============================================

const poolConfig: PoolConfig = {
    connectionString: getDatabaseUrl(),
    max: 20,                          // Maximum pool size
    idleTimeoutMillis: 30000,         // Close idle clients after 30s
    connectionTimeoutMillis: 5000,    // Fail if connection takes > 5s
    allowExitOnIdle: false,           // Keep pool alive
};

// ============================================
// Connection Pool Instance
// ============================================

let pool: Pool | null = null;

export const getPool = (): Pool => {
    if (!pool) {
        pool = new Pool(poolConfig);

        pool.on('error', (err: Error) => {
            logger.error('Unexpected database pool error', { error: err.message });
        });

        pool.on('connect', () => {
            logger.debug('New database connection established');
        });
    }

    return pool;
};

// ============================================
// Transaction Helper
// ============================================

export type TransactionCallback<T> = (client: PoolClient) => Promise<T>;

/**
 * Execute operations within a SERIALIZABLE transaction
 * Provides automatic rollback on error
 */
export async function withTransaction<T>(
    callback: TransactionCallback<T>,
    isolationLevel: 'SERIALIZABLE' | 'REPEATABLE READ' | 'READ COMMITTED' = 'SERIALIZABLE'
): Promise<T> {
    const client = await getPool().connect();

    try {
        await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);

        const result = await callback(client);

        await client.query('COMMIT');

        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// ============================================
// Query Helper
// ============================================

/**
 * Execute a single query using pool connection
 */
export async function query<T>(
    sql: string,
    params?: unknown[]
): Promise<T[]> {
    const pool = getPool();
    const result = await pool.query(sql, params);
    return result.rows as T[];
}

// ============================================
// Health Check
// ============================================

export async function checkDatabaseHealth(): Promise<boolean> {
    try {
        const pool = getPool();
        const result = await pool.query('SELECT 1 as health');
        return result.rows.length > 0;
    } catch (error) {
        logger.error('Database health check failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return false;
    }
}

// ============================================
// Graceful Shutdown
// ============================================

export async function closePool(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
        logger.info('Database pool closed');
    }
}

export { PoolClient };
