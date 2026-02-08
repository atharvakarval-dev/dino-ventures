/**
 * Custom Error Classes
 * Domain-specific errors for wallet operations
 */

// ============================================
// Base Wallet Error
// ============================================

export class WalletServiceError extends Error {
    public readonly code: string;
    public readonly statusCode: number;
    public readonly details?: Record<string, unknown>;

    constructor(
        message: string,
        code: string,
        statusCode: number,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON(): Record<string, unknown> {
        return {
            error: {
                code: this.code,
                message: this.message,
                details: this.details,
            },
        };
    }
}

// ============================================
// Specific Error Classes
// ============================================

export class InsufficientFundsError extends WalletServiceError {
    constructor(required: number, available: number, assetCode: string) {
        super(
            `Insufficient funds: required ${required}, available ${available}`,
            'INSUFFICIENT_FUNDS',
            400,
            { required, available, assetCode }
        );
    }
}

export class DuplicateTransactionError extends WalletServiceError {
    constructor(referenceId: string, existingTransactionId?: string) {
        super(
            `Transaction with reference_id '${referenceId}' already exists`,
            'DUPLICATE_TRANSACTION',
            409,
            { referenceId, existingTransactionId }
        );
    }
}

export class WalletNotFoundError extends WalletServiceError {
    constructor(identifier: string, type: 'user_id' | 'wallet_id' = 'user_id') {
        super(
            `Wallet not found for ${type}: ${identifier}`,
            'WALLET_NOT_FOUND',
            404,
            { [type]: identifier }
        );
    }
}

export class AssetTypeNotFoundError extends WalletServiceError {
    constructor(assetCode: string) {
        super(
            `Asset type not found: ${assetCode}`,
            'ASSET_TYPE_NOT_FOUND',
            404,
            { assetCode }
        );
    }
}

export class ValidationError extends WalletServiceError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'VALIDATION_ERROR', 400, details);
    }
}

export class ConcurrencyError extends WalletServiceError {
    constructor(message: string = 'Transaction conflict, please retry') {
        super(message, 'CONCURRENCY_ERROR', 409);
    }
}

export class DatabaseError extends WalletServiceError {
    constructor(message: string, originalError?: Error) {
        super(message, 'DATABASE_ERROR', 500, {
            originalMessage: originalError?.message,
        });
    }
}

export class TransactionNotFoundError extends WalletServiceError {
    constructor(referenceId: string) {
        super(
            `Transaction not found for reference_id: ${referenceId}`,
            'TRANSACTION_NOT_FOUND',
            404,
            { referenceId }
        );
    }
}
