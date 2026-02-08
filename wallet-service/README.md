# Enterprise-Grade Wallet Service

A production-ready internal wallet service with double-entry accounting, ACID transactions, and zero tolerance for data inconsistency.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       API Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Express   │  │  Validation │  │  Error Handling     │  │
│  │   Router    │  │  Middleware │  │  + Idempotency      │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
┌─────────▼────────────────▼────────────────────▼─────────────┐
│                     Service Layer                            │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │   Wallet Service     │  │     Ledger Service           │ │
│  │ (Business Logic)     │  │ (Double-Entry Accounting)    │ │
│  └──────────┬───────────┘  └──────────────┬───────────────┘ │
└─────────────┼──────────────────────────────┼────────────────┘
              │                              │
┌─────────────▼──────────────────────────────▼────────────────┐
│                    Repository Layer                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Wallet Repository (SQL Queries)          │  │
│  │  • Row-level locking  • Ordered locks  • Balance calc │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────┐
│                    PostgreSQL 15+                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐ │
│  │ asset_types│  │  wallets   │  │    ledger_entries      │ │
│  └────────────┘  └────────────┘  └────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          wallet_balances (Materialized View)         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## ✨ Features

- **Double-Entry Accounting**: Every transaction creates balanced debit/credit entries
- **ACID Transactions**: SERIALIZABLE isolation level prevents race conditions
- **Idempotency**: Reference IDs prevent duplicate transaction processing
- **Deadlock Prevention**: Wallets are locked in ascending ID order
- **Immutable Ledger**: Balance is calculated from transaction history, never stored
- **Materialized Views**: Pre-calculated balances for fast reads

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)

### Using Docker (Recommended)

```bash
# Clone and start
cd wallet-service
docker-compose up --build

# Service available at http://localhost:3000
```

### Local Development

```bash
# Install dependencies
npm install

# Start PostgreSQL (Docker)
docker-compose up postgres -d

# Run migrations
# (Migrations run automatically via Docker)

# Start development server
npm run dev
```

## 📡 API Endpoints

### Health Check
```bash
GET /api/v1/health
```

### Top-Up (Purchase Currency)
```bash
POST /api/v1/wallets/topup
Content-Type: application/json

{
  "user_id": "user_alice",
  "asset_code": "GOLD_COINS",
  "amount": 10000,
  "reference_id": "payment_stripe_pi_xxx",
  "payment_method": "stripe",
  "metadata": {
    "payment_intent_id": "pi_xxx"
  }
}
```

### Bonus / Incentive
```bash
POST /api/v1/wallets/bonus
Content-Type: application/json

{
  "user_id": "user_alice",
  "asset_code": "GOLD_COINS",
  "amount": 500,
  "reference_id": "bonus_referral_xyz",
  "bonus_type": "REFERRAL",
  "metadata": {
    "referred_by": "user_bob"
  }
}
```

### Spend (Purchase Items)
```bash
POST /api/v1/wallets/spend
Content-Type: application/json

{
  "user_id": "user_alice",
  "asset_code": "GOLD_COINS",
  "amount": 300,
  "reference_id": "purchase_item_xyz",
  "item_id": "skin_dragon_001",
  "metadata": {
    "item_name": "Dragon Skin"
  }
}
```

### Get Balance
```bash
GET /api/v1/wallets/{user_id}/balance?asset_code=GOLD_COINS
```

## 🔧 Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `DATABASE_URL` | Required | PostgreSQL connection string |
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Environment (development/production) |
| `LOG_LEVEL` | info | Logging level |

## 🧪 Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration
```

## 📊 Database Schema

### Asset Types
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| code | VARCHAR(50) | Unique code (GOLD_COINS, DIAMONDS) |
| name | VARCHAR(100) | Display name |
| decimal_places | INTEGER | Decimal precision |

### Wallets
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| account_type | VARCHAR(20) | USER or SYSTEM |
| user_id | VARCHAR(100) | Unique user identifier |
| display_name | VARCHAR(100) | Display name |

### Ledger Entries
| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| transaction_id | UUID | Groups debit/credit pairs |
| wallet_id | INTEGER | Foreign key to wallets |
| entry_type | VARCHAR(10) | DEBIT or CREDIT |
| amount | BIGINT | Always positive (smallest unit) |
| reference_id | VARCHAR(100) | Idempotency key |

## 🔒 Concurrency Handling

| Concern | Solution |
|---------|----------|
| Race conditions | Row-level `FOR UPDATE` locks |
| Duplicate transactions | Unique constraint on `reference_id` |
| Deadlocks | Lock wallets in ascending ID order |
| Stale reads | `SERIALIZABLE` isolation level |

## 📁 Project Structure

```
wallet-service/
├── src/
│   ├── config/
│   │   └── database.ts      # Connection pool
│   ├── controllers/
│   │   └── wallet.controller.ts
│   ├── services/
│   │   ├── wallet.service.ts
│   │   └── ledger.service.ts
│   ├── repositories/
│   │   └── wallet.repository.ts
│   ├── middleware/
│   │   ├── validation.ts
│   │   ├── error-handler.ts
│   │   └── idempotency.ts
│   ├── errors/
│   │   └── index.ts
│   ├── types/
│   │   └── wallet.types.ts
│   ├── utils/
│   │   └── logger.ts
│   └── app.ts
├── database/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed.sql
├── tests/
│   └── integration/
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## 📝 License

ISC
