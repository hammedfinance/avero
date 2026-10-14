import { useState, useRef, useEffect } from 'react'
import { useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { LandingPage } from './components/LandingPage'
import { AuthPage } from './components/AuthPage'
import { DashboardLayout, DashView } from './components/DashboardLayout'
import { OverviewPage } from './components/OverviewPage'
import { SendMoneyPage } from './components/SendMoneyPage'
import { RequestMoneyPage } from './components/RequestMoneyPage'
import { BulkSendPage } from './components/BulkSendPage'
import { PaymentLinksPage } from './components/PaymentLinksPage'
import { TransactionsPage } from './components/TransactionsPage'
import { WalletPage } from './components/WalletPage'
import { AverUser, buildAverUser, setSession, clearSession, getSession } from './lib/auth'
import { PayPage } from './components/PayPage'

// ── Types ──────────────────────────────────────────────────────────────────

type AppView = 'landing' | 'auth' | 'dashboard'

type UpsertResult = {
  user: { wallet_id: string | null; wallet_address: string | null } | null
  walletProvisioned: boolean
}

// ── Backend helper (typed, outside component to avoid hook re-creation) ────

async function upsertUserBackend(
  id: string,
  email: string,
  name?: string,
): Promise<UpsertResult> {
  const res = await fetch('/api/auth/upsert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, email, name }),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`upsert failed: ${res.status}`)
  return res.json() as Promise<UpsertResult>
}

// ── App component ──────────────────────────────────────────────────────────

export default function App() {
  const { user: dynamicUser, handleLogOut } = useDynamicContext()

  // Seed from persisted session so a page-refresh doesn't flash the landing page
  const [view, setView] = useState<AppView>(() =>
    getSession() ? 'dashboard' : 'landing'
  )
  const [user, setUser] = useState<AverUser | null>(() => getSession())
  const [dashView, setDashView] = useState<DashView>('overview')

  // Track last synced Dynamic user ID to avoid re-running on unrelated re-renders
  const lastSyncedId = useRef<string | null>(getSession()?.id ?? null)

  // Sync Dynamic → local session when Dynamic signs a user in.
  // The setState calls are deferred via setTimeout(0) out of the synchronous
  // effect body, satisfying the set-state-in-effect lint rule.
  useEffect(() => {
    const dId = (dynamicUser as { userId?: string } | null)?.userId ?? null
    if (!dId || dId === lastSyncedId.current) return
    lastSyncedId.current = dId
    const averUser = buildAverUser(dynamicUser as Parameters<typeof buildAverUser>[0])
    setSession(averUser)
    const timeout = setTimeout(() => {
      setUser(averUser)
      setView('dashboard')
      setDashView('overview')
      // Upsert to Supabase + provision Circle wallet in the background (non-blocking)
      void upsertUserBackend(averUser.id, averUser.email, averUser.name)
        .then((result: UpsertResult) => {
          const walletAddress: string | undefined = result.user?.wallet_address ?? undefined
          const walletId: string | undefined = result.user?.wallet_id ?? undefined
          if (walletAddress !== undefined || walletId !== undefined) {
            const enriched: AverUser = { ...averUser, walletAddress, walletId }
            setSession(enriched)
            setUser(enriched)
          }
        })
        .catch(() => { /* non-fatal — wallet can be retried from the Wallet page */ })
    }, 0)
    return () => clearTimeout(timeout)
  }) // no dep array — runs after every render, guarded by the ref

  function handleGetStarted() {
    setView('auth')
  }

  function handleBack() {
    setView('landing')
  }

  function handleAuthenticated(authUser: { id: string; email: string; name?: string }) {
    const u: AverUser = { id: authUser.id, email: authUser.email, name: authUser.name }
    setSession(u)
    setUser(u)
    setView('dashboard')
    setDashView('overview')
  }

  async function handleSignOut() {
    try {
      await handleLogOut()
    } catch {
      // no-op — handleLogOut throws if no active session
    }
    lastSyncedId.current = null
    clearSession()
    setUser(null)
    setView('landing')
    setDashView('overview')
  }

  // Handle /pay/:slug routes — after all hooks
  const paySlugMatch = window.location.pathname.match(/^\/pay\/([a-z0-9]+)$/i)
  if (paySlugMatch) {
    return <PayPage slug={paySlugMatch[1]} />
  }

  if (view === 'landing') {
    return <LandingPage onGetStarted={handleGetStarted} />
  }

  if (view === 'auth') {
    return (
      <AuthPage
        onBack={handleBack}
        onAuthenticated={handleAuthenticated}
      />
    )
  }

  if (view === 'dashboard' && user) {
    return (
      <DashboardLayout
        user={user}
        activeView={dashView}
        onNavigate={setDashView}
        onSignOut={() => { void handleSignOut() }}
      >
        {dashView === 'overview'     && <OverviewPage user={user} onNavigate={setDashView} />}
        {dashView === 'send'         && <SendMoneyPage user={user} />}
        {dashView === 'request'      && <RequestMoneyPage user={user} />}
        {dashView === 'bulk'         && <BulkSendPage user={user} />}
        {dashView === 'links'        && <PaymentLinksPage user={user} />}
        {dashView === 'transactions' && <TransactionsPage user={user} />}
        {dashView === 'wallet'       && <WalletPage user={user} />}
      </DashboardLayout>
    )
  }

  return null
}
