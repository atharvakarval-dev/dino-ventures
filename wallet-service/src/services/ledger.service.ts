/**
 * Ledger Service
 * Double-entry accounting operations
 * Ensures all transactions maintain ledger integrity
 */

import { v4 as uuidv4 } from 'uuid';
import { PoolClient } from 'pg';
import { withTransaction } from '../config/database';
import {
    TransactionParams,
    TransactionType,
    LedgerEntry,
} from '../types/wallet.types';
import {
    InsufficientFundsError,
    DuplicateTransactionError,
    ConcurrencyError,
} from '../errors';
import {
    insertLedgerEntry,
    calculateBalance,
    lockWalletsInOrder,
    findLedgerEntryByReferenceId,
} from '../repositories/wallet.repository';
import { logger, logTransaction } from '../utils/logger';

// ============================================
// Double-Entry Transaction Creation
// ============================================

export interface TransactionResult {
    transactionId: string;
    debitEntry: LedgerEntry;
    creditEntry: LedgerEntry;
    newBalance: number;
}

/**
 * Create a double-entry transaction
 * - Debit from source wallet
 * - Credit to target wallet
 * Uses SERIALIZABLE isolation and ordered locking
 */
export async function createTransaction(
    params: TransactionParams
): Promise<TransactionResult> {
    const {
        sourceWalletId,
        targetWalletId,
        assetTypeId,
        amount,
        transactionType,
        referenceId,
        description,
        metadata,
    } = params;

    return withTransaction(async (client: PoolClient) => {
        // 1. Check idempotency - return early if duplicate
        const existingEntry = await findLedgerEntryByReferenceId(referenceId, client);
        if (existingEntry) {
            logger.info('Duplicate transaction detected', { referenceId });
            throw new DuplicateTransactionError(referenceId, existingEntry.transaction_id);
        }

        // 2. Lock wallets in ascending ID order to prevent deadlocks
        try {
            await lockWalletsInOrder([sourceWalletId, targetWalletId], client);
        } catch (error) {
            throw new ConcurrencyError('Unable to acquire wallet locks, please retry');
        }

        // 3. Calculate source wallet balance (real-time from ledger)
        const sourceBalance = await calculateBalance(sourceWalletId, assetTypeId, client);

        // 4. Validate sufficient funds (only for non-treasury operations)
        if (sourceBalance < amount) {
            throw new InsufficientFundsError(amount, sourceBalance, assetTypeId.toString());
        }

        // 5. Generate transaction ID for both entries
        const transactionId = uuidv4();

        // 6. Create DEBIT entry (source wallet)
        const debitEntry = await insertLedgerEntry({
            transactionId,
            walletId: sourceWalletId,
            assetTypeId,
            entryType: 'DEBIT',
            amount,
            transactionType,
            referenceId: `${referenceId}`,
            description,
            metadata: { ...metadata, counterpartyWalletId: targetWalletId },
        }, client);

        // 7. Create CREDIT entry (target wallet)
        const creditEntry = await insertLedgerEntry({
            transactionId,
            walletId: targetWalletId,
            assetTypeId,
            entryType: 'CREDIT',
            amount,
            transactionType,
            referenceId: `${referenceId}_credit`,
            description,
            metadata: { ...metadata, counterpartyWalletId: sourceWalletId },
        }, client);

        // 8. Calculate new balance for target wallet
        const newBalance = await calculateBalance(targetWalletId, assetTypeId, client);

        logTransaction(
            transactionId,
            transactionType,
            targetWalletId.toString(),
            amount,
            assetTypeId.toString(),
            'completed'
        );

        return {
            transactionId,
            debitEntry,
            creditEntry,
            newBalance,
        };
    });
}

/**
 * Create a credit-only transaction (for bonuses, initial balances)
 * No corresponding debit - used for system-generated credits
 */
export async function createCreditOnlyTransaction(
    walletId: number,
    assetTypeId: number,
    amount: number,
    transactionType: TransactionType,
    referenceId: string,
    description?: string,
    metadata?: Record<string, unknown>
): Promise<{ transactionId: string; entry: LedgerEntry; newBalance: number }> {
    return withTransaction(async (client: PoolClient) => {
        // 1. Check idempotency
        const existingEntry = await findLedgerEntryByReferenceId(referenceId, client);
        if (existingEntry) {
            throw new DuplicateTransactionError(referenceId, existingEntry.transaction_id);
        }

        // 2. Lock the wallet
        await lockWalletsInOrder([walletId], client);

        // 3. Generate transaction ID
        const transactionId = uuidv4();

        // 4. Create CREDIT entry
        const entry = await insertLedgerEntry({
            transactionId,
            walletId,
            assetTypeId,
            entryType: 'CREDIT',
            amount,
            transactionType,
            referenceId,
            description,
            metadata,
        }, client);

        // 5. Calculate new balance
        const newBalance = await calculateBalance(walletId, assetTypeId, client);

        logTransaction(
            transactionId,
            transactionType,
            walletId.toString(),
            amount,
            assetTypeId.toString(),
            'completed'
        );

        return { transactionId, entry, newBalance };
    });
}

/**
 * Create a debit-only transaction (for admin adjustments)
 * Validates sufficient funds before proceeding
 */
export async function createDebitOnlyTransaction(
    walletId: number,
    assetTypeId: number,
    amount: number,
    transactionType: TransactionType,
    referenceId: string,
    description?: string,
    metadata?: Record<string, unknown>
): Promise<{ transactionId: string; entry: LedgerEntry; newBalance: number }> {
    return withTransaction(async (client: PoolClient) => {
        // 1. Check idempotency
        const existingEntry = await findLedgerEntryByReferenceId(referenceId, client);
        if (existingEntry) {
            throw new DuplicateTransactionError(referenceId, existingEntry.transaction_id);
        }

        // 2. Lock the wallet
        await lockWalletsInOrder([walletId], client);

        // 3. Calculate current balance
        const currentBalance = await calculateBalance(walletId, assetTypeId, client);

        // 4. Validate sufficient funds
        if (currentBalance < amount) {
            throw new InsufficientFundsError(amount, currentBalance, assetTypeId.toString());
        }

        // 5. Generate transaction ID
        const transactionId = uuidv4();

        // 6. Create DEBIT entry
        const entry = await insertLedgerEntry({
            transactionId,
            walletId,
            assetTypeId,
            entryType: 'DEBIT',
            amount,
            transactionType,
            referenceId,
            description,
            metadata,
        }, client);

        // 7. Calculate new balance
        const newBalance = await calculateBalance(walletId, assetTypeId, client);

        logTransaction(
            transactionId,
            transactionType,
            walletId.toString(),
            amount,
            assetTypeId.toString(),
            'completed'
        );

        return { transactionId, entry, newBalance };
    });
}
