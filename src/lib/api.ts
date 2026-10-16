// Avero API client — all calls go through the Vite proxy at /api
import type {
  AuthUpsertPayload, AuthUpsertResponse,
  WalletCreateResponse, WalletBalancePayload, WalletBalanceResponse,
  SendPayload, SendResponse,
  TxStatusResponse,
  PaymentLinkCreatePayload, PaymentLinkCreateResponse, PaymentLinksListResponse,
  TransactionsListResponse,
  RequestCreatePayload, RequestCreateResponse, RequestsListResponse,
  UserLookupResponse,
} from '@/types/api'

const BASE = '/api'

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
  query?: Record<string, string>
): Promise<T> {
  const url = new URL(BASE + path, window.location.origin)
  if (query) {
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const res = await fetch(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  const data = (await res.json()) as { error?: string; boundary?: string; requiredEnv?: string[] }

  if (!res.ok) {
    throw new ApiError(data.error ?? 'An unexpected error occurred.', res.status, data.boundary, data.requiredEnv)
  }

  return data as T
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public boundary?: string,
    public requiredEnv?: string[]
  ) {
    super(message)
    this.name = 'ApiError'
  }

  get isConfigBoundary() {
    return this.status === 501
  }
}

// ── Auth ──
export const authApi = {
  upsert: (payload: AuthUpsertPayload) =>
    request<AuthUpsertResponse>('POST', '/auth/upsert', payload),
}

// ── Wallet ──
export const walletApi = {
  create: (userId: string, email: string) =>
    request<WalletCreateResponse>('POST', '/wallet/create', { userId, email }),
  balance: (payload: WalletBalancePayload) =>
    request<WalletBalanceResponse>('POST', '/wallet/balance', payload),
  send: (payload: SendPayload) =>
    request<SendResponse>('POST', '/wallet/send', payload),
}

// ── Transaction status (polling) ──
export const txStatusApi = {
  get: (circleTransactionId: string) =>
    request<TxStatusResponse>('GET', `/wallet/status/${encodeURIComponent(circleTransactionId)}`),
}

// ── Payment links ──
export const paymentLinksApi = {
  create: (payload: PaymentLinkCreatePayload) =>
    request<PaymentLinkCreateResponse>('POST', '/payments/create', payload),
  list: (userId: string) =>
    request<PaymentLinksListResponse>('GET', '/payments/list', undefined, { userId }),
}

// ── Transactions ──
export const transactionsApi = {
  list: (userId: string) =>
    request<TransactionsListResponse>('GET', '/transactions/list', undefined, { userId }),
}

// ── Payment Requests ──
export const requestApi = {
  create: (payload: RequestCreatePayload) =>
    request<RequestCreateResponse>('POST', '/requests/create', payload),
  list: (userId: string) =>
    request<RequestsListResponse>('GET', '/requests/list', undefined, { userId }),
}

// ── User ──
export const userApi = {
  lookup: (email: string) =>
    request<UserLookupResponse>('GET', '/user/lookup', undefined, { email }),
}
