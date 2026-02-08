/**
 * Idempotency Middleware
 * Prevents duplicate transaction processing
 */

import { Request, Response, NextFunction } from 'express';
import { findLedgerEntryByReferenceId } from '../repositories/wallet.repository';
import { logger } from '../utils/logger';

// ============================================
// Idempotency Check Middleware
// ============================================

/**
 * Check if a transaction with the same reference_id already exists
 * Returns 409 Conflict with the existing transaction ID if duplicate
 */
export async function checkIdempotency(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const referenceId = req.body?.reference_id;

    if (!referenceId) {
        // No reference_id provided, let validation middleware handle it
        next();
        return;
    }

    try {
        const existingEntry = await findLedgerEntryByReferenceId(referenceId);

        if (existingEntry) {
            logger.info('Duplicate transaction detected by idempotency middleware', {
                referenceId,
                existingTransactionId: existingEntry.transaction_id,
            });

            res.status(409).json({
                error: {
                    code: 'DUPLICATE_TRANSACTION',
                    message: 'A transaction with this reference_id already exists',
                },
                existing_transaction: {
                    transaction_id: existingEntry.transaction_id,
                    created_at: existingEntry.created_at,
                },
            });
            return;
        }

        next();
    } catch (error) {
        // If there's an error checking idempotency, let the request proceed
        // The transaction will handle the uniqueness constraint
        logger.warn('Idempotency check failed, proceeding with request', {
            referenceId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        next();
    }
}

// ============================================
// Idempotency Key Header Support
// ============================================

/**
 * Extract reference_id from X-Idempotency-Key header if not in body
 */
export function extractIdempotencyKey(
    req: Request,
    _res: Response,
    next: NextFunction
): void {
    const headerKey = req.headers['x-idempotency-key'];

    if (headerKey && !req.body?.reference_id) {
        req.body = req.body || {};
        req.body.reference_id = Array.isArray(headerKey) ? headerKey[0] : headerKey;
    }

    next();
}
