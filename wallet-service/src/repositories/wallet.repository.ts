/**
 * Wallet Repository
 * Database access layer for wallet operations
 * Implements single responsibility for DB queries
 */

import { PoolClient } from 'pg';
import { query, getPool } from '../config/database';
import {
    Wallet,
    AssetType,
    LedgerEntry,
    WalletBalance,
    CreateLedgerEntryParams,
} from '../types/wallet.types';
import { WalletNotFoundError, AssetTypeNotFoundError } from '../errors';
import { logger } from '../utils/logger';

// ============================================
// Wallet Queries
// ============================================

/**
 * Find wallet by user ID with optional row locking
 */
export async function findWalletByUserId(
    userId: string,
    client?: PoolClient,
    forUpdate: boolean = false
): Promise<Wallet> {
    const lockClause = forUpdate ? 'FOR UPDATE' : '';
    const sql = `
    SELECT id, account_type, user_id, display_name, is_active, created_at, updated_at
    FROM wallets
    WHERE user_id = $1 AND is_active = TRUE
    ${lockClause}
  `;

    const executor = client || getPool();
    const result = await executor.query(sql, [userId]);

    if (result.rows.length === 0) {
        throw new WalletNotFoundError(userId);
    }

    return result.rows[0] as Wallet;
}

/**
 * Find wallet by ID with optional row locking
 */
export async function findWalletById(
    walletId: number,
    client?: PoolClient,
    forUpdate: boolean = false
): Promise<Wallet> {
    const lockClause = forUpdate ? 'FOR UPDATE' : '';
    const sql = `
    SELECT id, account_type, user_id, display_name, is_active, created_at, updated_at
    FROM wallets
    WHERE id = $1 AND is_active = TRUE
    ${lockClause}
  `;

    const executor = client || getPool();
    const result = await executor.query(sql, [walletId]);

    if (result.rows.length === 0) {
        throw new WalletNotFoundError(walletId.toString(), 'wallet_id');
    }

    return result.rows[0] as Wallet;
}

/**
 * Find system wallet by display name
 */
export async function findSystemWalletByName(
    displayName: string,
    client?: PoolClient
): Promise<Wallet> {
    const sql = `
    SELECT id, account_type, user_id, display_name, is_active, created_at, updated_at
    FROM wallets
    WHERE display_name = $1 AND account_type = 'SYSTEM' AND is_active = TRUE
  `;

    const executor = client || getPool();
    const result = await executor.query(sql, [displayName]);

    if (result.rows.length === 0) {
        throw new WalletNotFoundError(displayName, 'wallet_id');
    }

    return result.rows[0] as Wallet;
}

/**
 * Lock multiple wallets in ascending ID order to prevent deadlocks
 */
export async function lockWalletsInOrder(
    walletIds: number[],
    client: PoolClient
): Promise<Wallet[]> {
    const sortedIds = [...walletIds].sort((a, b) => a - b);

    const sql = `
    SELECT id, account_type, user_id, display_name, is_active, created_at, updated_at
    FROM wallets
    WHERE id = ANY($1::int[]) AND is_active = TRUE
    ORDER BY id ASC
    FOR UPDATE NOWAIT
  `;

    try {
        const result = await client.query(sql, [sortedIds]);
        return result.rows as Wallet[];
    } catch (error) {
        logger.warn('Failed to acquire wallet locks', { walletIds: sortedIds });
        throw error;
    }
}

// ============================================
// Asset Type Queries
// ============================================

/**
 * Find asset type by code
 */
export async function findAssetTypeByCode(
    code: string,
    client?: PoolClient
): Promise<AssetType> {
    const sql = `
    SELECT id, code, name, description, decimal_places, is_active, created_at, updated_at
    FROM asset_types
    WHERE code = $1 AND is_active = TRUE
  `;

    const executor = client || getPool();
    const result = await executor.query(sql, [code]);

    if (result.rows.length === 0) {
        throw new AssetTypeNotFoundError(code);
    }

    return result.rows[0] as AssetType;
}

/**
 * Get all active asset types
 */
export async function findAllAssetTypes(): Promise<AssetType[]> {
    return query<AssetType>(`
    SELECT id, code, name, description, decimal_places, is_active, created_at, updated_at
    FROM asset_types
    WHERE is_active = TRUE
    ORDER BY code ASC
  `);
}

// ============================================
// Balance Queries
// ============================================

/**
 * Calculate real-time balance from ledger entries
 * Use this during transactions for accuracy
 */
export async function calculateBalance(
    walletId: number,
    assetTypeId: number,
    client: PoolClient
): Promise<number> {
    const sql = `
    SELECT COALESCE(
      SUM(
        CASE 
          WHEN entry_type = 'CREDIT' THEN amount 
          ELSE -amount 
        END
      ), 
      0
    )::bigint AS balance
    FROM ledger_entries
    WHERE wallet_id = $1 AND asset_type_id = $2
  `;

    const result = await client.query(sql, [walletId, assetTypeId]);
    return parseInt(result.rows[0].balance, 10);
}

/**
 * Get balances from materialized view (fast but potentially stale)
 */
export async function getBalancesFromView(
    userId: string,
    assetCode?: string
): Promise<WalletBalance[]> {
    let sql = `
    SELECT wallet_id, user_id, display_name, asset_type_id, 
           asset_code, asset_name, balance, last_transaction_at
    FROM wallet_balances
    WHERE user_id = $1
  `;

    const params: (string | undefined)[] = [userId];

    if (assetCode) {
        sql += ' AND asset_code = $2';
        params.push(assetCode);
    }

    sql += ' ORDER BY asset_code ASC';

    return query<WalletBalance>(sql, params);
}

