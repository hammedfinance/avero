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
| AveiroEscrow | Arc Testnet | `0xfcb76ea576f5fa395f0c4e54ce39dafa6d7031db` | https://explorer.testnet.arc.io/address/0xfcb76ea576f5fa395f0c4e54ce39dafa6d7031db |

### AveiroEscrow
- Deploy tx: `0xb9381013b9e64507644ab9a93d08eb015e84172eb7f7a4ed669f0b0ea246dc85`
- Signer: `0x497A18873CcFB95Ba43B83d6059833b091787376` (backend signer key)
- USDC: `0x3600000000000000000000000000000000000000`
- Purpose: Holds USDC when sending to an email with no Avero wallet. Backend signs releaseTo() calls with ESCROW_SIGNER_PRIVATE_KEY. Sender can cancel() after 7 days.

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
