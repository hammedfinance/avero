// Avero auth state — persisted session store
// Dynamic.xyz provides the live auth session; this module holds
// the enriched AverUser shape for use throughout the app.

export type AverUser = {
  id: string
  email: string
  name?: string
  walletId?: string
  walletAddress?: string
}

const SESSION_KEY = 'avero_session'

export function getSession(): AverUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AverUser) : null
  } catch {
    return null
  }
}

export function setSession(user: AverUser) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

export function isAuthenticated(): boolean {
  return getSession() !== null
}

/** Build an AverUser from a Dynamic user object */
export function buildAverUser(dynamicUser: {
  userId: string
  email?: string
  firstName?: string
  lastName?: string
  alias?: string
  verifiedCredentials?: Array<{ address?: string; walletProvider?: string; chain?: string }>
}): AverUser {
  const email =
    dynamicUser.email ??
    dynamicUser.alias ??
    `user-${dynamicUser.userId.slice(0, 8)}@avero.app`

  const name =
    [dynamicUser.firstName, dynamicUser.lastName].filter(Boolean).join(' ') ||
    email.split('@')[0]

  // Prefer the first EVM wallet address from Dynamic's verified credentials
  const evmWallet = dynamicUser.verifiedCredentials?.find(
    (c) => c.walletProvider !== undefined && c.chain !== 'solana' && c.address
  )

  return {
    id: dynamicUser.userId,
    email,
    name,
    walletAddress: evmWallet?.address,
  }
}
