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
| AveiroEscrow | Arc Mainnet | `0x72B552FECb12Ce5d044dff24Ea23bEBCF2a16598` | https://explorer.arc.io/address/0x72B552FECb12Ce5d044dff24Ea23bEBCF2a16598 |
| AveiroEscrow | Arc Testnet | `0x74e0a983ff13e1dc9885cd40da0a30fb0fad695f` | https://explorer.testnet.arc.io/address/0x74e0a983ff13e1dc9885cd40da0a30fb0fad695f |

### AveiroEscrow — Arc Mainnet
- Deploy tx: `0x5e7735b8261fdc6ea709098d699246557fab870bb2edb50ed332e5607ff4b214`
- Signer: `0x0Af88809984e0c4E30ac381B6D34e1a9f9A53161` (ESCROW_SIGNER_PRIVATE_KEY in Render)
- Deployer: `0x0995905aDec2391De10227D407b34B1555eE384f`
- USDC: `0x3600000000000000000000000000000000000000`

### AveiroEscrow — Arc Testnet
- Deploy tx: `0xb784afed7054db8ab6987dce8b62f02b8db0feb9823eb8883b066dfbf57fd884`
- Signer: `0x6AEDA914Fb671d66f06a3AA9E2Bd3cE1C9e862d2` (testnet only)
- Old contract (signer key lost): `0xf7162548acae78c6a81f2322cc796e2bbfa3beb0`
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
