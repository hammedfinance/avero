import { useState, useEffect } from 'react'
import { ArrowUpRight, ArrowDownLeft, Plus, Link2, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import { IntegrationBanner } from './ui/IntegrationBanner'
import { walletApi, transactionsApi } from '../lib/api'
import { AverUser } from '../lib/auth'
import { DashView } from './DashboardLayout'

interface OverviewPageProps {
  user: AverUser
  onNavigate: (v: DashView) => void
}

type TxItem = {
  id: string
  type: 'sent' | 'received'
  email: string
  amount: string
  status: 'completed' | 'pending' | 'failed'
  date: string
  rawAmount: number
}

function normalizeStatus(s: string): 'completed' | 'pending' | 'failed' {
  const up = s?.toUpperCase() ?? ''
  if (['COMPLETE', 'COMPLETED', 'CONFIRMED', 'SENT', 'SUCCESS'].includes(up)) return 'completed'
  if (['FAILED', 'CANCELLED', 'CANCELED'].includes(up)) return 'failed'
  return 'pending'
}

function StatusBadge({ status }: { status: TxItem['status'] }) {
  if (status === 'completed') return <Badge variant="success">Completed</Badge>
  if (status === 'pending')   return <Badge variant="pending">Pending</Badge>
  return <Badge variant="danger">Failed</Badge>
}

function fmt(amount: string) {
  const n = parseFloat(amount)
  return isNaN(n) ? amount : n.toFixed(2)
}

export function OverviewPage({ user, onNavigate }: OverviewPageProps) {
  const isDemo = user.id.startsWith('demo-')

  const [balance, setBalance]         = useState<string | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [recentTxns, setRecentTxns]   = useState<TxItem[]>([])
  const [totalTxCount, setTotalTxCount] = useState<string>('—')
  const [sentTotal, setSentTotal]     = useState<string>('—')
  const [recvTotal, setRecvTotal]     = useState<string>('—')
  const [linkCount, setLinkCount]     = useState<string>('—')

  // ── Fetch balance ─────────────────────────────────────────────
  useEffect(() => {
    if (isDemo) return
    setBalanceLoading(true)
    walletApi.balance({ walletId: user.walletId, email: user.email })
      .then((data) => {
        const usdcBalance = data.balance ?? data.tokenBalances?.[0]?.amount ?? null
        if (usdcBalance) setBalance(usdcBalance)
      })
      .catch(() => { /* non-fatal */ })
      .finally(() => setBalanceLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, user.email])

  // ── Fetch recent transactions ─────────────────────────────────
  useEffect(() => {
    if (isDemo || !user.id) return
    transactionsApi
      .list(user.id, user.email)
      .then((data) => {
        type RawTx = {
          id: string
          sender_email: string
          recipient_email: string
          amount: string
          status: string
          created_at: string
        }
        const raw: RawTx[] = (data.transactions) ?? []
        // Compute stats from ALL transactions
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        let sentSum = 0, recvSum = 0
        raw.forEach((t) => {
          const amt = parseFloat(t.amount) || 0
          const isSent = t.sender_email.toLowerCase() === user.email.toLowerCase()
          const txDate = new Date(t.created_at)
          if (isSent && txDate >= startOfMonth) sentSum += amt
          if (!isSent) recvSum += amt
        })
        setSentTotal(sentSum > 0 ? `$${sentSum.toFixed(2)}` : '$0.00')
        setRecvTotal(recvSum > 0 ? `$${recvSum.toFixed(2)}` : '$0.00')
        setTotalTxCount(String(raw.length))

        const mapped: TxItem[] = raw.slice(0, 5).map((t) => ({
          id: t.id,
          type: t.sender_email.toLowerCase() === user.email.toLowerCase() ? 'sent' : 'received',
          email: t.sender_email.toLowerCase() === user.email.toLowerCase() ? t.recipient_email : t.sender_email,
          amount: fmt(t.amount),
          rawAmount: parseFloat(t.amount) || 0,
          status: normalizeStatus(t.status),
          date: new Date(t.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          }),
        }))
        setRecentTxns(mapped)
      })
      .catch(() => { /* non-fatal */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, user.id])

  // ── Fetch payment links count ─────────────────────────────────
  useEffect(() => {
    if (isDemo || !user.id) return
    void import('../lib/api').then(({ paymentLinksApi }) => {
      paymentLinksApi.list(user.id)
        .then((d) => setLinkCount(String((d.links as unknown[])?.length ?? 0)))
        .catch(() => { /* non-fatal */ })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, user.id])

  return (
    <div className="p-5 md:p-8 max-w-4xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#A3A3A3] mb-1">Good day</p>
        <h1
          className="text-3xl font-extrabold tracking-[-0.03em] text-white"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          {user.name ?? user.email.split('@')[0]}
        </h1>
        <p className="text-sm text-[#A3A3A3] mt-1">{user.email}</p>
      </motion.div>

      {/* Config banner */}
      {isDemo && (
        <div className="mb-6">
          <IntegrationBanner
            title="Demo mode — no live transactions"
            description="Add your Supabase and Circle credentials to enable real USDC payments."
            envVars={['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'CIRCLE_API_KEY', 'CIRCLE_ENTITY_SECRET', 'CIRCLE_WALLET_SET_ID']}
            link="https://developers.circle.com/developer/docs/developer-account-quickstart"
            linkLabel="Circle quickstart guide"
          />
        </div>
      )}

      {/* Balance + quick stats */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {/* Balance card */}
        <Card className="col-span-full sm:col-span-1" padding="lg">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#A3A3A3] mb-3">USDC balance</p>
          {balanceLoading ? (
            <div className="h-12 w-36 bg-[#1A1A1A] rounded animate-pulse" />
          ) : (
            <p
              className="text-5xl font-extrabold text-white tabular-nums"
              style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}
            >
              {balance !== null ? `$${parseFloat(balance).toFixed(2)}` : '—'}
            </p>
          )}
          <p className="text-xs text-[#A3A3A3] mt-2">
            {user.walletAddress
              ? <span className="font-mono">{user.walletAddress.slice(0, 10)}…{user.walletAddress.slice(-6)}</span>
              : 'Go to Wallet to provision'}
          </p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => onNavigate('send')} leftIcon={<ArrowUpRight size={14} />}>
              Send
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onNavigate('wallet')} leftIcon={<ExternalLink size={14} />}>
              Wallet
            </Button>
          </div>
        </Card>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Sent this month',  value: sentTotal,  icon: ArrowUpRight,  color: 'text-[#f87171]' },
            { label: 'Received',         value: recvTotal,  icon: ArrowDownLeft, color: 'text-[#4ade80]' },
            { label: 'Payment links',    value: linkCount,  icon: Link2,         color: 'text-[#A3A3A3]' },
            { label: 'Transactions',     value: totalTxCount,  icon: ArrowUpRight, color: 'text-[#A3A3A3]' },
          ].map((stat) => (
            <Card key={stat.label} padding="sm" className="flex flex-col gap-2">
              <stat.icon size={14} className={stat.color} />
              <p className="text-xl font-bold text-white tabular-nums" style={{ fontFamily: 'Manrope, sans-serif' }}>{stat.value}</p>
              <p className="text-[10px] text-[#A3A3A3] font-medium leading-tight">{stat.label}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Send money',   icon: ArrowUpRight, view: 'send'         as DashView },
          { label: 'Create link',  icon: Plus,         view: 'links'        as DashView },
          { label: 'Transactions', icon: ClockIcon,    view: 'transactions' as DashView },
          { label: 'Wallet',       icon: WalletIcon,   view: 'wallet'       as DashView },
        ].map((action) => (
          <button
            key={action.label}
            onClick={() => onNavigate(action.view)}
            className="rounded-xl border border-[#242424] bg-[#111111] p-4 flex flex-col items-start gap-3 hover:bg-[#171717] hover:border-[#333] transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#171717] border border-[#242424] flex items-center justify-center group-hover:bg-[#242424] transition-colors">
              <action.icon size={14} className="text-[#D4D4D4]" />
            </div>
            <span className="text-xs font-semibold text-[#D4D4D4]">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Recent transactions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white">Recent transactions</h2>
          <button
            onClick={() => onNavigate('transactions')}
            className="text-xs text-[#A3A3A3] hover:text-white transition-colors flex items-center gap-1"
          >
            View all <ArrowUpRight size={12} />
          </button>
        </div>

        {recentTxns.length === 0 ? (
          <Card padding="lg" className="text-center">
            <div className="w-10 h-10 rounded-xl bg-[#171717] border border-[#242424] flex items-center justify-center mx-auto mb-3">
              <ArrowUpRight size={16} className="text-[#A3A3A3]" />
            </div>
            <p className="text-sm font-semibold text-white mb-1">No transactions yet</p>
            <p className="text-xs text-[#A3A3A3] mb-4">
              {isDemo ? 'Connect your backend to see real transactions.' : 'Send your first payment to get started.'}
            </p>
            <Button size="sm" onClick={() => onNavigate('send')}>Send money</Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentTxns.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center gap-4 rounded-xl border border-[#1A1A1A] bg-[#111111] px-4 py-3"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  tx.type === 'sent' ? 'bg-[#3d0f1a]' : 'bg-[#0f3d22]'
                }`}>
                  {tx.type === 'sent'
                    ? <ArrowUpRight size={14} className="text-[#f87171]" />
                    : <ArrowDownLeft size={14} className="text-[#4ade80]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{tx.email}</p>
                  <p className="text-xs text-[#A3A3A3]">{tx.date}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold tabular-nums ${tx.type === 'sent' ? 'text-[#f87171]' : 'text-[#4ade80]'}`}>
                    {tx.type === 'sent' ? '−' : '+'}${tx.amount}
                  </p>
                  <StatusBadge status={tx.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ClockIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function WalletIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
      <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
      <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
    </svg>
  )
}
