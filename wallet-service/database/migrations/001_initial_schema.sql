-- ============================================
-- Wallet Service - Initial Schema
-- Enterprise-grade double-entry accounting
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Asset Types Table
-- Represents different types of virtual currencies
-- ============================================
CREATE TABLE asset_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    decimal_places INTEGER DEFAULT 0 CHECK (decimal_places >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for active asset lookups
CREATE INDEX idx_asset_types_code ON asset_types(code) WHERE is_active = TRUE;

-- ============================================
-- Wallets Table
-- User and system wallet accounts
-- ============================================
CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('USER', 'SYSTEM')),
    user_id VARCHAR(100) UNIQUE,  -- NULL for SYSTEM accounts
    display_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure system accounts don't have user_id
    CONSTRAINT chk_system_no_user CHECK (
        (account_type = 'SYSTEM' AND user_id IS NULL) OR
        (account_type = 'USER' AND user_id IS NOT NULL)
    )
);

-- Index for user wallet lookups
CREATE INDEX idx_wallets_user_id ON wallets(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_wallets_account_type ON wallets(account_type);

-- ============================================
-- Ledger Entries Table
-- Immutable double-entry transaction ledger
-- ============================================
CREATE TABLE ledger_entries (
    id BIGSERIAL PRIMARY KEY,
    transaction_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    wallet_id INTEGER NOT NULL REFERENCES wallets(id),
    asset_type_id INTEGER NOT NULL REFERENCES asset_types(id),
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    amount BIGINT NOT NULL CHECK (amount > 0),  -- Always positive, stored in smallest unit
    transaction_type VARCHAR(50) NOT NULL,  -- 'TOPUP', 'BONUS', 'SPEND', 'INITIAL_BALANCE'
    reference_id VARCHAR(100) NOT NULL,  -- Idempotency key
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate reference_id + entry_type combinations
    CONSTRAINT unique_reference_entry UNIQUE (reference_id, entry_type)
);

-- Performance indexes
CREATE INDEX idx_ledger_wallet_asset ON ledger_entries(wallet_id, asset_type_id);
CREATE INDEX idx_ledger_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_reference_id ON ledger_entries(reference_id);
CREATE INDEX idx_ledger_created_at ON ledger_entries(created_at DESC);
CREATE INDEX idx_ledger_transaction_type ON ledger_entries(transaction_type);

-- ============================================
-- Wallet Balances Materialized View
-- Pre-calculated balances for fast reads
-- ============================================
CREATE MATERIALIZED VIEW wallet_balances AS
SELECT 
    w.id AS wallet_id,
    w.user_id,
    w.display_name,
    at.id AS asset_type_id,
    at.code AS asset_code,
    at.name AS asset_name,
    COALESCE(
        SUM(
            CASE 
                WHEN le.entry_type = 'CREDIT' THEN le.amount 
                ELSE -le.amount 
            END
        ), 
        0
    ) AS balance,
    MAX(le.created_at) AS last_transaction_at
FROM wallets w
CROSS JOIN asset_types at
LEFT JOIN ledger_entries le ON w.id = le.wallet_id AND at.id = le.asset_type_id
WHERE w.is_active = TRUE AND at.is_active = TRUE
GROUP BY w.id, w.user_id, w.display_name, at.id, at.code, at.name;

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX idx_wallet_balances_pk ON wallet_balances(wallet_id, asset_type_id);
CREATE INDEX idx_wallet_balances_user_id ON wallet_balances(user_id);

-- ============================================
-- Function to refresh materialized view
-- ============================================
CREATE OR REPLACE FUNCTION refresh_wallet_balances()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY wallet_balances;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to calculate balance from ledger
-- Used for real-time balance during transactions
-- ============================================
CREATE OR REPLACE FUNCTION get_wallet_balance(
    p_wallet_id INTEGER,
    p_asset_type_id INTEGER
)
RETURNS BIGINT AS $$
DECLARE
    v_balance BIGINT;
BEGIN
    SELECT COALESCE(
        SUM(
            CASE 
                WHEN entry_type = 'CREDIT' THEN amount 
                ELSE -amount 
            END
        ), 
        0
    )
    INTO v_balance
    FROM ledger_entries
    WHERE wallet_id = p_wallet_id AND asset_type_id = p_asset_type_id;
    
    RETURN v_balance;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Trigger to update wallet timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_wallets_updated_at
    BEFORE UPDATE ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_asset_types_updated_at
    BEFORE UPDATE ON asset_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
