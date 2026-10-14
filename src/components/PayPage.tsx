import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, CheckCircle2, AlertCircle, Link2 } from 'lucide-react'
import { Button } from './ui/Button'
import { Card } from './ui/Card'

interface PaymentLink {
  id: string
  title: string
  amount: number
  slug: string
  user_id: string
  status: string
}

interface PayPageProps {
  slug: string
}

export function PayPage({ slug }: PayPageProps) {
  const [link, setLink] = useState<PaymentLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payerEmail, setPayerEmail] = useState('')
  const [paying, setPaying] = useState(false)
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    fetch(`/api/payments/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error('Payment link not found')
        return r.json()
      })
      .then((d) => setLink((d as { link: PaymentLink }).link))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  async function handlePay() {
    if (!payerEmail || !link) return
    setPaying(true)
    try {
      const res = await fetch('/api/payments/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, payerEmail }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Payment failed')
      setPaid(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
      </div>
    )
  }

  if (error && !link) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
        <Card padding="lg" className="max-w-sm w-full text-center">
          <AlertCircle size={32} className="text-[#f87171] mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">Link not found</p>
          <p className="text-sm text-[#A3A3A3]">{error}</p>
          <div className="mt-4">
            <Button size="sm" onClick={() => window.location.href = '/'}>Go to Avero</Button>
          </div>
        </Card>
      </div>
    )
  }

  if (paid) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm w-full"
        >
          <Card padding="lg" className="text-center">
            <CheckCircle2 size={40} className="text-[#4ade80] mx-auto mb-4" />
            <p className="text-xl font-bold text-white mb-1">Payment sent!</p>
            <p className="text-sm text-[#A3A3A3] mb-4">
              You sent <span className="text-white font-semibold">${link?.amount.toFixed(2)} USDC</span> successfully.
            </p>
            <Button size="sm" onClick={() => window.location.href = '/'}>Open Avero</Button>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <span
          className="text-2xl font-extrabold tracking-[-0.04em] text-white"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Avero
        </span>
        <p className="text-xs text-[#A3A3A3] mt-1">Move money intelligently.</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <Card padding="lg">
          {/* Payment link icon */}
          <div className="w-10 h-10 rounded-xl bg-[#171717] border border-[#242424] flex items-center justify-center mb-4">
            <Link2 size={18} className="text-[#A3A3A3]" />
          </div>

          {/* Title + amount */}
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A3A3A3] mb-1">Payment request</p>
          <h1
            className="text-2xl font-extrabold text-white mb-1"
            style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.03em' }}
          >
            {link?.title}
          </h1>
          <p
            className="text-4xl font-extrabold text-white tabular-nums mb-6"
            style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}
          >
            ${link?.amount.toFixed(2)}
            <span className="text-base font-normal text-[#A3A3A3] ml-2">USDC</span>
          </p>

          {/* Payer email */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5 uppercase tracking-[0.1em]">
              Your email
            </label>
            <input
              type="email"
              value={payerEmail}
              onChange={(e) => setPayerEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-[#0A0A0A] border border-[#242424] rounded-xl px-4 py-3 text-sm text-white placeholder-[#555] focus:outline-none focus:border-white/30 transition-colors"
            />
            <p className="text-[10px] text-[#555] mt-1.5">
              You need an Avero account with sufficient USDC balance to pay.
            </p>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-xl bg-[#3d0f1a] border border-[#f87171]/20">
              <p className="text-xs text-[#f87171]">{error}</p>
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => { void handlePay() }}
            disabled={!payerEmail || paying}
            leftIcon={<ArrowUpRight size={16} />}
          >
            {paying ? 'Processing…' : `Pay $${link?.amount.toFixed(2)} USDC`}
          </Button>

          <p className="text-[10px] text-[#A3A3A3] text-center mt-4">
            Powered by <span className="text-white font-semibold">Avero</span> · USDC on Arc
          </p>
        </Card>
      </motion.div>
    </div>
  )
}
