/**
 * Wallet Service Type Definitions
 * Enterprise-grade type safety for financial operations
 */

// ============================================
// Database Entity Types
// ============================================

export interface AssetType {
    id: number;
    code: string;
    name: string;
    description: string | null;
    decimal_places: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface Wallet {
    id: number;
    account_type: 'USER' | 'SYSTEM';
    user_id: string | null;
    display_name: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface LedgerEntry {
    id: number;
    transaction_id: string;
    wallet_id: number;
    asset_type_id: number;
    entry_type: 'DEBIT' | 'CREDIT';
    amount: number;  // Always positive, stored in smallest unit
    transaction_type: TransactionType;
    reference_id: string;
    description: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
}

export interface WalletBalance {
    wallet_id: number;
    user_id: string | null;
    display_name: string;
    asset_type_id: number;
    asset_code: string;
    asset_name: string;
    balance: number;
    last_transaction_at: Date | null;
}

// ============================================
// Transaction Types
// ============================================

export type TransactionType =
    | 'TOPUP'
    | 'BONUS'
    | 'SPEND'
    | 'TRANSFER'
    | 'INITIAL_BALANCE'
    | 'REFUND';

export type EntryType = 'DEBIT' | 'CREDIT';

// ============================================
// API Request DTOs
// ============================================

export interface TopupRequest {
    user_id: string;
    asset_code: string;
    amount: number;
    reference_id: string;
    payment_method?: string;
    metadata?: Record<string, unknown>;
}

export interface BonusRequest {
    user_id: string;
    asset_code: string;
    amount: number;
    reference_id: string;
    bonus_type: string;
    metadata?: Record<string, unknown>;
}

export interface SpendRequest {
    user_id: string;
    asset_code: string;
    amount: number;
    reference_id: string;
    item_id: string;
    metadata?: Record<string, unknown>;
}

export interface GetBalanceRequest {
    user_id: string;
    asset_code?: string;
}

// ============================================
// API Response DTOs
// ============================================

export interface TransactionResponse {
    transaction_id: string;
    user_id: string;
    asset_code: string;
    amount: number;
    balance: number;
    transaction_type: TransactionType;
    timestamp: string;
}

export interface BalanceResponse {
    user_id: string;
    balances: AssetBalance[];
}

export interface AssetBalance {
    asset_code: string;
    asset_name: string;
    balance: number;
    last_updated: string | null;
}

// ============================================
// Transaction History Response DTOs
// ============================================

export interface TransactionHistoryResponse {
    user_id: string;
    asset_code: string;
    transactions: TransactionHistoryItem[];
    pagination: {
        limit: number;
        offset: number;
        has_more: boolean;
    };
}

export interface TransactionHistoryItem {
    transaction_id: string;
    type: TransactionType;
    amount: number;
    balance_after: number;
    reference_id: string;
    created_at: string;
    description?: string;
}

// ============================================
// Transaction Details Response DTOs
// ============================================

export interface TransactionDetailsResponse {
    transaction_id: string;
    reference_id: string;
    status: 'COMPLETED';
    type: TransactionType;
    user_id: string | null;
    asset_code: string;
    amount: number;
    created_at: string;
    ledger_entries: LedgerEntryDetail[];
}

export interface LedgerEntryDetail {
    wallet_id: number;
    wallet_name: string;
    entry_type: 'DEBIT' | 'CREDIT';
    amount: number;
}

// ============================================
// Service Layer Types
// ============================================

export interface TransactionParams {
    sourceWalletId: number;
    targetWalletId: number;
    assetTypeId: number;
    amount: number;
    transactionType: TransactionType;
    referenceId: string;
    description?: string;
    metadata?: Record<string, unknown>;
}

export interface CreateLedgerEntryParams {
    transactionId: string;
    walletId: number;
    assetTypeId: number;
    entryType: EntryType;
    amount: number;
    transactionType: TransactionType;
    referenceId: string;
    description?: string;
    metadata?: Record<string, unknown>;
}

// ============================================
// Error Types
// ============================================

export interface WalletError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}

// ============================================
// System Wallet Identifiers
// ============================================

export const SYSTEM_WALLETS = {
    TREASURY_GOLD: 'Treasury - Gold Coins',
    TREASURY_DIAMONDS: 'Treasury - Diamonds',
    TREASURY_LOYALTY: 'Treasury - Loyalty Points',
    BONUS_POOL: 'Bonus Pool',
    REVENUE: 'Revenue Account',
} as const;

export type SystemWalletName = typeof SYSTEM_WALLETS[keyof typeof SYSTEM_WALLETS];
