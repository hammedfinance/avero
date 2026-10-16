import { useState, useRef } from 'react'
import { X, Plus, Send, Check, AlertCircle, ChevronDown, ChevronUp, ExternalLink, DollarSign } from 'lucide-react'
import { AverUser } from '../lib/auth'
import { walletApi } from '../lib/api'

interface BulkSendPageProps {
  user: AverUser
}

interface Recipient {
  id: string
  email: string
  error?: string
}

interface SendResult {
  email: string
  status: 'success' | 'failed'
  transactionId?: string
  circleTransactionId?: string
  explorerUrl?: string
  error?: string
}

type Step = 'form' | 'review' | 'sending' | 'results'

const MAX_RECIPIENTS = 10

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function BulkSendPage({ user }: BulkSendPageProps) {
  const [step, setStep] = useState<Step>('form')
  const [recipients, setRecipients] = useState<Recipient[]>([
    { id: crypto.randomUUID(), email: '' },
  ])
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [results, setResults] = useState<SendResult[]>([])
  const [progress, setProgress] = useState(0)
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())
  const pasteRef = useRef<HTMLTextAreaElement>(null)
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')

  function addRecipient() {
    if (recipients.length >= MAX_RECIPIENTS) return
    setRecipients((prev) => [...prev, { id: crypto.randomUUID(), email: '' }])
  }

  function removeRecipient(id: string) {
    setRecipients((prev) => prev.filter((r) => r.id !== id))
  }

  function updateRecipient(id: string, email: string) {
    setRecipients((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, email, error: email && !isValidEmail(email) ? 'Invalid email' : undefined }
          : r
      )
    )
  }

  function handlePasteEmails() {
    const emails = pasteText
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter(Boolean)
      .slice(0, MAX_RECIPIENTS)

    const newRecipients: Recipient[] = emails.map((email) => ({
      id: crypto.randomUUID(),
      email,
      error: !isValidEmail(email) ? 'Invalid email' : undefined,
    }))
    setRecipients(newRecipients.length > 0 ? newRecipients : [{ id: crypto.randomUUID(), email: '' }])
    setPasteText('')
    setShowPaste(false)
  }

  const validRecipients = recipients.filter((r) => r.email && isValidEmail(r.email))
  const uniqueEmails = [...new Set(validRecipients.map((r) => r.email.toLowerCase()))]
  const selfIncluded = uniqueEmails.includes(user.email.toLowerCase())
  const totalAmount = uniqueEmails.length * parseFloat(amount || '0')
  const canProceed = uniqueEmails.length > 0 && parseFloat(amount || '0') > 0 && !selfIncluded

  async function handleSend() {
    setStep('sending')
    setProgress(0)
    const sendResults: SendResult[] = []

    for (let i = 0; i < uniqueEmails.length; i++) {
      const email = uniqueEmails[i]
      try {
        const result = await walletApi.send({
          senderEmail: user.email,
          recipientEmail: email,
          amount,
          walletId: user.walletId ?? '',
          message: note.trim() || undefined,
        })
        sendResults.push({
          email,
          status: 'success',
          transactionId: result.transactionId,
          circleTransactionId: result.circleTransactionId,
        })
      } catch (err) {
        sendResults.push({
          email,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Send failed',
        })
      }
      setProgress(Math.round(((i + 1) / uniqueEmails.length) * 100))
    }

    setResults(sendResults)
    setStep('results')
  }

  function toggleExpand(email: string) {
    setExpandedResults((prev) => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
  }

  function reset() {
    setStep('form')
    setRecipients([{ id: crypto.randomUUID(), email: '' }])
    setAmount('')
    setNote('')
    setResults([])
    setProgress(0)
    setPasteText('')
    setShowPaste(false)
  }

  // ── Sending ──────────────────────────────────────────────────────────────

  if (step === 'sending') {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm w-full">
          <div className="w-14 h-14 rounded-full border-2 border-white/20 border-t-white animate-spin mx-auto mb-6" />
          <p className="text-white font-bold text-lg mb-1">Sending payments…</p>
          <p className="text-[#A3A3A3] text-sm mb-6">
            {progress < 100
              ? `Sending to ${Math.ceil((progress / 100) * uniqueEmails.length)} of ${uniqueEmails.length} recipients`
              : 'Finalising…'}
          </p>
          <div className="w-full bg-[#1A1A1A] rounded-full h-1.5">
            <div
              className="bg-white h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[#A3A3A3] text-xs mt-2">{progress}%</p>
        </div>
      </div>
    )
  }

  // ── Results ──────────────────────────────────────────────────────────────

  if (step === 'results') {
    const successCount = results.filter((r) => r.status === 'success').length
    const failCount = results.filter((r) => r.status === 'failed').length
    const totalSent = successCount * parseFloat(amount)

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto p-6">
          {/* Summary */}
          <div className="bg-[#111111] border border-[#242424] rounded-xl p-5 mb-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#1a2a1a] border border-green-800/40 flex items-center justify-center">
                <Check size={18} className="text-green-400" />
              </div>
              <div>
                <p className="text-white font-bold">Bulk send complete</p>
                <p className="text-[#A3A3A3] text-xs">
                  {successCount} succeeded · {failCount} failed
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0A0A0A] rounded-lg p-3 text-center">
                <p className="text-white font-bold text-lg">{successCount}</p>
                <p className="text-[#A3A3A3] text-xs">Sent</p>
              </div>
              <div className="bg-[#0A0A0A] rounded-lg p-3 text-center">
                <p className="text-red-400 font-bold text-lg">{failCount}</p>
                <p className="text-[#A3A3A3] text-xs">Failed</p>
              </div>
              <div className="bg-[#0A0A0A] rounded-lg p-3 text-center">
                <p className="text-white font-bold text-lg">${totalSent.toFixed(2)}</p>
                <p className="text-[#A3A3A3] text-xs">USDC sent</p>
              </div>
            </div>
          </div>

          {/* Per-recipient results */}
          <div className="space-y-2 mb-5">
            {results.map((r) => (
              <div
                key={r.email}
                className="bg-[#111111] border border-[#242424] rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand(r.email)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1A1A1A] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      r.status === 'success'
                        ? 'bg-green-900/40 border border-green-800/40'
                        : 'bg-red-900/40 border border-red-800/40'
                    }`}>
                      {r.status === 'success'
                        ? <Check size={12} className="text-green-400" />
                        : <AlertCircle size={12} className="text-red-400" />
                      }
                    </div>
                    <span className="text-white text-sm">{r.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#A3A3A3] text-xs">
                      {r.status === 'success' ? `$${parseFloat(amount).toFixed(2)}` : 'Failed'}
                    </span>
                    {expandedResults.has(r.email)
                      ? <ChevronUp size={14} className="text-[#A3A3A3]" />
                      : <ChevronDown size={14} className="text-[#A3A3A3]" />
                    }
                  </div>
                </button>

                {expandedResults.has(r.email) && (
                  <div className="px-4 pb-3 border-t border-[#1A1A1A]">
                    {r.status === 'success' ? (
                      <div className="pt-3 space-y-2">
                        {r.transactionId && (
                          <div className="flex justify-between">
                            <span className="text-[#A3A3A3] text-xs">Reference</span>
                            <span className="text-white text-xs font-mono">{r.transactionId.slice(0, 8)}…</span>
                          </div>
                        )}
                        {r.circleTransactionId && (
                          <div className="flex justify-between">
                            <span className="text-[#A3A3A3] text-xs">Circle ID</span>
                            <span className="text-white text-xs font-mono">{r.circleTransactionId.slice(0, 8)}…</span>
                          </div>
                        )}
                        {r.explorerUrl && (
                          <a
                            href={r.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-[#A3A3A3] hover:text-white mt-1"
                          >
                            <ExternalLink size={11} />
                            View on Arc
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="pt-3">
                        <p className="text-red-400 text-xs">{r.error}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={reset}
            className="w-full py-3 rounded-xl bg-[#111111] border border-[#242424] text-white text-sm font-medium hover:bg-[#1A1A1A] transition-colors"
          >
            Send another batch
          </button>
        </div>
      </div>
    )
  }

  // ── Review ───────────────────────────────────────────────────────────────

  if (step === 'review') {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto p-6">
          <div className="mb-5">
            <button
              onClick={() => setStep('form')}
              className="text-[#A3A3A3] hover:text-white text-sm transition-colors"
            >
              ← Back to edit
            </button>
          </div>

          <div className="bg-[#111111] border border-[#242424] rounded-xl p-5 mb-4">
            <h2 className="text-white font-bold text-lg mb-4">Review bulk send</h2>
            <div className="space-y-3 mb-4">
              <div className="flex justify-between">
                <span className="text-[#A3A3A3] text-sm">Amount per recipient</span>
                <span className="text-white font-semibold">${parseFloat(amount).toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A3A3A3] text-sm">Recipients</span>
                <span className="text-white font-semibold">{uniqueEmails.length}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-[#1A1A1A]">
                <span className="text-[#A3A3A3] text-sm font-semibold">Total</span>
                <span className="text-white font-bold text-lg">${totalAmount.toFixed(2)} USDC</span>
              </div>
            </div>
            {note && (
              <div className="bg-[#0A0A0A] rounded-lg p-3">
                <p className="text-[#A3A3A3] text-xs mb-1">Note</p>
                <p className="text-white text-sm">{note}</p>
              </div>
            )}
          </div>

          {/* Recipient list */}
          <div className="bg-[#111111] border border-[#242424] rounded-xl p-4 mb-5">
            <p className="text-xs uppercase tracking-widest text-[#A3A3A3] mb-3">Recipients</p>
            <div className="space-y-2">
              {uniqueEmails.map((email) => (
                <div key={email} className="flex items-center justify-between py-1.5">
                  <span className="text-white text-sm">{email}</span>
                  <span className="text-[#A3A3A3] text-xs">${parseFloat(amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => { void handleSend() }}
            className="w-full py-3.5 rounded-xl bg-white text-[#050505] text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#D4D4D4] transition-colors"
          >
            <Send size={15} />
            Confirm — send ${totalAmount.toFixed(2)} USDC
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
            Bulk send
          </h1>
          <p className="text-[#A3A3A3] text-sm">
            Send the same USDC amount to up to {MAX_RECIPIENTS} recipients at once.
          </p>
        </div>

        <div className="space-y-5">
          {/* Amount */}
          <div className="bg-[#111111] border border-[#242424] rounded-xl p-5">
            <label className="block text-xs uppercase tracking-widest text-[#A3A3A3] mb-3">
              Amount per recipient (USDC)
            </label>
            <div className="relative mb-3">
              <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#242424] rounded-lg pl-10 pr-4 py-3 text-white text-lg font-bold placeholder-[#3a3a3a] focus:outline-none focus:border-white/30 transition-colors"
              />
            </div>
            {amount && uniqueEmails.length > 0 && (
              <p className="text-[#A3A3A3] text-xs">
                Total: <span className="text-white font-medium">${(parseFloat(amount) * uniqueEmails.length).toFixed(2)} USDC</span> to {uniqueEmails.length} recipient{uniqueEmails.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Recipients */}
          <div className="bg-[#111111] border border-[#242424] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs uppercase tracking-widest text-[#A3A3A3]">
                Recipients ({validRecipients.length}/{MAX_RECIPIENTS})
              </label>
              <button
                type="button"
                onClick={() => setShowPaste(!showPaste)}
                className="text-xs text-[#A3A3A3] hover:text-white transition-colors"
              >
                Paste multiple
              </button>
            </div>

            {showPaste && (
              <div className="mb-4 bg-[#0A0A0A] border border-[#242424] rounded-lg p-3">
                <p className="text-[#A3A3A3] text-xs mb-2">
                  Paste emails separated by commas, semicolons, or new lines:
                </p>
                <textarea
                  ref={pasteRef}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="email1@example.com, email2@example.com"
                  rows={3}
                  className="w-full bg-[#111111] border border-[#242424] rounded-lg px-3 py-2 text-white text-sm placeholder-[#3a3a3a] focus:outline-none resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handlePasteEmails}
                    className="text-xs px-3 py-1.5 bg-white text-[#050505] rounded-lg font-medium hover:bg-[#D4D4D4] transition-colors"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowPaste(false); setPasteText('') }}
                    className="text-xs px-3 py-1.5 bg-[#1A1A1A] text-[#A3A3A3] rounded-lg hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {recipients.map((r, idx) => (
                <div key={r.id} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="email"
                      placeholder={`Recipient ${idx + 1} email`}
                      value={r.email}
                      onChange={(e) => updateRecipient(r.id, e.target.value)}
                      className={`w-full bg-[#0A0A0A] border rounded-lg px-4 py-2.5 text-white text-sm placeholder-[#3a3a3a] focus:outline-none transition-colors ${
                        r.error ? 'border-red-800/60 focus:border-red-600' : 'border-[#242424] focus:border-white/30'
                      }`}
                    />
                    {r.error && (
                      <p className="text-red-400 text-xs mt-0.5">{r.error}</p>
                    )}
                  </div>
                  {recipients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRecipient(r.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#1A1A1A] text-[#A3A3A3] hover:text-white hover:bg-[#242424] transition-colors shrink-0"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {recipients.length < MAX_RECIPIENTS && (
              <button
                type="button"
                onClick={addRecipient}
                className="mt-3 flex items-center gap-1.5 text-xs text-[#A3A3A3] hover:text-white transition-colors"
              >
                <Plus size={13} />
                Add recipient
              </button>
            )}

            {selfIncluded && (
              <p className="text-red-400 text-xs mt-3 flex items-center gap-1">
                <AlertCircle size={12} />
                You cannot send to your own email address.
              </p>
            )}
          </div>

          {/* Note */}
          <div className="bg-[#111111] border border-[#242424] rounded-xl p-5">
            <label className="block text-xs uppercase tracking-widest text-[#A3A3A3] mb-3">
              Note (optional — sent to all recipients)
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

          {/* Continue */}
          <button
            type="button"
            disabled={!canProceed}
            onClick={() => setStep('review')}
            className="w-full py-3.5 rounded-xl bg-white text-[#050505] text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#D4D4D4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={15} />
            Review & send to {uniqueEmails.length} recipient{uniqueEmails.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
