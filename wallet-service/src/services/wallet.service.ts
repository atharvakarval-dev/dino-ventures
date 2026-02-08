/**
 * Wallet Service
 * Business logic layer for wallet operations
 * Orchestrates repository and ledger service calls
 */

import {
    TopupRequest,
    BonusRequest,
    SpendRequest,
    TransactionResponse,
    BalanceResponse,
    AssetBalance,
    TransactionHistoryResponse,
    TransactionHistoryItem,
    TransactionDetailsResponse,
    TransactionType,
    SYSTEM_WALLETS,
} from '../types/wallet.types';
import {
    findWalletByUserId,
    findAssetTypeByCode,
    findSystemWalletByName,
    getBalancesFromView,
    getTransactionHistoryWithBalance,
    findTransactionDetailsByReferenceId,
} from '../repositories/wallet.repository';
import {
    createTransaction,
    createCreditOnlyTransaction,
} from './ledger.service';
import { ValidationError, TransactionNotFoundError } from '../errors';
import { logger } from '../utils/logger';

// ============================================
// Top-up (Purchase)
// ============================================

/**
 * Process a top-up transaction
 * - Credits user wallet
 * - Debits treasury (system wallet)
 */
export async function topup(request: TopupRequest): Promise<TransactionResponse> {
    const { user_id, asset_code, amount, reference_id, metadata } = request;

    // Validate amount
    if (amount <= 0) {
        throw new ValidationError('Amount must be greater than 0', { amount });
    }

    logger.info('Processing topup', { user_id, asset_code, amount, reference_id });

    // Get user wallet
    const userWallet = await findWalletByUserId(user_id);

    // Get asset type
    const assetType = await findAssetTypeByCode(asset_code);

    // Get treasury wallet based on asset type
    const treasuryName = getTreasuryForAsset(asset_code);
    const treasuryWallet = await findSystemWalletByName(treasuryName);

    // Create double-entry transaction: Treasury -> User
    const result = await createTransaction({
        sourceWalletId: treasuryWallet.id,
        targetWalletId: userWallet.id,
        assetTypeId: assetType.id,
        amount,
        transactionType: 'TOPUP',
        referenceId: reference_id,
        description: `Top-up of ${amount} ${asset_code}`,
        metadata: {
            ...metadata,
            payment_method: request.payment_method,
        },
    });

    return {
        transaction_id: result.transactionId,
        user_id,
        asset_code,
        amount,
        balance: result.newBalance,
        transaction_type: 'TOPUP',
        timestamp: new Date().toISOString(),
    };
}

// ============================================
// Bonus / Incentive
// ============================================

/**
 * Process a bonus transaction
 * - Credits user wallet
 * - Debits bonus pool (or creates credit-only for unlimited bonuses)
 */
export async function bonus(request: BonusRequest): Promise<TransactionResponse> {
    const { user_id, asset_code, amount, reference_id, bonus_type, metadata } = request;

    // Validate amount
    if (amount <= 0) {
        throw new ValidationError('Amount must be greater than 0', { amount });
    }

    logger.info('Processing bonus', { user_id, asset_code, amount, reference_id, bonus_type });

    // Get user wallet
    const userWallet = await findWalletByUserId(user_id);

    // Get asset type
    const assetType = await findAssetTypeByCode(asset_code);

    // For bonuses, we use credit-only transaction (system-generated funds)
    const result = await createCreditOnlyTransaction(
        userWallet.id,
        assetType.id,
        amount,
        'BONUS',
        reference_id,
        `Bonus: ${bonus_type} - ${amount} ${asset_code}`,
        {
            ...metadata,
            bonus_type,
        }
    );

    return {
        transaction_id: result.transactionId,
        user_id,
        asset_code,
        amount,
        balance: result.newBalance,
        transaction_type: 'BONUS',
        timestamp: new Date().toISOString(),
    };
}

// ============================================
// Spend / Purchase
// ============================================

/**
 * Process a spend transaction
 * - Debits user wallet
 * - Credits revenue account
 */
