/**
 * Wallet Controller
 * HTTP request handlers for wallet operations
 */

import { Request, Response, NextFunction } from 'express';
import {
    topup,
    bonus,
    spend,
    getBalance,
    getTransactionHistory,
    getTransactionDetails,
} from '../services/wallet.service';
import {
    TopupRequest,
    BonusRequest,
    SpendRequest,
} from '../types/wallet.types';
import { logger } from '../utils/logger';

// ============================================
// Top-up Handler
// ============================================

export async function handleTopup(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const request: TopupRequest = req.body;

        logger.info('Topup request received', {
            user_id: request.user_id,
            asset_code: request.asset_code,
            amount: request.amount,
            reference_id: request.reference_id,
        });

        const result = await topup(request);

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

// ============================================
// Bonus Handler
// ============================================

export async function handleBonus(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const request: BonusRequest = req.body;

        logger.info('Bonus request received', {
            user_id: request.user_id,
            asset_code: request.asset_code,
            amount: request.amount,
            reference_id: request.reference_id,
            bonus_type: request.bonus_type,
        });

        const result = await bonus(request);

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

// ============================================
// Spend Handler
// ============================================

export async function handleSpend(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const request: SpendRequest = req.body;

        logger.info('Spend request received', {
            user_id: request.user_id,
            asset_code: request.asset_code,
            amount: request.amount,
            reference_id: request.reference_id,
            item_id: request.item_id,
        });

        const result = await spend(request);

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

// ============================================
// Get Balance Handler
// ============================================

export async function handleGetBalance(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.params.user_id;
        const assetCode = req.query.asset_code as string | undefined;

        logger.debug('Balance request received', {
            user_id: userId,
            asset_code: assetCode,
        });

        const result = await getBalance(userId, assetCode);

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

// ============================================
// Health Check Handler
// ============================================

export async function handleHealthCheck(
    _req: Request,
    res: Response
): Promise<void> {
    res.status(200).json({
        status: 'healthy',
        service: 'wallet-service',
        timestamp: new Date().toISOString(),
    });
}

// ============================================
// Transaction History Handler
// ============================================

export async function handleGetTransactionHistory(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const userId = req.params.user_id;
        const assetCode = req.query.asset_code as string;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        if (!assetCode) {
            res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'asset_code query parameter is required',
                },
            });
            return;
        }

        logger.debug('Transaction history request received', {
            user_id: userId,
            asset_code: assetCode,
            limit,
            offset,
        });

        const result = await getTransactionHistory(userId, assetCode, limit, offset);

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

// ============================================
// Transaction Details Handler
// ============================================

export async function handleGetTransactionDetails(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const referenceId = req.params.reference_id;

        logger.debug('Transaction details request received', {
            reference_id: referenceId,
        });

        const result = await getTransactionDetails(referenceId);

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}
