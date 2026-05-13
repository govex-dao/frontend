# Frontend

React + Vite + TypeScript + Tailwind CSS frontend for Govex.

## Quick Start

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

## Architecture

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Query    │────▶│   API Client    │────▶│  Backend API    │
│  (hooks)        │     │   (lib/api/)    │     │  :3000          │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Components     │     │  FutarchySDK    │
│  (display)      │     │  (transactions) │
└─────────────────┘     └─────────────────┘
```

**Backend API** (`/api/*`) - Indexed data (DAOs, proposals, raises, swaps)
**FutarchySDK** - Transaction building, on-chain queries, wallet ops

### Key Directories

```
src/
├── lib/
│   ├── api/           # Backend API client (TODO: create)
│   │   ├── client.ts  # Base fetch client
│   │   ├── daos.ts    # DAO queries
│   │   ├── proposals.ts
│   │   └── raises.ts
│   └── sdk.ts         # FutarchySDK singleton
├── hooks/
│   ├── useDao.ts      # React Query hooks for data
│   ├── useProposal.ts
│   └── useRaise.ts
├── types/             # TypeScript types (match backend schema)
├── routes/            # Page components
├── components/        # Reusable UI components
└── mockData/          # DELETE after API integration
```

## Types

Frontend types should match backend API responses. Key entities:

```typescript
// DAO (not "Org")
interface DAO {
  id: string;                    // Sui object ID
  dao_name: string;
  asset_type: string;
  stable_type: string;
  config: DAOConfig | null;
  // ...
}

// Proposal
interface Proposal {
  id: string;                    // Sui object ID
  dao_id: string;
  title: string;
  state: 'created' | 'initialized' | 'active' | 'awaiting_execution' | 'finalized' | 'executed';
  outcome_count: number;
  outcome_messages: string[];    // JSON array
  twaps: Record<number, string>; // Outcome index -> price
  prices: Record<number, string>;
  // ...
}
```

## SDK Integration

Use `@govex/futarchy-sdk` for:
- Transaction building (trades, proposals, etc.)
- On-chain object queries
- Wallet balance queries

```typescript
import { FutarchySDK } from '@govex/futarchy-sdk';

const sdk = new FutarchySDK({
  network: import.meta.env.VITE_NETWORK || 'localnet',
});

// Build trade transaction
const tx = sdk.proposal.conditionalSwap({...});

// Query balances
const balances = await sdk.utils.queryHelper.getProposalBalances(...);
```

## Environment

```bash
VITE_NETWORK=localnet    # mainnet | testnet | devnet | localnet
VITE_BACKEND_URL=        # Optional, defaults based on network
```

## Rules

- **No mock data in production** - All data from backend API
- **Types match backend** - Don't transform data shapes unnecessarily
- **SDK for transactions** - Never build PTBs directly
- **React Query for caching** - All API calls through hooks
