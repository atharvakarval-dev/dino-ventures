# 🦖 Dino Ventures - Wallet Service

> **Backend Assignment Submission** | Production-Grade Internal Wallet System

A high-performance, ledger-based wallet service built with **TypeScript**, **Node.js**, **Express**, and **PostgreSQL**. Designed for gaming applications handling millions of virtual currency transactions.

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Solution Approach](#-solution-approach)
- [Architecture](#-architecture)
- [API Endpoints](#-api-endpoints)
- [Key Design Decisions](#-key-design-decisions)
- [Performance Optimizations](#-performance-optimizations)
- [Running the Service](#-running-the-service)
- [Testing](#-testing)

---

## 🎯 Problem Statement

Build an **internal wallet service** for a gaming platform that handles:
- Virtual currency management (Gold Coins, Diamonds, Loyalty Points)
- Real-time balance tracking
- Top-up, bonus, and spend transactions
- High concurrency with data integrity guarantees

### Core Requirements
- ✅ RESTful APIs for wallet operations
- ✅ Idempotency for safe retries
- ✅ Concurrency safety (no race conditions)
- ✅ Audit trail for all transactions

---

## 💡 Solution Approach

### Why Ledger-Based Architecture? (Brownie Points 🍪)

Instead of a simple `balance` field that gets updated, I implemented a **double-entry ledger system**:

```
Traditional Approach          vs          Ledger Approach
┌─────────────────┐                    ┌─────────────────┐
│ wallets         │                    │ ledger_entries  │
├─────────────────┤                    ├─────────────────┤
│ user_id         │                    │ transaction_id  │
│ balance ← MUTABLE                    │ wallet_id       │
└─────────────────┘                    │ entry_type      │ ← IMMUTABLE
                                       │ amount          │
                                       │ created_at      │
                                       └─────────────────┘
```

**Benefits:**
1. **Complete Audit Trail** - Every transaction is preserved forever
2. **Self-Healing** - Balance = SUM(credits) - SUM(debits), always correct
3. **Debugging** - Can trace exact flow of funds
4. **Compliance-Ready** - Meets financial auditing standards

### Double-Entry Accounting

Every transaction creates **two entries** that must balance:

```
Top-up $100:
┌─────────────────────────────────────────────────┐
│  Treasury Wallet    │  DEBIT   │  -100         │
│  User Wallet        │  CREDIT  │  +100         │
│                     │  NET     │   0  ✓        │
└─────────────────────────────────────────────────┘
```

---

## 🏗 Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      API Layer (Express)                    │
│  /health  /topup  /bonus  /spend  /balance  /transactions  │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│                    Middleware Layer                         │
│   [Validation] [Idempotency Check] [Error Handling]        │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│                    Service Layer                            │
│   Business Logic • Transaction Orchestration                │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│                   Repository Layer                          │
│   Database Queries • Row Locking • Balance Calculation      │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│                    PostgreSQL                               │
│   SERIALIZABLE Isolation • Materialized Views • Indexes    │
└────────────────────────────────────────────────────────────┘
```

---

## 🔌 Wallet Service API Reference

**Base URL:** `http://localhost:3000/api/v1`

### 1️⃣ Health Check
`GET /health`

**Response:**
```json
{
  "status": "healthy",
  "service": "wallet-service",
  "timestamp": "2026-02-08T09:24:50.000Z"
}
```

### 2️⃣ Get Balance
`GET /wallets/:user_id/balance?asset_code=GOLD_COINS`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `user_id` | path | ✅ | User identifier |
| `asset_code` | query | ❌ | Filter by asset (GOLD_COINS, DIAMONDS, LOYALTY_POINTS) |

**Example:**
```bash
curl "http://localhost:3000/api/v1/wallets/user_alice/balance"
```

**Response:**
```json
{
  "user_id": "user_alice",
  "balances": [
    {
      "asset_code": "GOLD_COINS",
      "asset_name": "Gold Coins",
      "balance": 100000,
      "last_updated": "2026-02-08T09:24:50.000Z"
    },
    {
      "asset_code": "DIAMONDS",
      "asset_name": "Diamonds",
      "balance": 500,
      "last_updated": "2026-02-08T09:24:50.000Z"
    }
  ]
}
```

### 3️⃣ Top-up (Add Credits)
`POST /wallets/topup`

**Request Body:**
```json
{
  "user_id": "user_alice",
  "asset_code": "GOLD_COINS",
  "amount": 5000,
  "reference_id": "topup_stripe_12345",
  "payment_method": "stripe",
  "metadata": { "order_id": "ORD-123" }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `user_id` | string | ✅ | User identifier |
| `asset_code` | string | ✅ | GOLD_COINS, DIAMONDS, LOYALTY_POINTS |
| `amount` | integer | ✅ | Positive integer amount |
| `reference_id` | string | ✅ | Unique idempotency key |
| `payment_method` | string | ❌ | Payment provider |
| `metadata` | object | ❌ | Additional data |

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/wallets/topup \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user_alice","asset_code":"GOLD_COINS","amount":5000,"reference_id":"topup_001"}'
```

**Response:**
```json
{
  "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user_alice",
  "asset_code": "GOLD_COINS",
  "amount": 5000,
  "balance": 105000,
  "transaction_type": "TOPUP",
  "timestamp": "2026-02-08T09:24:50.000Z"
}
```

### 4️⃣ Bonus (Issue Reward)
`POST /wallets/bonus`

**Request Body:**
```json
{
  "user_id": "user_alice",
  "asset_code": "GOLD_COINS",
  "amount": 1000,
  "reference_id": "bonus_daily_001",
  "bonus_type": "DAILY_LOGIN",
  "metadata": { "streak": 7 }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `user_id` | string | ✅ | User identifier |
| `asset_code` | string | ✅ | Asset type |
| `amount` | integer | ✅ | Bonus amount |
| `reference_id` | string | ✅ | Unique idempotency key |
| `bonus_type` | string | ✅ | Type of bonus (DAILY_LOGIN, REFERRAL, etc.) |
| `metadata` | object | ❌ | Additional data |

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/wallets/bonus \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user_alice","asset_code":"GOLD_COINS","amount":1000,"reference_id":"bonus_001","bonus_type":"DAILY_LOGIN"}'
```

**Response:**
```json
{
  "transaction_id": "660e8400-e29b-41d4-a716-446655440001",
  "user_id": "user_alice",
  "asset_code": "GOLD_COINS",
  "amount": 1000,
  "balance": 106000,
  "transaction_type": "BONUS",
  "timestamp": "2026-02-08T09:24:50.000Z"
}
```

### 5️⃣ Spend (Deduct for Purchase)
`POST /wallets/spend`

**Request Body:**
```json
{
  "user_id": "user_alice",
  "asset_code": "GOLD_COINS",
  "amount": 2500,
  "reference_id": "purchase_dragon_skin_001",
  "item_id": "dragon_skin",
  "metadata": { "item_name": "Dragon Skin Armor" }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `user_id` | string | ✅ | User identifier |
| `asset_code` | string | ✅ | Asset type |
| `amount` | integer | ✅ | Amount to spend |
| `reference_id` | string | ✅ | Unique idempotency key |
| `item_id` | string | ✅ | Item being purchased |
| `metadata` | object | ❌ | Additional data |

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/wallets/spend \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user_alice","asset_code":"GOLD_COINS","amount":2500,"reference_id":"spend_001","item_id":"dragon_skin"}'
```

**Response:**
```json
{
  "transaction_id": "770e8400-e29b-41d4-a716-446655440002",
  "user_id": "user_alice",
  "asset_code": "GOLD_COINS",
  "amount": 2500,
  "balance": 103500,
  "transaction_type": "SPEND",
  "timestamp": "2026-02-08T09:24:50.000Z"
}
```

### 6️⃣ Transaction History
`GET /wallets/:user_id/transactions?asset_code=GOLD_COINS&limit=50&offset=0`

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `user_id` | path | ✅ | - | User identifier |
| `asset_code` | query | ✅ | - | Asset type |
| `limit` | query | ❌ | 50 | Max results (1-100) |
| `offset` | query | ❌ | 0 | Pagination offset |

**Example:**
```bash
curl "http://localhost:3000/api/v1/wallets/user_alice/transactions?asset_code=GOLD_COINS&limit=10"
```

**Response:**
```json
{
  "user_id": "user_alice",
  "asset_code": "GOLD_COINS",
  "transactions": [
    {
      "transaction_id": "770e8400-e29b-41d4-a716-446655440002",
      "type": "SPEND",
      "amount": 2500,
      "balance_after": 103500,
      "reference_id": "spend_001",
      "created_at": "2026-02-08T09:24:50.000Z",
      "description": "Purchase: dragon_skin"
    },
    {
      "transaction_id": "660e8400-e29b-41d4-a716-446655440001",
      "type": "BONUS",
      "amount": 1000,
      "balance_after": 106000,
      "reference_id": "bonus_001",
      "created_at": "2026-02-08T09:20:00.000Z"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "has_more": false
  }
}
```

### 7️⃣ Transaction Details
`GET /transactions/:reference_id`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `reference_id` | path | ✅ | The unique reference ID from the original transaction |

**Example:**
```bash
curl "http://localhost:3000/api/v1/transactions/init_alice_gold_001"
```

**Response:**
```json
{
  "transaction_id": "550e8400-e29b-41d4-a716-446655440000",
  "reference_id": "init_alice_gold_001",
  "status": "COMPLETED",
  "type": "INITIAL_BALANCE",
  "user_id": "user_alice",
  "asset_code": "GOLD_COINS",
  "amount": 100000,
  "created_at": "2026-02-08T09:00:00.000Z",
  "ledger_entries": [
    {
      "wallet_id": 6,
      "wallet_name": "Alice",
      "entry_type": "CREDIT",
      "amount": 100000
    }
  ]
}
```

## 🧪 Quick Test Commands

Copy and paste these to test all endpoints:

```bash
# 1. Health check
curl http://localhost:3000/api/v1/health

# 2. Get balance
curl "http://localhost:3000/api/v1/wallets/user_alice/balance"

# 3. Top-up
curl -X POST http://localhost:3000/api/v1/wallets/topup -H "Content-Type: application/json" -d '{"user_id":"user_alice","asset_code":"GOLD_COINS","amount":5000,"reference_id":"test_topup_001"}'

# 4. Bonus
curl -X POST http://localhost:3000/api/v1/wallets/bonus -H "Content-Type: application/json" -d '{"user_id":"user_alice","asset_code":"GOLD_COINS","amount":1000,"reference_id":"test_bonus_001","bonus_type":"TEST"}'

# 5. Spend
curl -X POST http://localhost:3000/api/v1/wallets/spend -H "Content-Type: application/json" -d '{"user_id":"user_alice","asset_code":"GOLD_COINS","amount":500,"reference_id":"test_spend_001","item_id":"test_item"}'

# 6. Transaction history
curl "http://localhost:3000/api/v1/wallets/user_alice/transactions?asset_code=GOLD_COINS"

# 7. Transaction details
curl "http://localhost:3000/api/v1/transactions/init_alice_gold_001"
```
The server is running at http://localhost:3000 - you can start testing! 🚀

---

## 🧠 Key Design Decisions

### 1. Idempotency via Reference ID

Every write operation requires a unique `reference_id`. If a client retries with the same ID, we return the original result instead of processing again.

```typescript
// Check before processing
const existing = await findLedgerEntryByReferenceId(referenceId);
if (existing) {
    throw new DuplicateTransactionError(referenceId, existing.transaction_id);
}
```

**Why?** Network failures happen. Clients can safely retry without double-charging.

### 2. Ordered Locking to Prevent Deadlocks

When locking multiple wallets, we **always lock in ascending ID order**:

```typescript
const sortedIds = [...walletIds].sort((a, b) => a - b);
await client.query(`
    SELECT * FROM wallets 
    WHERE id = ANY($1) 
    ORDER BY id ASC 
    FOR UPDATE NOWAIT
`, [sortedIds]);
```

**Why?** If Transaction A locks [1, 2] and Transaction B locks [2, 1], deadlock occurs. Consistent ordering prevents this.

### 3. SERIALIZABLE Transaction Isolation

```typescript
await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
```

**Why?** Guarantees that concurrent transactions appear to execute one at a time. Essential for financial operations.

### 4. Materialized View for Fast Balance Reads

```sql
CREATE MATERIALIZED VIEW wallet_balances AS
SELECT 
    wallet_id,
    SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END) as balance
FROM ledger_entries
GROUP BY wallet_id;
```

**Why?** Balance queries are frequent. Computing from ledger every time is expensive. The view is refreshed after transactions.

---

## ⚡ Performance Optimizations

### Problem 1: N+1 Query for Balance History

**Bad Approach:**
```typescript
for (const tx of transactions) {
    tx.balance_after = await calculateBalanceAt(tx.created_at); // N queries!
}
```

**Our Approach:** PostgreSQL Window Functions
```sql
SELECT 
    transaction_id,
    amount,
    SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END) 
        OVER (ORDER BY created_at) as balance_after
FROM ledger_entries
```

**Result:** 1 query instead of N+1 ✅

### Problem 2: N+1 Query for Wallet Names

**Bad Approach:**
```typescript
for (const entry of entries) {
    const wallet = await getWallet(entry.wallet_id); // N queries!
    entry.wallet_name = wallet.display_name;
}
```

**Our Approach:** JOINs
```sql
SELECT le.*, w.display_name as wallet_name
FROM ledger_entries le
JOIN wallets w ON le.wallet_id = w.id
```

**Result:** 1 query instead of N+1 ✅

### Problem 3: Slow COUNT(*) for Pagination

**Bad Approach:**
```sql
SELECT COUNT(*) FROM ledger_entries WHERE wallet_id = $1;  -- Full table scan
```

**Our Approach:** Limit+1 Pattern
```typescript
const results = await query(sql, [walletId, limit + 1, offset]);
const hasMore = results.length > limit;
return { transactions: results.slice(0, limit), has_more: hasMore };
```

**Result:** No COUNT(*), just fetch one extra row to check if more exist ✅

---

## 🚀 Running the Service

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Docker (optional)

### Quick Start

```bash
# 1. Clone and install
cd wallet-service
npm install

# 2. Start PostgreSQL (Docker)
docker-compose up -d postgres

# 3. Run migrations
npm run migrate

# 4. Seed test data
npm run seed

# 5. Start server
npm run dev
```

### Environment Variables

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/wallet_service
PORT=3000
NODE_ENV=development
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

### Test Coverage
- ✅ Transaction flows (topup, bonus, spend)
- ✅ Idempotency handling
- ✅ Concurrency/locking behavior
- ✅ Insufficient funds validation
- ✅ Error class behaviors

---

## 📁 Project Structure

```
wallet-service/
├── src/
│   ├── app.ts                 # Express app setup
│   ├── controllers/           # Request handlers
│   ├── services/              # Business logic
│   ├── repositories/          # Database queries
│   ├── middleware/            # Validation, idempotency
│   ├── errors/                # Custom error classes
│   ├── types/                 # TypeScript definitions
│   └── config/                # Database config
├── database/
│   ├── migrations/            # Schema migrations
│   └── seed.sql               # Test data
├── tests/
│   └── integration/           # Jest tests
└── package.json
```

---

## 🏆 Why This Solution Stands Out

| Aspect | Implementation |
|--------|----------------|
| **Architecture** | Ledger-based double-entry accounting |
| **Concurrency** | Ordered locking + SERIALIZABLE isolation |
| **Idempotency** | Reference ID uniqueness constraint |
| **Performance** | Window functions, JOINs, materialized views |
| **Type Safety** | Full TypeScript with Zod validation |
| **Error Handling** | Domain-specific error classes with proper HTTP codes |
| **API Design** | RESTful with pagination and query filters |

---

## 👨‍💻 Author

Built with ❤️ for **Dino Ventures Backend Assignment**

---

*"Clarity of thought matters most"* - And I hope this codebase reflects exactly that! 🦖
