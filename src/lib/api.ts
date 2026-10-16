// Avero API client — all calls go through the Vite proxy at /api

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
  register: (email: string, password: string, name: string) =>
    request<{ user: { id: string; email: string } }>('POST', '/auth/register', { email, password, name }),
  login: (email: string, password: string) =>
    request<{ user: { id: string; email: string }; session: { access_token: string } }>('POST', '/auth/login', { email, password }),
}

// ── Wallet ──
export const walletApi = {
  create: (userId: string, email: string) =>
    request<{ walletId: string; address: string }>('POST', '/wallet/create', { userId, email }),
  balance: (walletId?: string, address?: string) =>
    request<{ balances: Array<{ amount: string; token?: { symbol?: string } }>; nativeBalance: string | null; nativeSymbol: string }>('POST', '/wallet/balance', { walletId, address }),
  send: (payload: { senderEmail: string; recipientEmail: string; amount: string; walletId?: string; message?: string }) =>
    request<{ success: boolean; transactionId: string; circleTransactionId?: string; status: string }>('POST', '/wallet/send', payload),
}

// ── Transaction status (polling) ──
export const txStatusApi = {
  get: (circleTransactionId: string) =>
    request<{
      status: string
      txHash: string | null
      blockExplorerUrl: string | null
    }>('GET', `/wallet/status/${encodeURIComponent(circleTransactionId)}`),
}

// ── Payment links ──
export const paymentLinksApi = {
  create: (userId: string, userEmail: string, title: string, amount: number) =>
    request<{ id: string; slug: string; url: string }>('POST', '/payments/create', { userId, userEmail, title, amount }),
  list: (userId: string) =>
    request<{ links: Array<{ id: string; slug: string; title: string; amount: number; status: string; created_at: string }> }>('GET', '/payments/list', undefined, { userId }),
}

// ── Transactions ──
export const transactionsApi = {
  list: (userId: string) =>
    request<{ transactions: Array<{ id: string; sender_email: string; recipient_email: string; amount: string; currency: string; message?: string; status: string; created_at: string }> }>('GET', '/transactions/list', undefined, { userId }),
}

// ── Payment Requests ──
export const requestApi = {
  create: (payload: {
    requesterEmail: string
    requesterId: string
    recipientEmail?: string
    amount: string
    note?: string
  }) =>
    request<{ id: string; slug: string; url: string }>('POST', '/requests/create', payload),
  list: (userId: string) =>
    request<{
      requests: Array<{
        id: string; slug: string; requester_email: string
        recipient_email: string | null; amount: string
        note: string | null; status: string; created_at: string
      }>
    }>('GET', '/requests/list', undefined, { userId }),
}

// ── User ──
export const userApi = {
  lookup: (email: string) =>
    request<{ user: { id: string; email: string; username?: string } | null }>('GET', '/user/lookup', undefined, { email }),
}
