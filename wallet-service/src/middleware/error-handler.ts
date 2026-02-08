/**
 * Error Handler Middleware
 * Centralized error handling for all routes
 */

import { Request, Response, NextFunction } from 'express';
import { WalletServiceError } from '../errors';
import { logger } from '../utils/logger';

// ============================================
// Error Response Interface
// ============================================

interface ErrorResponse {
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}

// ============================================
// Error Handler Middleware
// ============================================

export function errorHandler(
    error: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    // Log the error
    logger.error('Request error', {
        method: req.method,
        path: req.path,
        error: error.message,
        stack: error.stack,
    });

    // Handle known wallet service errors
    if (error instanceof WalletServiceError) {
        const response: ErrorResponse = {
            error: {
                code: error.code,
                message: error.message,
                details: error.details,
            },
        };
        res.status(error.statusCode).json(response);
        return;
    }

    // Handle PostgreSQL unique constraint violation (duplicate key)
    if (isPostgresError(error) && error.code === '23505') {
        const response: ErrorResponse = {
            error: {
                code: 'DUPLICATE_TRANSACTION',
                message: 'A transaction with this reference already exists',
            },
        };
        res.status(409).json(response);
        return;
    }

    // Handle PostgreSQL serialization failure (retry-able)
    if (isPostgresError(error) && error.code === '40001') {
        const response: ErrorResponse = {
            error: {
                code: 'CONCURRENCY_ERROR',
                message: 'Transaction conflict, please retry',
            },
        };
        res.status(409).json(response);
        return;
    }

    // Handle PostgreSQL lock not available
    if (isPostgresError(error) && error.code === '55P03') {
        const response: ErrorResponse = {
            error: {
                code: 'LOCK_NOT_AVAILABLE',
                message: 'Resource is temporarily locked, please retry',
            },
        };
        res.status(503).json(response);
        return;
    }

    // Handle unknown errors
    const response: ErrorResponse = {
        error: {
            code: 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'production'
                ? 'An unexpected error occurred'
                : error.message,
        },
    };
    res.status(500).json(response);
}

// ============================================
// Type Guards
// ============================================

interface PostgresError extends Error {
    code: string;
    detail?: string;
    constraint?: string;
}

function isPostgresError(error: Error): error is PostgresError {
    return 'code' in error && typeof (error as PostgresError).code === 'string';
}

// ============================================
// Not Found Handler
// ============================================

export function notFoundHandler(
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    res.status(404).json({
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.path} not found`,
        },
    });
}