export async function spend(request: SpendRequest): Promise<TransactionResponse> {
    const { user_id, asset_code, amount, reference_id, item_id, metadata } = request;

    // Validate amount
    if (amount <= 0) {
        throw new ValidationError('Amount must be greater than 0', { amount });
    }

    logger.info('Processing spend', { user_id, asset_code, amount, reference_id, item_id });

    // Get user wallet
    const userWallet = await findWalletByUserId(user_id);

    // Get asset type
    const assetType = await findAssetTypeByCode(asset_code);

    // Get revenue wallet
    const revenueWallet = await findSystemWalletByName(SYSTEM_WALLETS.REVENUE);

    // Create double-entry transaction: User -> Revenue
    const result = await createTransaction({
        sourceWalletId: userWallet.id,
        targetWalletId: revenueWallet.id,
        assetTypeId: assetType.id,
        amount,
        transactionType: 'SPEND',
        referenceId: reference_id,
        description: `Purchase: ${item_id}`,
        metadata: {
            ...metadata,
            item_id,
        },
    });

    // Get user's updated balance from the materialized view
    const balances = await getBalancesFromView(user_id, asset_code);
    const currentBalance = balances.length > 0 ? balances[0].balance : 0;

    return {
        transaction_id: result.transactionId,
        user_id,
        asset_code,
        amount,
        balance: currentBalance,
        transaction_type: 'SPEND',
        timestamp: new Date().toISOString(),
    };
}

// ============================================
// Get Balance
// ============================================

/**
 * Get wallet balance(s) for a user
 * Uses materialized view for fast reads
 */
export async function getBalance(
    userId: string,
    assetCode?: string
): Promise<BalanceResponse> {
    logger.debug('Getting balance', { userId, assetCode });

    // First verify the user exists
    await findWalletByUserId(userId);

    // Get balances from materialized view
    const balances = await getBalancesFromView(userId, assetCode);

    const assetBalances: AssetBalance[] = balances.map((b) => ({
        asset_code: b.asset_code,
        asset_name: b.asset_name,
        balance: b.balance,
        last_updated: b.last_transaction_at?.toISOString() || null,
    }));

    return {
        user_id: userId,
        balances: assetBalances,
    };
}

// ============================================
// Transaction History
// ============================================

/**
 * Get transaction history for a user
 * Uses window function for efficient balance_after calculation
 * Uses has_more flag for pagination (avoids COUNT(*))
 */
export async function getTransactionHistory(
    userId: string,
    assetCode: string,
    limit: number = 50,
    offset: number = 0
): Promise<TransactionHistoryResponse> {
    logger.debug('Getting transaction history', { userId, assetCode, limit, offset });

    // 1. Get wallet (validates user exists)
    const wallet = await findWalletByUserId(userId);

    // 2. Get asset type
    const assetType = await findAssetTypeByCode(assetCode);

    // 3. Get transactions with running balance (single query with window function)
    const { transactions, hasMore } = await getTransactionHistoryWithBalance(
        wallet.id,
        assetType.id,
        limit,
        offset
    );

    // 4. Format response
    const transactionItems: TransactionHistoryItem[] = transactions.map((tx) => ({
        transaction_id: tx.transaction_id,
        type: tx.transaction_type as TransactionType,
        amount: tx.amount,
        balance_after: tx.balance_after,
        reference_id: tx.reference_id,
        created_at: tx.created_at.toISOString(),
        description: tx.description || undefined,
    }));

    return {
        user_id: userId,
        asset_code: assetCode,
        transactions: transactionItems,
        pagination: {
            limit,
            offset,
            has_more: hasMore,
        },
    };
}

// ============================================
// Transaction Details
// ============================================

/**
 * Get transaction details by reference_id
 * Uses JOINs for efficient single-query retrieval
 */
export async function getTransactionDetails(
    referenceId: string
): Promise<TransactionDetailsResponse> {
    logger.debug('Getting transaction details', { referenceId });

    // Single query with JOINs - no N+1
    const entries = await findTransactionDetailsByReferenceId(referenceId);

    if (!entries || entries.length === 0) {
        throw new TransactionNotFoundError(referenceId);
    }

    // Get the primary entry (the one with user_id, or first entry)
    const userEntry = entries.find((e) => e.user_id !== null) || entries[0];

    return {
        transaction_id: userEntry.transaction_id,
        reference_id: referenceId,
        status: 'COMPLETED',
        type: userEntry.transaction_type as TransactionType,
        user_id: userEntry.user_id,
        asset_code: userEntry.asset_code,
        amount: userEntry.amount,
        created_at: userEntry.created_at.toISOString(),
        ledger_entries: entries.map((e) => ({
            wallet_id: e.wallet_id,
            wallet_name: e.wallet_name,
            entry_type: e.entry_type,
            amount: e.amount,
        })),
    };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Map asset code to corresponding treasury wallet
 */
function getTreasuryForAsset(assetCode: string): string {
    const treasuryMap: Record<string, string> = {
        'GOLD_COINS': SYSTEM_WALLETS.TREASURY_GOLD,
        'DIAMONDS': SYSTEM_WALLETS.TREASURY_DIAMONDS,
        'LOYALTY_POINTS': SYSTEM_WALLETS.TREASURY_LOYALTY,
    };

    return treasuryMap[assetCode] || SYSTEM_WALLETS.TREASURY_GOLD;
}
