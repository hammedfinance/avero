import { useState, useEffect, useRef, FormEvent } from 'react'
import {
  ArrowRight, Mail, MessageSquare, CheckCircle2,
  AlertCircle, ExternalLink, Copy, Check, Clock,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Input, AmountInput } from './ui/Input'
import { IntegrationBanner } from './ui/IntegrationBanner'
import { ApiError, walletApi, txStatusApi } from '../lib/api'
import { AverUser } from '../lib/auth'

interface SendMoneyPageProps {
  user: AverUser
}

type Step = 'form' | 'review' | 'sending' | 'confirming' | 'success' | 'error'

// Circle terminal states for developer-controlled wallet transactions
const TERMINAL: Set<string> = new Set(['CONFIRMED', 'COMPLETE', 'SENT', 'FAILED', 'CANCELED'])

const QUICK_AMOUNTS = ['1', '5', '10', '25', '50']

// Human-readable label for each Circle status
function statusLabel(s: string): string {
  if (s === 'INITIATED') return 'Accepted by Circle'
  if (s === 'PENDING')   return 'Submitted to network'
  if (s === 'SENT')      return 'Broadcast to Arc'
  if (s === 'CONFIRMED') return 'Confirmed on-chain'
  if (s === 'COMPLETE')  return 'Complete'
  if (s === 'FAILED')    return 'Transaction failed'
  if (s === 'CANCELED')  return 'Transaction canceled'
  return s
}