// ============================================
// Ledger Entry Queries
// ============================================

/**
 * Check if reference_id already exists (idempotency check)
 */
export async function findLedgerEntryByReferenceId(
    referenceId: string,
    client?: PoolClient
): Promise<LedgerEntry | null> {
    const sql = `
    SELECT id, transaction_id, wallet_id, asset_type_id, entry_type,
           amount, transaction_type, reference_id, description, metadata, created_at
    FROM ledger_entries
    WHERE reference_id = $1
    LIMIT 1
  `;

    const executor = client || getPool();
    const result = await executor.query(sql, [referenceId]);

    return result.rows.length > 0 ? (result.rows[0] as LedgerEntry) : null;
}

/**
 * Insert a new ledger entry
 */
export async function insertLedgerEntry(
    params: CreateLedgerEntryParams,
    client: PoolClient
): Promise<LedgerEntry> {
    const sql = `
    INSERT INTO ledger_entries (
      transaction_id, wallet_id, asset_type_id, entry_type,
      amount, transaction_type, reference_id, description, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, transaction_id, wallet_id, asset_type_id, entry_type,
              amount, transaction_type, reference_id, description, metadata, created_at
  `;

    const result = await client.query(sql, [
        params.transactionId,
        params.walletId,
        params.assetTypeId,
        params.entryType,
        params.amount,
        params.transactionType,
        params.referenceId,
        params.description || null,
        JSON.stringify(params.metadata || {}),
    ]);

    return result.rows[0] as LedgerEntry;
}

/**
 * Get transaction history for a wallet with running balance
 * Uses window function to calculate balance_after efficiently (avoids N+1)
 * Uses limit+1 pattern for has_more detection (avoids COUNT(*))
 */
export async function getTransactionHistoryWithBalance(
    walletId: number,
    assetTypeId: number,
    limit: number = 50,
    offset: number = 0
): Promise<{ transactions: TransactionHistoryRow[]; hasMore: boolean }> {
    const sql = `
    WITH transaction_data AS (
        SELECT 
            le.id,
            le.transaction_id,
            le.reference_id,
            le.transaction_type,
            le.entry_type,
            le.amount,
            le.description,
            le.created_at,
            SUM(
                CASE 
                    WHEN le.entry_type = 'CREDIT' THEN le.amount 
                    ELSE -le.amount 
                END
            ) OVER (
                ORDER BY le.created_at ASC, le.id ASC
            ) AS balance_after
        FROM ledger_entries le
        WHERE le.wallet_id = $1 AND le.asset_type_id = $2
    )
    SELECT *
    FROM transaction_data
    ORDER BY created_at DESC, id DESC
    LIMIT $3 OFFSET $4
    `;

    // Fetch limit+1 to efficiently determine if there are more results
    const result = await query<TransactionHistoryRow>(sql, [walletId, assetTypeId, limit + 1, offset]);

    const hasMore = result.length > limit;
    const transactions = hasMore ? result.slice(0, limit) : result;

    return { transactions, hasMore };
}

// Row type for transaction history result
export interface TransactionHistoryRow {
    id: number;
    transaction_id: string;
    reference_id: string;
    transaction_type: string;
    entry_type: 'DEBIT' | 'CREDIT';
    amount: number;
    description: string | null;
    created_at: Date;
    balance_after: number;
}

/**
 * Find transaction details by reference_id with wallet and asset info
 * Uses JOINs to get all data in a single query (avoids N+1)
 */
export async function findTransactionDetailsByReferenceId(
    referenceId: string
): Promise<TransactionDetailRow[] | null> {
    const sql = `
    SELECT 
        le.transaction_id,
        le.reference_id,
        le.transaction_type,
        le.amount,
        le.entry_type,
        le.created_at,
        le.metadata,
        le.wallet_id,
        w.display_name AS wallet_name,
        w.user_id,
        at.code AS asset_code
    FROM ledger_entries le
    JOIN wallets w ON le.wallet_id = w.id
    JOIN asset_types at ON le.asset_type_id = at.id
    WHERE le.reference_id = $1
       OR le.reference_id = $2
    ORDER BY le.entry_type DESC
    `;

    // Also check for _credit suffix for double-entry transactions
    const result = await query<TransactionDetailRow>(sql, [referenceId, `${referenceId}_credit`]);

    return result.length > 0 ? result : null;
}

// Row type for transaction detail result
export interface TransactionDetailRow {
    transaction_id: string;
    reference_id: string;
    transaction_type: string;
    amount: number;
    entry_type: 'DEBIT' | 'CREDIT';
    created_at: Date;
    metadata: Record<string, unknown>;
    wallet_id: number;
    wallet_name: string;
    user_id: string | null;
    asset_code: string;
}

// ============================================
// Materialized View Management
// ============================================

/**
 * Refresh the wallet balances materialized view
 */
export async function refreshBalancesView(): Promise<void> {
    try {
        await query('REFRESH MATERIALIZED VIEW CONCURRENTLY wallet_balances');
        logger.info('Wallet balances view refreshed');
    } catch (error) {
        logger.error('Failed to refresh wallet balances view', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
    }
}
