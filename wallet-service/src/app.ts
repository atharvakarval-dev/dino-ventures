/**
 * Wallet Service Application
 * Express server with all routes and middleware configured
 */

import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';

import {
    handleTopup,
    handleBonus,
    handleSpend,
    handleGetBalance,
    handleHealthCheck,
    handleGetTransactionHistory,
    handleGetTransactionDetails,
} from './controllers/wallet.controller';
import {
    validateBody,
    validateQuery,
    TopupSchema,
    BonusSchema,
    SpendSchema,
    TransactionHistoryQuerySchema,
} from './middleware/validation';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { checkIdempotency, extractIdempotencyKey } from './middleware/idempotency';
import { closePool, checkDatabaseHealth } from './config/database';
import { logger, logRequest } from './utils/logger';

// ============================================
// App Configuration
// ============================================

const app: Express = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Middleware Setup
// ============================================

// Security headers
app.use(helmet());

// CORS
app.use(cors());

// Compression
app.use(compression());

// JSON body parsing
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logRequest(req.method, req.path, res.statusCode, duration, {
            referenceId: req.body?.reference_id,
        });
    });

    next();
});

// ============================================
// API Routes v1
// ============================================

const router = express.Router();

// Health check
router.get('/health', handleHealthCheck);

// Wallet operations
router.post(
    '/wallets/topup',
    extractIdempotencyKey,
    validateBody(TopupSchema),
    checkIdempotency,
    handleTopup
);

router.post(
    '/wallets/bonus',
    extractIdempotencyKey,
    validateBody(BonusSchema),
    checkIdempotency,
    handleBonus
);

router.post(
    '/wallets/spend',
    extractIdempotencyKey,
    validateBody(SpendSchema),
    checkIdempotency,
    handleSpend
);

router.get(
    '/wallets/:user_id/balance',
    handleGetBalance
);

// Transaction history
router.get(
    '/wallets/:user_id/transactions',
    validateQuery(TransactionHistoryQuerySchema),
    handleGetTransactionHistory
);

// Transaction details by reference_id
router.get(
    '/transactions/:reference_id',
    handleGetTransactionDetails
);

// Mount router
app.use('/api/v1', router);

// ============================================
// Error Handling
// ============================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// Server Startup
// ============================================

async function startServer(): Promise<void> {
    try {
        // Test database connection
        logger.info('Testing database connection...');
        const dbHealthy = await checkDatabaseHealth();

        if (!dbHealthy) {
            throw new Error('Database health check failed');
        }

        logger.info('Database connection successful');

        // Start server
        app.listen(PORT, () => {
            logger.info(`Wallet service started`, {
                port: PORT,
                environment: process.env.NODE_ENV || 'development',
            });
        });
    } catch (error) {
        logger.error('Failed to start server', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        process.exit(1);
    }
}

// ============================================
// Graceful Shutdown
// ============================================

async function gracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    try {
        await closePool();
        logger.info('Database connections closed');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// Start Application
// ============================================

startServer();

export default app;
