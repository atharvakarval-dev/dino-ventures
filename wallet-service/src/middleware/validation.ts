/**
 * Request Validation Middleware
 * Uses Zod for type-safe validation
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors';

// ============================================
// Validation Schemas
// ============================================

export const TopupSchema = z.object({
    user_id: z.string().min(1, 'user_id is required'),
    asset_code: z.string().min(1, 'asset_code is required'),
    amount: z.number().int().positive('amount must be a positive integer'),
    reference_id: z.string().min(1, 'reference_id is required').max(100),
    payment_method: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
});

export const BonusSchema = z.object({
    user_id: z.string().min(1, 'user_id is required'),
    asset_code: z.string().min(1, 'asset_code is required'),
    amount: z.number().int().positive('amount must be a positive integer'),
    reference_id: z.string().min(1, 'reference_id is required').max(100),
    bonus_type: z.string().min(1, 'bonus_type is required'),
    metadata: z.record(z.unknown()).optional(),
});

export const SpendSchema = z.object({
    user_id: z.string().min(1, 'user_id is required'),
    asset_code: z.string().min(1, 'asset_code is required'),
    amount: z.number().int().positive('amount must be a positive integer'),
    reference_id: z.string().min(1, 'reference_id is required').max(100),
    item_id: z.string().min(1, 'item_id is required'),
    metadata: z.record(z.unknown()).optional(),
});

export const GetBalanceQuerySchema = z.object({
    asset_code: z.string().optional(),
});

export const TransactionHistoryQuerySchema = z.object({
    asset_code: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
});

// ============================================
// Validation Middleware Factory
// ============================================

/**
 * Create a validation middleware for request body
 */
export function validateBody<T>(schema: ZodSchema<T>) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            req.body = schema.parse(req.body);
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const details = error.errors.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message,
                }));
                next(new ValidationError('Invalid request body', { errors: details }));
            } else {
                next(error);
            }
        }
    };
}

/**
 * Create a validation middleware for query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            req.query = schema.parse(req.query) as typeof req.query;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const details = error.errors.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message,
                }));
                next(new ValidationError('Invalid query parameters', { errors: details }));
            } else {
                next(error);
            }
        }
    };
}

/**
 * Validate URL parameters
 */
export function validateParams<T>(schema: ZodSchema<T>) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            req.params = schema.parse(req.params) as typeof req.params;
            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const details = error.errors.map((e) => ({
                    field: e.path.join('.'),
                    message: e.message,
                }));
                next(new ValidationError('Invalid URL parameters', { errors: details }));
            } else {
                next(error);
            }
        }
    };
}
