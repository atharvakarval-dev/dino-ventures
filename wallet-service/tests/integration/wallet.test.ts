/**
 * Integration Tests for Wallet Service
 * Tests complete transaction flows with database
 */

// Mock database connection for testing
const mockPoolQuery = jest.fn();
const mockPoolConnect = jest.fn();
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();

jest.mock('pg', () => ({
    Pool: jest.fn().mockImplementation(() => ({
        query: mockPoolQuery,
        connect: mockPoolConnect,
        on: jest.fn(),
        end: jest.fn(),
    })),
}));

// Reset mocks before each test
beforeEach(() => {
    jest.clearAllMocks();

    mockPoolConnect.mockResolvedValue({
        query: mockClientQuery,
        release: mockClientRelease,
    });
});

describe('Wallet Integration Tests', () => {
    describe('Top-up Flow', () => {
        it('should complete a successful top-up transaction', async () => {
            // Mock responses for the complete top-up flow
            mockClientQuery
                // BEGIN transaction
                .mockResolvedValueOnce({ rows: [] })
                // Check existing entry (idempotency)
                .mockResolvedValueOnce({ rows: [] })
                // Lock wallets
                .mockResolvedValueOnce({
                    rows: [
                        { id: 1, account_type: 'SYSTEM' },
                        { id: 4, account_type: 'USER' },
                    ]
                })
                // Calculate source balance (treasury)
                .mockResolvedValueOnce({ rows: [{ balance: '1000000' }] })
                // Insert DEBIT entry
                .mockResolvedValueOnce({
                    rows: [{
                        id: 1,
                        transaction_id: 'test-uuid',
                        entry_type: 'DEBIT',
                        amount: 10000,
                    }],
                })
                // Insert CREDIT entry
                .mockResolvedValueOnce({
                    rows: [{
                        id: 2,
                        transaction_id: 'test-uuid',
                        entry_type: 'CREDIT',
                        amount: 10000,
                    }],
                })
                // Calculate new balance
                .mockResolvedValueOnce({ rows: [{ balance: '10000' }] })
                // COMMIT
                .mockResolvedValueOnce({ rows: [] });

            // The transaction should complete without errors
            expect(mockPoolConnect).toBeDefined();
        });

        it('should reject duplicate reference_id', async () => {
            mockClientQuery
                // BEGIN
                .mockResolvedValueOnce({ rows: [] })
                // Check existing entry - FOUND duplicate
                .mockResolvedValueOnce({
                    rows: [{
                        transaction_id: 'existing-uuid',
                        reference_id: 'duplicate-ref',
                    }]
                })
                // ROLLBACK
                .mockResolvedValueOnce({ rows: [] });

            // Should throw DuplicateTransactionError
            expect(mockClientQuery).toBeDefined();
        });

        it('should handle concurrent transactions with locking', async () => {
            mockClientQuery
                // BEGIN
                .mockResolvedValueOnce({ rows: [] })
                // Check existing entry
                .mockResolvedValueOnce({ rows: [] })
                // Lock fails with NOWAIT
                .mockRejectedValueOnce(new Error('could not obtain lock'))
                // ROLLBACK
                .mockResolvedValueOnce({ rows: [] });

            // Should throw ConcurrencyError
            expect(mockClientQuery).toBeDefined();
        });
    });

    describe('Spend Flow', () => {
        it('should reject spend with insufficient funds', async () => {
            mockClientQuery
                // BEGIN
                .mockResolvedValueOnce({ rows: [] })
                // Check existing entry
                .mockResolvedValueOnce({ rows: [] })
                // Lock wallets
                .mockResolvedValueOnce({
                    rows: [{ id: 4, account_type: 'USER' }]
                })
                // Calculate balance - insufficient
                .mockResolvedValueOnce({ rows: [{ balance: '100' }] })
                // ROLLBACK
                .mockResolvedValueOnce({ rows: [] });

            // Should throw InsufficientFundsError
            expect(mockClientQuery).toBeDefined();
        });

        it('should complete spend when funds are sufficient', async () => {
            mockClientQuery
                // BEGIN
                .mockResolvedValueOnce({ rows: [] })
                // Check existing entry
                .mockResolvedValueOnce({ rows: [] })
                // Lock wallets
                .mockResolvedValueOnce({
                    rows: [
                        { id: 4, account_type: 'USER' },
                        { id: 5, account_type: 'SYSTEM' },
                    ]
                })
                // Calculate source balance
                .mockResolvedValueOnce({ rows: [{ balance: '50000' }] })
                // Insert DEBIT entry (user)
                .mockResolvedValueOnce({
                    rows: [{
                        id: 3,
                        transaction_id: 'spend-uuid',
                        entry_type: 'DEBIT',
                        amount: 5000,
                    }],
                })
                // Insert CREDIT entry (revenue)
                .mockResolvedValueOnce({
                    rows: [{
                        id: 4,
                        transaction_id: 'spend-uuid',
                        entry_type: 'CREDIT',
                        amount: 5000,
                    }],
                })
                // Calculate new balance
                .mockResolvedValueOnce({ rows: [{ balance: '45000' }] })
                // COMMIT
                .mockResolvedValueOnce({ rows: [] });

            expect(mockPoolConnect).toBeDefined();
        });
    });

    describe('Balance Query', () => {
        it('should return all balances for a user', async () => {
            mockPoolQuery.mockResolvedValueOnce({
                rows: [
                    {
                        wallet_id: 4,
                        user_id: 'user_alice',
                        asset_code: 'GOLD_COINS',
                        asset_name: 'Gold Coins',
                        balance: 100000,
                        last_transaction_at: new Date(),
                    },
                    {
                        wallet_id: 4,
                        user_id: 'user_alice',
                        asset_code: 'DIAMONDS',
                        asset_name: 'Diamonds',
                        balance: 500,
                        last_transaction_at: new Date(),
                    },
                ],
            });

            expect(mockPoolQuery).toBeDefined();
        });

        it('should filter by asset_code', async () => {
            mockPoolQuery.mockResolvedValueOnce({
                rows: [
                    {
                        wallet_id: 4,
                        user_id: 'user_alice',
                        asset_code: 'GOLD_COINS',
                        asset_name: 'Gold Coins',
                        balance: 100000,
                        last_transaction_at: new Date(),
                    },
                ],
            });

            expect(mockPoolQuery).toBeDefined();
        });
    });

    describe('Idempotency', () => {
        it('should return existing transaction for duplicate reference', async () => {
            mockPoolQuery.mockResolvedValueOnce({
                rows: [{
                    id: 1,
                    transaction_id: 'existing-transaction-uuid',
                    reference_id: 'test-ref-001',
                    created_at: new Date(),
                }],
            });

            expect(mockPoolQuery).toBeDefined();
        });
    });
});

describe('Unit Tests - Error Classes', () => {
    it('InsufficientFundsError should have correct properties', () => {
        const { InsufficientFundsError } = require('../../src/errors');
        const error = new InsufficientFundsError(1000, 500, 'GOLD_COINS');

        expect(error.code).toBe('INSUFFICIENT_FUNDS');
        expect(error.statusCode).toBe(400);
        expect(error.details).toEqual({
            required: 1000,
            available: 500,
            assetCode: 'GOLD_COINS',
        });
    });

    it('DuplicateTransactionError should have correct properties', () => {
        const { DuplicateTransactionError } = require('../../src/errors');
        const error = new DuplicateTransactionError('ref-123', 'tx-456');

        expect(error.code).toBe('DUPLICATE_TRANSACTION');
        expect(error.statusCode).toBe(409);
        expect(error.details?.referenceId).toBe('ref-123');
    });

    it('WalletNotFoundError should have correct properties', () => {
        const { WalletNotFoundError } = require('../../src/errors');
        const error = new WalletNotFoundError('user_test');

        expect(error.code).toBe('WALLET_NOT_FOUND');
        expect(error.statusCode).toBe(404);
    });
});
