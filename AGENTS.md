# Avero

> Email-first USDC payments platform built with Arc Studio

Avero lets users send USDC to any email address — no wallet address needed. Built on Arc Testnet with Circle developer-controlled wallets, Dynamic.xyz auth, and a Solidity escrow contract.

---

## What This App Does

Send USDC to any email address. Recipients without a wallet get funds held in the AveiroEscrow smart contract until they sign up and claim. Includes bulk send, payment links, and transaction history.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Auth: Dynamic.xyz (email OTP)
- Backend: Vercel serverless functions (api/ folder)
- Database: Supabase (users, transactions, payment_links tables)
- Wallets: Circle developer-controlled wallets (Arc Testnet)
- Email: Resend
- Contracts: Solidity ^0.8.19 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`.
- Chain: Arc Testnet (Chain ID: 5042002)
- Token: USDC (6 decimals, address: 0x3600000000000000000000000000000000000000)

## Deployed Contracts

| Contract | Network | Address | Explorer |
|---|---|---|---|
| AveiroEscrow | Arc Testnet | `0x735b5ec34cae95dd64c7e808ff2548ec6514ce6a` | https://explorer.testnet.arc.io/address/0x735b5ec34cae95dd64c7e808ff2548ec6514ce6a |

### AveiroEscrow
- Deploy tx: `0x4e5e1d5f18a2fd809a47810e6dac8cd19fee7e8bfc572a15db9f6506e465c9e1`
- Owner: `0x5B12Ce46C7194aD57d143bC22847224047b1Ef42` (platform deployer wallet)
- USDC: `0x3600000000000000000000000000000000000000`
- Purpose: Holds USDC when sending to an email with no Avero wallet. Owner calls `releaseTo()` when recipient signs up. Sender can `cancel()` after 7 days.

## Key Files

- `src/App.tsx` — Auth state, routing, session management
- `src/lib/api.ts` — All API client functions
- `src/types/api.ts` — Shared request/response types (frontend + backend)
- `src/components/` — All dashboard pages
- `api/` — Vercel serverless functions (all backend logic)
- `contracts/AveiroEscrow.sol` — Escrow contract
- `contracts/test/AveiroEscrow.t.sol` — 46 Foundry unit tests
- `contracts/contract-metadata/AveiroEscrow.json` — Deployment metadata

## Live URLs

- Frontend: https://useavero.xyz (Vercel)
- GitHub: https://github.com/hammedfinance/avero

## To Run

```bash
bun install
bun run dev
# backend: bun run server/index.ts
```
