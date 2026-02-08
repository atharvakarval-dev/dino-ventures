-- ============================================
-- Wallet Service - Seed Data
-- Initial data for development and testing
-- ============================================

-- ============================================
-- 1. Asset Types
-- ============================================
INSERT INTO asset_types (code, name, description, decimal_places) VALUES
    ('GOLD_COINS', 'Gold Coins', 'Primary in-game currency for purchases', 0),
    ('DIAMONDS', 'Diamonds', 'Premium currency for exclusive items', 0),
    ('LOYALTY_POINTS', 'Loyalty Points', 'Earned through gameplay and engagement', 0)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. System Wallets (Treasury & Revenue)
-- ============================================
INSERT INTO wallets (account_type, user_id, display_name) VALUES
    ('SYSTEM', NULL, 'Treasury - Gold Coins'),
    ('SYSTEM', NULL, 'Treasury - Diamonds'),
    ('SYSTEM', NULL, 'Treasury - Loyalty Points'),
    ('SYSTEM', NULL, 'Bonus Pool'),
    ('SYSTEM', NULL, 'Revenue Account')
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. Test User Wallets
-- ============================================
INSERT INTO wallets (account_type, user_id, display_name) VALUES
    ('USER', 'user_alice', 'Alice'),
    ('USER', 'user_bob', 'Bob'),
    ('USER', 'user_charlie', 'Charlie')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- 4. Initial Balances for Test Users
-- Credits from Treasury to Users
-- ============================================

-- Alice: 100,000 Gold Coins (1000.00 in display)
INSERT INTO ledger_entries (
    transaction_id, wallet_id, asset_type_id, entry_type, 
    amount, transaction_type, reference_id, description, metadata
) VALUES
    -- Credit to Alice
    (
        uuid_generate_v4(), 
        (SELECT id FROM wallets WHERE user_id = 'user_alice'),
        (SELECT id FROM asset_types WHERE code = 'GOLD_COINS'),
        'CREDIT',
        100000,
        'INITIAL_BALANCE',
        'init_alice_gold_001',
        'Initial balance setup',
        '{"reason": "initial_setup", "admin": "system"}'
    )
ON CONFLICT DO NOTHING;

-- Alice: 500 Diamonds
INSERT INTO ledger_entries (
    transaction_id, wallet_id, asset_type_id, entry_type, 
    amount, transaction_type, reference_id, description, metadata
) VALUES
    (
        uuid_generate_v4(), 
        (SELECT id FROM wallets WHERE user_id = 'user_alice'),
        (SELECT id FROM asset_types WHERE code = 'DIAMONDS'),
        'CREDIT',
        500,
        'INITIAL_BALANCE',
        'init_alice_diamonds_001',
        'Initial balance setup',
        '{"reason": "initial_setup", "admin": "system"}'
    )
ON CONFLICT DO NOTHING;

-- Bob: 50,000 Gold Coins
INSERT INTO ledger_entries (
    transaction_id, wallet_id, asset_type_id, entry_type, 
    amount, transaction_type, reference_id, description, metadata
) VALUES
    (
        uuid_generate_v4(), 
        (SELECT id FROM wallets WHERE user_id = 'user_bob'),
        (SELECT id FROM asset_types WHERE code = 'GOLD_COINS'),
        'CREDIT',
        50000,
        'INITIAL_BALANCE',
        'init_bob_gold_001',
        'Initial balance setup',
        '{"reason": "initial_setup", "admin": "system"}'
    )
ON CONFLICT DO NOTHING;

-- Charlie: 25,000 Gold Coins
INSERT INTO ledger_entries (
    transaction_id, wallet_id, asset_type_id, entry_type, 
    amount, transaction_type, reference_id, description, metadata
) VALUES
    (
        uuid_generate_v4(), 
        (SELECT id FROM wallets WHERE user_id = 'user_charlie'),
        (SELECT id FROM asset_types WHERE code = 'GOLD_COINS'),
        'CREDIT',
        25000,
        'INITIAL_BALANCE',
        'init_charlie_gold_001',
        'Initial balance setup',
        '{"reason": "initial_setup", "admin": "system"}'
    )
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. Fund Treasury Wallets
-- ============================================

-- Treasury - Gold Coins
INSERT INTO ledger_entries (
    transaction_id, wallet_id, asset_type_id, entry_type, 
    amount, transaction_type, reference_id, description, metadata
)
SELECT 
    uuid_generate_v4(), 
    w.id, 
    a.id, 
    'CREDIT', 
    100000000, 
    'INITIAL_BALANCE', 
    'treasury_init_gold', 
    'Treasury initial funding', 
    '{}'::jsonb
FROM wallets w
JOIN asset_types a ON a.code = 'GOLD_COINS'
WHERE w.display_name = 'Treasury - Gold Coins'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Treasury - Diamonds
INSERT INTO ledger_entries (
    transaction_id, wallet_id, asset_type_id, entry_type, 
    amount, transaction_type, reference_id, description, metadata
)
SELECT 
    uuid_generate_v4(), 
    w.id, 
    a.id, 
    'CREDIT', 
    100000000, 
    'INITIAL_BALANCE', 
    'treasury_init_diamonds', 
    'Treasury initial funding', 
    '{}'::jsonb
FROM wallets w
JOIN asset_types a ON a.code = 'DIAMONDS'
WHERE w.display_name = 'Treasury - Diamonds'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Treasury - Loyalty Points
INSERT INTO ledger_entries (
    transaction_id, wallet_id, asset_type_id, entry_type, 
    amount, transaction_type, reference_id, description, metadata
)
SELECT 
    uuid_generate_v4(), 
    w.id, 
    a.id, 
    'CREDIT', 
    100000000, 
    'INITIAL_BALANCE', 
    'treasury_init_loyalty', 
    'Treasury initial funding', 
    '{}'::jsonb
FROM wallets w
JOIN asset_types a ON a.code = 'LOYALTY_POINTS'
WHERE w.display_name = 'Treasury - Loyalty Points'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. Refresh Materialized View
-- ============================================
REFRESH MATERIALIZED VIEW wallet_balances;

-- ============================================
-- 6. Verify Seed Data
-- ============================================
DO $$
DECLARE
    asset_count INTEGER;
    wallet_count INTEGER;
    entry_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO asset_count FROM asset_types;
    SELECT COUNT(*) INTO wallet_count FROM wallets;
    SELECT COUNT(*) INTO entry_count FROM ledger_entries;
    
    RAISE NOTICE 'Seed completed: % asset types, % wallets, % ledger entries',
        asset_count, wallet_count, entry_count;
END $$;
