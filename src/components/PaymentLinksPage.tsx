import { useState, useEffect, FormEvent } from 'react'
import { Plus, Copy, Check, Link2, ExternalLink, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Input, AmountInput } from './ui/Input'
import { Badge } from './ui/Badge'
import { IntegrationBanner } from './ui/IntegrationBanner'
import { ApiError, paymentLinksApi } from '../lib/api'
import { AverUser } from '../lib/auth'

interface PaymentLinksPageProps {
  user: AverUser
}

type PaymentLink = {
  id: string
  slug: string
  title: string
  amount: number
  status: 'open' | 'closed'
  created_at: string
  url?: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded-lg border border-[#242424] text-[#A3A3A3] hover:text-white hover:border-[#333] transition-colors"
      title="Copy link"
    >
      {copied ? <Check size={13} className="text-[#4ade80]" /> : <Copy size={13} />}
    </button>
  )
}

export function PaymentLinksPage({ user }: PaymentLinksPageProps) {
  const [links, setLinks] = useState<PaymentLink[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [formErrors, setFormErrors] = useState<{ title?: string; amount?: string }>({})
  const [configBoundary, setConfigBoundary] = useState<{ message: string; envVars: string[] } | null>(null)

  const isDemo = user.id.startsWith('demo-')

  useEffect(() => {
    if (!isDemo) {
      void loadLinks()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, isDemo])

  async function loadLinks() {
    setLoading(true)
    try {
      const data = await paymentLinksApi.list(user.id)
      setLinks(data.links as PaymentLink[])
    } catch (err) {
      if (err instanceof ApiError && err.isConfigBoundary) {
        setConfigBoundary({ message: err.message, envVars: err.requiredEnv ?? [] })
      }
    } finally {
      setLoading(false)
    }
  }

  function validateForm(): boolean {
    const errors: typeof formErrors = {}
    if (!title.trim()) errors.title = 'Title is required.'
    const num = parseFloat(amount)
    if (!amount || isNaN(num) || num <= 0) errors.amount = 'Enter an amount greater than 0.'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!validateForm()) return

    setCreating(true)
    setConfigBoundary(null)
    try {
      const result = await paymentLinksApi.create(user.id, user.email, title.trim(), parseFloat(amount))
      setLinks((prev) => [
        {
          id: result.id,
          slug: result.slug,
          title: title.trim(),
          amount: parseFloat(amount),
          status: 'open',
          created_at: new Date().toISOString(),
          url: result.url ?? `avero.app/pay/${result.slug}`,
        },
        ...prev,
      ])
      setTitle('')
      setAmount('')
      setShowForm(false)
    } catch (err) {
      if (err instanceof ApiError && err.isConfigBoundary) {
        setConfigBoundary({ message: err.message, envVars: err.requiredEnv ?? [] })
      }
    } finally {
      setCreating(false)
    }
  }

  const linkUrl = (link: PaymentLink) =>
    link.url ?? `avero.app/pay/${link.slug}`

  return (
    <div className="p-5 md:p-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#A3A3A3] mb-1">Payments</p>
          <h1
            className="text-3xl font-extrabold tracking-[-0.03em] text-white"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Payment links
          </h1>
          <p className="text-sm text-[#A3A3A3] mt-1">Create shareable links for any amount.</p>
        </div>
        <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowForm(true)}>
          New link
        </Button>
      </div>

      {/* Config banner */}
      {configBoundary && (
        <div className="mb-6">
          <IntegrationBanner
            title="Payment links require Supabase"
            description={configBoundary.message}
            envVars={configBoundary.envVars}
            link="https://developers.circle.com/developer/docs/developer-account-quickstart"
          />
        </div>
      )}

      {/* Create form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm rounded-2xl border border-[#242424] bg-[#111111] p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-white">New payment link</h2>
                <button onClick={() => setShowForm(false)} className="text-[#A3A3A3] hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={(e) => { void handleCreate(e) }} className="space-y-4">
                <Input
                  label="Title"
                  placeholder="e.g. Freelance invoice, Phase 2"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setFormErrors((p) => ({ ...p, title: undefined })) }}
                  error={formErrors.title}
                  prefix={<Link2 size={14} />}
                />
                <AmountInput
                  label="Amount"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setFormErrors((p) => ({ ...p, amount: undefined })) }}
                  error={formErrors.amount}
                />

                {isDemo && !configBoundary && (
                  <IntegrationBanner
                    title="Demo mode"
                    description="Links will show a configuration error until Supabase is connected."
                    envVars={['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']}
                  />
                )}

                <div className="flex gap-3 pt-1">
                  <Button type="button" variant="secondary" fullWidth onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" fullWidth loading={creating}>
                    Create link
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Link list */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin mx-auto" />
        </div>
      ) : links.length === 0 ? (
        <Card padding="lg" className="text-center">
          <div className="w-10 h-10 rounded-xl bg-[#171717] border border-[#242424] flex items-center justify-center mx-auto mb-3">
            <Link2 size={16} className="text-[#A3A3A3]" />
          </div>
          <p className="text-sm font-semibold text-white mb-1">No payment links yet</p>
          <p className="text-xs text-[#A3A3A3] mb-4">
            {isDemo ? 'Connect Supabase to persist payment links.' : 'Create your first shareable payment link.'}
          </p>
          <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowForm(true)}>
            Create link
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <motion.div
              key={link.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-[#242424] bg-[#111111] p-5"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{link.title}</p>
                  <p className="text-xs text-[#A3A3A3] mt-0.5">{new Date(link.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={link.status === 'open' ? 'open' : 'default'}>{link.status}</Badge>
                </div>
              </div>

              <p
                className="text-3xl font-extrabold text-white tabular-nums mb-3"
                style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}
              >
                {link.amount.toFixed(2)} <span className="text-sm text-[#A3A3A3] font-semibold">USDC</span>
              </p>

              <div className="flex items-center gap-2 rounded-xl bg-[#0A0A0A] border border-[#1A1A1A] px-3 py-2">
                <p className="flex-1 text-xs font-mono text-[#A3A3A3] truncate">{linkUrl(link)}</p>
                <CopyButton text={linkUrl(link)} />
                <a
                  href={`https://${linkUrl(link)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg border border-[#242424] text-[#A3A3A3] hover:text-white hover:border-[#333] transition-colors"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
