import { useState } from 'react'
import { ArrowRight, Link2, Mail, Copy, Check, DollarSign } from 'lucide-react'
import { AverUser } from '../lib/auth'
import { requestApi } from '../lib/api'

interface RequestMoneyPageProps {
  user: AverUser
}

type Step = 'form' | 'sending' | 'success' | 'error'

const QUICK_AMOUNTS = ['5', '10', '25', '50', '100']

export function RequestMoneyPage({ user }: RequestMoneyPageProps) {
  const [step, setStep] = useState<Step>('form')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [requestUrl, setRequestUrl] = useState('')
  const [requestId, setRequestId] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  function reset() {
    setStep('form')
    setRecipientEmail('')
    setAmount('')
    setNote('')
    setRequestUrl('')
    setRequestId('')
    setErrorMsg('')
    setCopied(false)
    setEmailSent(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) return
    setStep('sending')
    try {
      const result = await requestApi.create({
        requesterEmail: user.email,
        requesterId: user.id,
        recipientEmail: recipientEmail.trim() || undefined,
        amount,
        note: note.trim() || undefined,
      })
      setRequestUrl(result.url)
      setRequestId(result.id)
      setEmailSent(!!recipientEmail.trim())
      setStep('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create request.')
      setStep('error')
    }
  }

  function copyUrl() {
    void navigator.clipboard.writeText(requestUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Sending ──────────────────────────────────────────────────────────────

  if (step === 'sending') {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white animate-spin mx-auto mb-4" />
          <p className="text-white font-semibold">Creating request…</p>
          <p className="text-[#A3A3A3] text-sm mt-1">Generating your payment link</p>
        </div>
      </div>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto p-6">
          <div className="bg-[#111111] border border-[#242424] rounded-xl p-6 text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-[#1a2a1a] border border-green-800/40 flex items-center justify-center mx-auto mb-4">
              <Check size={24} className="text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Request created</h2>
            <p className="text-[#A3A3A3] text-sm">
              {emailSent
                ? `A payment request has been sent to ${recipientEmail}.`
                : 'Share this link with anyone to collect payment.'}
            </p>
          </div>

          {/* Link box */}
          <div className="bg-[#0A0A0A] border border-[#242424] rounded-xl p-4 mb-4">
            <p className="text-[10px] uppercase tracking-widest text-[#A3A3A3] mb-2">Payment link</p>
            <div className="flex items-center gap-3">
              <Link2 size={14} className="text-[#A3A3A3] shrink-0" />
              <p className="text-white text-sm font-mono flex-1 truncate">{requestUrl}</p>
              <button
                onClick={copyUrl}
                className="shrink-0 flex items-center gap-1 text-xs text-[#A3A3A3] hover:text-white transition-colors"
              >
                {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Details */}
          <div className="bg-[#0A0A0A] border border-[#242424] rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[#A3A3A3] text-sm">Amount requested</span>
              <span className="text-white font-bold text-lg">${parseFloat(amount).toFixed(2)} USDC</span>
            </div>
            {recipientEmail && (
              <div className="flex justify-between items-center mb-3">
                <span className="text-[#A3A3A3] text-sm">Sent to</span>
                <span className="text-white text-sm">{recipientEmail}</span>
              </div>
            )}
            {note && (
              <div className="flex justify-between items-start">
                <span className="text-[#A3A3A3] text-sm">Note</span>
                <span className="text-white text-sm text-right max-w-[60%]">{note}</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#1A1A1A]">
              <span className="text-[#A3A3A3] text-xs">Reference</span>
              <span className="text-[#A3A3A3] text-xs font-mono">{requestId.slice(0, 8)}…</span>
            </div>
          </div>

          <button
            onClick={reset}
            className="w-full py-3 rounded-lg bg-[#111111] border border-[#242424] text-white text-sm font-medium hover:bg-[#1A1A1A] transition-colors"
          >
            Create another request
          </button>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (step === 'error') {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-[#2a1a1a] border border-red-800/40 flex items-center justify-center mx-auto mb-4">
            <ArrowRight size={22} className="text-red-400" />
          </div>
          <h3 className="text-white font-semibold mb-2">Request failed</h3>
          <p className="text-[#A3A3A3] text-sm mb-6">{errorMsg}</p>
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-lg bg-white text-[#050505] text-sm font-semibold hover:bg-[#D4D4D4] transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-white mb-1">
            Request money
          </h1>
          <p className="text-[#A3A3A3] text-sm">
            Generate a payment link or send a request directly to an email address.
          </p>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-5">
          {/* Amount */}
          <div className="bg-[#111111] border border-[#242424] rounded-xl p-5">
            <label className="block text-xs uppercase tracking-widest text-[#A3A3A3] mb-3">
              Amount (USDC)
            </label>
            <div className="relative mb-3">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A3A3A3]">
                <DollarSign size={16} />
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full bg-[#0A0A0A] border border-[#242424] rounded-lg pl-10 pr-4 py-3 text-white text-lg font-bold placeholder-[#3a3a3a] focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmount(a)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    amount === a
                      ? 'bg-white text-[#050505]'
                      : 'bg-[#1A1A1A] text-[#A3A3A3] hover:text-white border border-[#2a2a2a]'
                  }`}
                >
                  ${a}
                </button>
              ))}
            </div>
          </div>

          {/* Recipient (optional) */}
          <div className="bg-[#111111] border border-[#242424] rounded-xl p-5">
            <label className="block text-xs uppercase tracking-widest text-[#A3A3A3] mb-3">
              Send to (optional)
            </label>
            <p className="text-[#A3A3A3] text-xs mb-3">
              Leave blank to get a shareable link. Add an email to send the request directly.
            </p>
            <div className="relative">
              <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
              <input
                type="email"
                placeholder="their@email.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#242424] rounded-lg pl-10 pr-4 py-3 text-white text-sm placeholder-[#3a3a3a] focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
          </div>

          {/* Note */}
          <div className="bg-[#111111] border border-[#242424] rounded-xl p-5">
            <label className="block text-xs uppercase tracking-widest text-[#A3A3A3] mb-3">
              Note (optional)
            </label>
            <input
              type="text"
              placeholder="What's this for?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
              className="w-full bg-[#0A0A0A] border border-[#242424] rounded-lg px-4 py-3 text-white text-sm placeholder-[#3a3a3a] focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!amount || parseFloat(amount) <= 0}
            className="w-full py-3.5 rounded-xl bg-white text-[#050505] text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#D4D4D4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {recipientEmail ? (
              <>
                <Mail size={15} />
                Send request to {recipientEmail.split('@')[0]}
              </>
            ) : (
              <>
                <Link2 size={15} />
                Generate payment link
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
