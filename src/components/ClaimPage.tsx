import { useEffect, useState } from 'react'
import { useDynamicContext } from '@dynamic-labs/sdk-react-core'

interface ClaimInfo {
  senderEmail: string
  amount: string
  note?: string
  depositId?: number
  status: string
}

export function ClaimPage({ claimKey }: { claimKey: string }) {
  const { user, setShowAuthFlow } = useDynamicContext()
  const [claimInfo, setClaimInfo] = useState<ClaimInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!claimKey) { setError('Invalid claim link.'); setLoading(false); return }
    fetch(`/api/payments/claim-info?key=${encodeURIComponent(claimKey)}`)
      .then(r => r.json())
      .then((d: { error?: string } & Partial<ClaimInfo>) => {
        if (d.error) setError(d.error)
        else setClaimInfo(d as ClaimInfo)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load claim info.'); setLoading(false) })
  }, [claimKey])

  useEffect(() => {
    if (user && claimInfo && claimInfo.status === 'PENDING_CLAIM' && !claimed && !claiming) {
      void handleClaim()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, claimInfo])

  async function handleClaim() {
    if (!claimKey || !user?.email) return
    setClaiming(true)
    setError('')
    try {
      const resp = await fetch('/api/payments/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimKey, recipientEmail: user.email }),
      })
      const data = await resp.json() as { error?: string }
      if (!resp.ok) throw new Error(data.error || 'Claim failed')
      setClaimed(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Claim failed')
    } finally {
      setClaiming(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-white font-medium mb-2">Invalid or expired link</p>
        <p className="text-white/50 text-sm mb-6">{error}</p>
        <a href="https://useavero.xyz" className="text-white/70 text-sm underline">Go to Avero</a>
      </div>
    </div>
  )

  if (claimed) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-white text-2xl font-semibold mb-2">USDC claimed!</h1>
        <p className="text-white/50 mb-6">${claimInfo?.amount} USDC is now in your Avero wallet.</p>
        <a href="https://useavero.xyz" className="bg-white text-black font-medium px-6 py-3 rounded-xl">
          View your balance →
        </a>
      </div>
    </div>
  )

  if (claimInfo?.status !== 'PENDING_CLAIM') return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-4xl mb-4">✓</div>
        <p className="text-white font-medium">This payment has already been claimed.</p>
        <a href="https://useavero.xyz" className="text-white/50 text-sm underline mt-4 block">Go to Avero</a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-white font-bold text-2xl tracking-tight">avero</span>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
          <p className="text-white/50 text-sm mb-1">You received</p>
          <p className="text-white text-4xl font-bold mb-1">${claimInfo?.amount}</p>
          <p className="text-white/50 text-sm mb-4">USDC</p>
          <p className="text-white/70 text-sm">
            From <span className="text-white font-medium">{claimInfo?.senderEmail}</span>
          </p>
          {claimInfo?.note && (
            <p className="text-white/40 text-sm mt-2 italic">"{claimInfo.note}"</p>
          )}
        </div>

        {/* CTA */}
        <div className="mt-6">
          {!user ? (
            <div className="text-center">
              <p className="text-white/50 text-sm mb-4">
                Sign in to claim your USDC — it only takes 30 seconds.
              </p>
              <button
                onClick={() => setShowAuthFlow(true)}
                className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition-colors"
              >
                Sign in to claim →
              </button>
            </div>
          ) : (
            <button
              onClick={() => { void handleClaim() }}
              disabled={claiming}
              className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {claiming ? 'Claiming...' : 'Claim your USDC →'}
            </button>
          )}
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          Powered by Avero · USDC on Arc
        </p>
      </div>
    </div>
  )
}
