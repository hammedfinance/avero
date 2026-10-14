import { useState, useEffect } from 'react'
import { ArrowUpRight, ArrowDownLeft, Clock, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { Card } from './ui/Card'
import { Badge } from './ui/Badge'
import { Input } from './ui/Input'
import { IntegrationBanner } from './ui/IntegrationBanner'
import { ApiError, transactionsApi } from '../lib/api'
import { AverUser } from '../lib/auth'

interface TransactionsPageProps {
  user: AverUser
}

type Tx = {
  id: string
  sender_email: string
  recipient_email: string
  amount: string
  currency: string
  message?: string
  status: string
  created_at: string
}

function normalizeStatus(s: string): 'completed' | 'pending' | 'failed' {
  const up = s?.toUpperCase() ?? ''
  if (['COMPLETE', 'COMPLETED', 'CONFIRMED', 'SENT', 'SUCCESS', 'INITIATED'].includes(up)) return 'completed'
  if (['FAILED', 'CANCELLED', 'CANCELED'].includes(up)) return 'failed'
  return 'pending'
}

type Filter = 'all' | 'sent' | 'received'

function StatusBadge({ status }: { status: string }) {
  const s = normalizeStatus(status)
  if (s === 'completed') return <Badge variant="success">Completed</Badge>
  if (s === 'pending') return <Badge variant="pending">Pending</Badge>
  return <Badge variant="danger">Failed</Badge>
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function TransactionsPage({ user }: TransactionsPageProps) {
  const [txns, setTxns] = useState<Tx[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [configBoundary, setConfigBoundary] = useState<{ message: string; envVars: string[] } | null>(null)

  const isDemo = user.id.startsWith('demo-')

  useEffect(() => {
    if (!isDemo) void loadTxns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, isDemo])

  async function loadTxns() {
    setLoading(true)
    try {
      const data = await transactionsApi.list(user.id)
      setTxns(data.transactions)
    } catch (err) {
      if (err instanceof ApiError && err.isConfigBoundary) {
        setConfigBoundary({ message: err.message, envVars: err.requiredEnv ?? [] })
      }
    } finally {
      setLoading(false)
    }
  }

  const filtered = txns.filter((tx) => {
    const isSent = tx.sender_email.toLowerCase() === user.email.toLowerCase()
    if (filter === 'sent' && !isSent) return false
    if (filter === 'received' && isSent) return false
    if (search) {
      const q = search.toLowerCase()
      return tx.sender_email.includes(q) || tx.recipient_email.includes(q) || tx.message?.toLowerCase().includes(q)
    }
    return true
  })

  // Group by date
  const grouped = filtered.reduce<Record<string, Tx[]>>((acc, tx) => {
    const key = formatDate(tx.created_at)
    if (!acc[key]) acc[key] = []
    acc[key].push(tx)
    return acc
  }, {})

  return (
    <div className="p-5 md:p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#A3A3A3] mb-1">History</p>
        <h1
          className="text-3xl font-extrabold tracking-[-0.03em] text-white"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Transactions
        </h1>
        <p className="text-sm text-[#A3A3A3] mt-1">All your sent and received payments.</p>
      </div>

      {/* Config */}
      {configBoundary && (
        <div className="mb-6">
          <IntegrationBanner
            title="Transaction history requires Supabase"
            description={configBoundary.message}
            envVars={configBoundary.envVars}
            link="https://supabase.com/docs/guides/getting-started"
          />
        </div>
      )}

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search by email or note…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<Search size={14} />}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'sent', 'received'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? 'bg-white text-[#050505] border-white'
                  : 'border-[#242424] text-[#A3A3A3] hover:border-[#333] hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin mx-auto" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card padding="lg" className="text-center">
          <div className="w-10 h-10 rounded-xl bg-[#171717] border border-[#242424] flex items-center justify-center mx-auto mb-3">
            <Clock size={16} className="text-[#A3A3A3]" />
          </div>
          <p className="text-sm font-semibold text-white mb-1">No transactions yet</p>
          <p className="text-xs text-[#A3A3A3]">
            {isDemo ? 'Connect Supabase to view real transaction history.' : search ? 'No results match your search.' : 'Send your first payment to see it here.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-[#A3A3A3] mb-3 uppercase tracking-wider">{date}</p>
              <div className="space-y-2">
                {items.map((tx, i) => {
                  const isSent = tx.sender_email.toLowerCase() === user.email.toLowerCase()
                  const counterparty = isSent ? tx.recipient_email : tx.sender_email
                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-4 rounded-xl border border-[#1A1A1A] bg-[#111111] px-4 py-3"
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isSent ? 'bg-[#3d0f1a]' : 'bg-[#0f3d22]'}`}>
                        {isSent
                          ? <ArrowUpRight size={15} className="text-[#f87171]" />
                          : <ArrowDownLeft size={15} className="text-[#4ade80]" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{counterparty}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-[#A3A3A3]">{formatTime(tx.created_at)}</p>
                          {tx.message && (
                            <p className="text-[10px] text-[#A3A3A3] truncate max-w-[120px]">· {tx.message}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold tabular-nums ${isSent ? 'text-[#f87171]' : 'text-[#4ade80]'}`}>
                          {isSent ? '−' : '+'}{parseFloat(tx.amount).toFixed(2)}
                          <span className="text-[10px] font-normal text-[#A3A3A3] ml-1">{tx.currency}</span>
                        </p>
                        <div className="mt-1">
                          <StatusBadge status={tx.status} />
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
