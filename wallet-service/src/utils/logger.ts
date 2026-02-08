/**
 * Logger Utility
 * Winston-based structured logging
 */

import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';

// ============================================
// Custom Format
// ============================================

const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    isProduction
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, ...meta }) => {
                const metaString = Object.keys(meta).length
                    ? `\n${JSON.stringify(meta, null, 2)}`
                    : '';
                return `${timestamp} [${level}]: ${message}${metaString}`;
            })
        )
);

// ============================================
// Logger Instance
// ============================================

export const logger = winston.createLogger({
    level: logLevel,
    format: customFormat,
    defaultMeta: { service: 'wallet-service' },
    transports: [
        new winston.transports.Console(),
    ],
});

// ============================================
// Request Logger Helper
// ============================================

export function logRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    meta?: Record<string, unknown>
): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    logger.log(level, `${method} ${path} ${statusCode} ${durationMs}ms`, {
        method,
        path,
        statusCode,
        durationMs,
        ...meta,
    });
}

// ============================================
// Transaction Logger Helper
// ============================================

export function logTransaction(
    transactionId: string,
    transactionType: string,
    userId: string,
    amount: number,
    assetCode: string,
    status: 'initiated' | 'completed' | 'failed',
    meta?: Record<string, unknown>
): void {
    logger.info(`Transaction ${status}`, {
        transactionId,
        transactionType,
        userId,
        amount,
        assetCode,
        status,
        ...meta,
    });
}
