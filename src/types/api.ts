// ─────────────────────────────────────────────────────────────────────────────
// Avero shared API types
// Both frontend (src/lib/api.ts) and backend (api/**/*.ts) import from here.
// If you add a field to a payload or response, update it here first — TypeScript
// will immediately surface every place that needs to change.
// ─────────────────────────────────────────────────────────────────────────────

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface AuthUpsertPayload {
  dynamicId: string
  email: string
  name?: string
}

export interface AuthUpsertResponse {
  id: string
  email: string
  name: string | null
  walletId: string | null
  walletAddress: string | null
}

// ── Wallet ────────────────────────────────────────────────────────────────────

export interface WalletCreatePayload {
  userId: string
  email: string
}

export interface WalletCreateResponse {
  walletId: string
  address: string
}

export interface WalletBalancePayload {
  walletId?: string
  address?: string
  email?: string
}

export interface TokenBalance {
  amount: string
  token?: { symbol?: string }
}

export interface WalletBalanceResponse {
  balances: TokenBalance[]
  nativeBalance: string | null
  nativeSymbol: string
}

export interface SendPayload {
  senderEmail: string
  recipientEmail: string
  amount: string
  walletId: string
  message?: string
}

export interface SendResponse {
  success: boolean
  transactionId: string
  circleTransactionId?: string
  status: string
}

// ── Transaction status ────────────────────────────────────────────────────────

export interface TxStatusResponse {
  status: string
  txHash: string | null
  blockExplorerUrl: string | null
}

// ── Payment links ─────────────────────────────────────────────────────────────

export interface PaymentLinkCreatePayload {
  userId: string
  userEmail: string
  title: string
  amount: number
}

export interface PaymentLinkCreateResponse {
  id: string
  slug: string
  url: string
}

export interface PaymentLink {
  id: string
  slug: string
  title: string
  amount: number
  status: string
  created_at: string
}

export interface PaymentLinksListResponse {
  links: PaymentLink[]
}

// ── Transactions ──────────────────────────────────────────────────────────────

export interface Transaction {
  id: string
  sender_email: string
  recipient_email: string
  amount: string
  currency: string
  message?: string
  status: string
  circle_transaction_id?: string
  tx_hash?: string
  block_explorer_url?: string
  created_at: string
}

export interface TransactionsListResponse {
  transactions: Transaction[]
}

// ── Payment requests ──────────────────────────────────────────────────────────

export interface RequestCreatePayload {
  requesterEmail: string
  requesterId: string
  recipientEmail?: string
  amount: string
  note?: string
}

export interface RequestCreateResponse {
  id: string
  slug: string
  url: string
}

export interface PaymentRequest {
  id: string
  slug: string
  requester_email: string
  recipient_email: string | null
  amount: string
  note: string | null
  status: string
  created_at: string
}

export interface RequestsListResponse {
  requests: PaymentRequest[]
}

// ── User ──────────────────────────────────────────────────────────────────────

export interface UserLookupResponse {
  user: { id: string; email: string; username?: string } | null
}

// ── Generic error ─────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  error: string
  boundary?: string
  requiredEnv?: string[]
}