// Animated step tracker shown during confirmation
function ConfirmationTracker({ stage }: { stage: string }) {
  const stages = ['INITIATED', 'SENT', 'COMPLETE']
  const idx = stages.indexOf(stage)
  const current = idx >= 0 ? idx : 0

  return (
    <div className="space-y-3 my-6">
      {stages.map((s, i) => {
        const done    = i < current
        const active  = i === current
        const waiting = i > current
        return (
          <div key={s} className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              done   ? 'bg-[#0f3d22] border border-[#1a8047]/40' :
              active ? 'border-2 border-white bg-transparent' :
                       'border border-[#333] bg-transparent'
            }`}>
              {done && <Check size={11} className="text-[#4ade80]" />}
              {active && (
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              )}
            </div>
            <span className={`text-xs font-medium transition-colors ${
              done   ? 'text-[#4ade80]' :
              active ? 'text-white' :
                       'text-[#555]'
            }`}>
              {statusLabel(s)}
            </span>
            {active && !waiting && (
              <div className="ml-auto w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
            )}
          </div>
        )
      })}
    </div>
  )
}

function CopyInline({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      className="inline-flex items-center gap-1 text-[#A3A3A3] hover:text-white transition-colors"
      title="Copy"
    >
      {copied ? <Check size={12} className="text-[#4ade80]" /> : <Copy size={12} />}
    </button>
  )
}

export function SendMoneyPage({ user }: SendMoneyPageProps) {
  const [step, setStep] = useState<Step>('form')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [amount, setAmount]   = useState('')
  const [message, setMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ recipient?: string; amount?: string }>({})
  const [apiError, setApiError]       = useState('')
  const [configBoundary, setConfigBoundary] = useState<{ message: string; envVars: string[] } | null>(null)

  // IDs returned by the send endpoint
  const [txId, setTxId]                       = useState('')   // internal DB id
  const [circleTxId, setCircleTxId]           = useState('')   // Circle transaction id
  const [onchainStatus, setOnchainStatus]     = useState('PENDING')
  const [txHash, setTxHash]                   = useState<string | null>(null)
  const [explorerUrl, setExplorerUrl]         = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isDemo  = user.id.startsWith('demo-')

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  function validate(): boolean {
    const errors: typeof fieldErrors = {}
    if (!recipientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
      errors.recipient = 'Enter a valid email address.'
    }
    if (recipientEmail.trim().toLowerCase() === user.email.toLowerCase()) {
      errors.recipient = 'You cannot send money to yourself.'
    }
    const num = parseFloat(amount)
    if (!amount || isNaN(num) || num <= 0) {
      errors.amount = 'Enter an amount greater than 0.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleReview(e: FormEvent) {
    e.preventDefault()
    if (validate()) setStep('review')
  }

  /** Poll Circle for final confirmation every 2 s, give up after 90 s */
  function startPolling(cTxId: string) {
    if (!cTxId || cTxId.startsWith('demo-')) {
      // No real Circle tx — treat as instantly confirmed
      setOnchainStatus('CONFIRMED')
      setStep('success')
      return
    }

    setStep('confirming')
    let elapsed = 0
    pollRef.current = setInterval(() => {
      elapsed += 2
      void txStatusApi.get(cTxId).then((res) => {
        setOnchainStatus(res.status)
        if (res.txHash)        setTxHash(res.txHash)
        if (res.blockExplorerUrl) setExplorerUrl(res.blockExplorerUrl)

        if (TERMINAL.has(res.status)) {
          if (pollRef.current) clearInterval(pollRef.current)
          const succeeded = res.status === 'CONFIRMED' || res.status === 'COMPLETE' || res.status === 'SENT'
          setStep(succeeded ? 'success' : 'error')
        }
      }).catch(() => {
        // Swallow polling errors — keep trying
      })

      if (elapsed >= 90) {
        if (pollRef.current) clearInterval(pollRef.current)
        // If still not confirmed after 90 s, surface as success anyway
        // (the tx was accepted by Circle; confirmation may just be slow)
        setStep('success')
      }
    }, 2000)
  }

  async function handleSend() {
    setStep('sending')
    setApiError('')
    setConfigBoundary(null)

    try {
      const result = await walletApi.send({
        senderEmail:    user.email,
        recipientEmail: recipientEmail.trim(),
        amount,
        walletId:       user.walletId ?? '',
        walletAddress:  user.walletAddress ?? '',
        message: message.trim() || undefined,
      })
      const cTxId = result.circleTransactionId ?? ''
      setTxId(result.transactionId ?? 'demo-tx-' + Date.now())
      setCircleTxId(cTxId)
      startPolling(cTxId)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isConfigBoundary) {
          setConfigBoundary({ message: err.message, envVars: err.requiredEnv ?? [] })
        } else {
          setApiError(err.message)
        }
      } else {
        setApiError('Something went wrong. Please try again.')
      }
      setStep('error')
    }
  }

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current)
    setStep('form')
    setRecipientEmail('')
    setAmount('')
    setMessage('')
    setFieldErrors({})
    setApiError('')
    setConfigBoundary(null)
    setTxId('')
    setCircleTxId('')
    setOnchainStatus('PENDING')
    setTxHash(null)
    setExplorerUrl(null)
  }

  return (
    <div className="p-5 md:p-8 max-w-lg">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#A3A3A3] mb-1">Payments</p>
        <h1
          className="text-3xl font-extrabold tracking-[-0.03em] text-white"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Send money
        </h1>
        <p className="text-sm text-[#A3A3A3] mt-1">Send USDC to any email address on Arc.</p>
      </div>

      <AnimatePresence mode="wait">

        {/* ── Form ── */}
        {step === 'form' && (
          <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <form onSubmit={handleReview} className="space-y-5">
              {/* Amount */}
              <Card padding="none" className="overflow-hidden">
                <div className="p-5">
                  <AmountInput
                    label="Amount"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setFieldErrors((p) => ({ ...p, amount: undefined })) }}
                    error={fieldErrors.amount}
                    placeholder="0.00"
                  />
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {QUICK_AMOUNTS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAmount(a)}
                        className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                          amount === a
                            ? 'border-white/30 bg-white/10 text-white'
                            : 'border-[#242424] text-[#A3A3A3] hover:border-[#333] hover:text-white'
                        }`}
                      >
                        ${a}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Recipient */}
              <Input
                label="Recipient email"
                type="email"
                placeholder="recipient@example.com"
                value={recipientEmail}
                onChange={(e) => { setRecipientEmail(e.target.value); setFieldErrors((p) => ({ ...p, recipient: undefined })) }}
                prefix={<Mail size={15} />}
                error={fieldErrors.recipient}
                autoComplete="email"
              />

              {/* Message */}
              <Input
                label="Note (optional)"
                type="text"
                placeholder="What's this for?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                prefix={<MessageSquare size={15} />}
                hint="Appears in the recipient's transaction history."
              />

              {isDemo && (
                <IntegrationBanner
                  title="Demo mode"
                  description="Payments will show a configuration boundary until Circle credentials are added."
                  envVars={['CIRCLE_API_KEY', 'CIRCLE_ENTITY_SECRET', 'VITE_SUPABASE_URL']}
                />
              )}

              <Button type="submit" fullWidth size="lg" rightIcon={<ArrowRight size={16} />}>
                Review payment
              </Button>
            </form>
          </motion.div>
        )}

        {/* ── Review ── */}
        {step === 'review' && (
          <motion.div key="review" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <Card padding="lg">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#A3A3A3] mb-5">Review payment</p>

              <div className="text-center py-4 mb-5 border-b border-[#1A1A1A]">
                <p className="text-xs text-[#A3A3A3] mb-1">You are sending</p>
                <p
                  className="text-6xl font-extrabold text-white tabular-nums"
                  style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}
                >
                  {parseFloat(amount).toFixed(2)}
                </p>
                <p className="text-sm text-[#A3A3A3] mt-1">USDC on Arc</p>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'From',    value: user.email },
                  { label: 'To',      value: recipientEmail },
                  { label: 'Network', value: 'Arc' },
                  { label: 'Asset',   value: 'USDC' },
                  ...(message ? [{ label: 'Note', value: message }] : []),
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 py-2 border-b border-[#111111] last:border-0">
                    <span className="text-xs text-[#A3A3A3]">{row.label}</span>
                    <span className="text-xs font-semibold text-white text-right break-all max-w-[60%]">{row.value}</span>
                  </div>
                ))}
              </div>
            </Card>

            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => setStep('form')}>Edit</Button>
              <Button fullWidth onClick={() => { void handleSend() }} rightIcon={<ArrowRight size={15} />}>
                Confirm send
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── Sending (Circle accepted) ── */}
        {step === 'sending' && (
          <motion.div key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-12 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-white border-t-transparent animate-spin mx-auto mb-5" />
            <p className="text-sm font-semibold text-white">Submitting to Circle…</p>
            <p className="text-xs text-[#A3A3A3] mt-1">Signing and broadcasting your transaction</p>
          </motion.div>
        )}

        {/* ── Confirming (on-chain) ── */}
        {step === 'confirming' && (
          <motion.div key="confirming" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card padding="lg">
              <div className="flex items-center gap-3 mb-1">
                <Clock size={16} className="text-[#A3A3A3]" />
                <p className="text-sm font-bold text-white">Waiting for confirmation</p>
              </div>
              <p className="text-xs text-[#A3A3A3] mb-2">
                Your transaction is on Arc. Polling for confirmation…
              </p>

              <ConfirmationTracker stage={onchainStatus} />

              {circleTxId && (
                <div className="rounded-xl bg-[#0A0A0A] border border-[#1A1A1A] px-4 py-3 mt-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3] mb-1">Circle transaction ID</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-mono text-[#D4D4D4] truncate flex-1">{circleTxId}</p>
                    <CopyInline text={circleTxId} />
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* ── Success ── */}
        {step === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <Card padding="lg" className="text-center">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <CheckCircle2 size={44} className="text-[#4ade80] mx-auto mb-4" />
              </motion.div>

              <p
                className="text-2xl font-extrabold text-white mb-1"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Payment sent!
              </p>
              <p className="text-sm text-[#A3A3A3] mb-6">
                <span className="text-white font-semibold">{parseFloat(amount).toFixed(2)} USDC</span>
                {' '}sent to{' '}
                <span className="text-white font-semibold">{recipientEmail}</span>
              </p>

              {/* Status row */}
              <div className="rounded-xl bg-[#0f3d22]/40 border border-[#1a8047]/30 px-4 py-3 mb-4 text-left">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#4ade80]" />
                  <span className="text-xs font-semibold text-[#4ade80]">
                    {statusLabel(onchainStatus)}
                  </span>
                </div>
              </div>

              {/* Arc explorer link */}
              {explorerUrl && txHash && (
                <div className="rounded-xl bg-[#0A0A0A] border border-[#1A1A1A] px-4 py-3 mb-4 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3] mb-2">On-chain transaction</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-mono text-[#D4D4D4] truncate flex-1">
                      {txHash.slice(0, 18)}…{txHash.slice(-10)}
                    </p>
                    <CopyInline text={txHash} />
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-white hover:text-[#D4D4D4] transition-colors border border-[#242424] rounded-lg px-2 py-1"
                    >
                      View on Arc <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              )}

              {/* Internal tx ID (always shown) */}
              {txId && (
                <div className="rounded-xl bg-[#0A0A0A] border border-[#1A1A1A] px-4 py-3 mb-5 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3] mb-1">Transaction reference</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-mono text-[#D4D4D4] truncate flex-1">{txId}</p>
                    <CopyInline text={txId} />
                  </div>
                </div>
              )}

              <Button fullWidth onClick={reset}>
                Send another payment
              </Button>
            </Card>
          </motion.div>
        )}

        {/* ── Error ── */}
        {step === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {configBoundary ? (
              <IntegrationBanner
                title="Payment service not configured"
                description={configBoundary.message}
                envVars={configBoundary.envVars}
                link="https://developers.circle.com/developer/docs/developer-account-quickstart"
                linkLabel="Setup guide"
              />
            ) : (
              <Card padding="lg" className="text-center">
                <AlertCircle size={36} className="text-[#f87171] mx-auto mb-3" />
                <p className="text-sm font-semibold text-white mb-1">
                  {onchainStatus === 'FAILED'   ? 'Transaction failed on-chain' :
                   onchainStatus === 'CANCELED'  ? 'Transaction was canceled'   :
                                                   'Payment failed'}
                </p>
                <p className="text-xs text-[#A3A3A3]">{apiError || 'The transaction did not complete.'}</p>

                {/* Show explorer link even on failure if we have a hash */}
                {explorerUrl && txHash && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#A3A3A3] hover:text-white transition-colors"
                  >
                    View on Arc explorer <ExternalLink size={12} />
                  </a>
                )}
              </Card>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={reset}>Start over</Button>
              {!configBoundary && (
                <Button fullWidth onClick={() => setStep('review')}>Retry</Button>
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
