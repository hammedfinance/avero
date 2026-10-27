import { useState, useEffect, useCallback } from 'react'
import { Copy, Check, ExternalLink, RefreshCw, Wallet, Zap, ArrowDownToLine } from 'lucide-react'
import { motion } from 'framer-motion'
import { useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { toast } from 'sonner'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { IntegrationBanner } from './ui/IntegrationBanner'
import { ApiError, walletApi } from '../lib/api'
import { AverUser, setSession } from '../lib/auth'
import { requireChain, buildAddressExplorerUrl } from '../onchain-facts'

interface WalletPageProps {
  user: AverUser
}

const ARC_TESTNET_ID = 5042002

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      toast.success(label ? `${label} copied` : 'Copied')
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="p-2 rounded-lg border border-[#242424] text-[#A3A3A3] hover:text-white hover:border-[#333] transition-colors"
      title="Copy"
    >
      {copied ? <Check size={14} className="text-[#4ade80]" /> : <Copy size={14} />}
    </button>
  )
}

export function WalletPage({ user }: WalletPageProps) {
  const { user: dynamicUser } = useDynamicContext()

  const dynamicAddress = (dynamicUser as {
    verifiedCredentials?: Array<{ address?: string; chain?: string }>
  } | null)?.verifiedCredentials?.find(
    (c) => c.address && c.chain !== 'solana'
  )?.address

  const [walletAddress, setWalletAddress] = useState<string | undefined>(
    user.walletAddress ?? dynamicAddress
  )
  const [walletId, setWalletId] = useState<string | undefined>(user.walletId)

  const [balance, setBalance] = useState<string | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [provisioning, setProvisioning] = useState(false)
  const [configBoundary, setConfigBoundary] = useState<{ message: string; envVars: string[] } | null>(null)

  const isDemo = user.id.startsWith('demo-')
  const arcChain = requireChain(ARC_TESTNET_ID)

  const explorerUrl = walletAddress
    ? buildAddressExplorerUrl(ARC_TESTNET_ID, walletAddress)
    : undefined

  // ── Load balance ─────────────────────────────────────────────
  const loadBalance = useCallback(async (wId?: string) => {
    const id = wId ?? walletId
    setBalanceLoading(true)
    try {
      const data = await walletApi.balance({ walletId: id, email: user.email })
      const usdcBalance = data.balance ?? data.tokenBalances?.[0]?.amount ?? null
      if (usdcBalance) setBalance(usdcBalance)
    } catch (err) {
      if (err instanceof ApiError && err.isConfigBoundary) {
        setConfigBoundary({ message: err.message, envVars: err.requiredEnv ?? [] })
      }
    } finally {
      setBalanceLoading(false)
    }
  }, [walletId, user.email])

  useEffect(() => {
    if (isDemo) return
    void loadBalance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  // ── Provision wallet ─────────────────────────────────────────
  async function provisionWallet() {
    setProvisioning(true)
    try {
      const data = await walletApi.create(user.id, user.email)
      if (data.walletId && data.address) {
        setWalletId(data.walletId)
        setWalletAddress(data.address)
        // Persist to session so other pages see it
        const enriched = { ...user, walletId: data.walletId, walletAddress: data.address }
        setSession(enriched)
        toast.success('Wallet provisioned successfully')
        await loadBalance(data.walletId)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Wallet provisioning failed')
    } finally {
      setProvisioning(false)
    }
  }

  return (
    <div className="p-5 md:p-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#A3A3A3] mb-1">Account</p>
        <h1
          className="text-3xl font-extrabold tracking-[-0.03em] text-white"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Wallet
        </h1>
        <p className="text-sm text-[#A3A3A3] mt-1">Your USDC wallet on Arc.</p>
      </div>

      <div className="space-y-4">

        {/* ── Config boundary ──────────────────────────── */}
        {configBoundary && (
          <IntegrationBanner
            title="Circle not configured"
            description={configBoundary.message}
            envVars={configBoundary.envVars}
            link="https://developers.circle.com/developer/docs/developer-account-quickstart"
            linkLabel="Circle setup guide"
          />
        )}

        {/* ── Demo mode ────────────────────────────────── */}
        {isDemo && (
          <IntegrationBanner
            title="Sign in to see your wallet"
            description="After signing in with Dynamic, a Circle USDC wallet on Arc is automatically provisioned for you."
            envVars={['VITE_DYNAMIC_ENVIRONMENT_ID', 'CIRCLE_API_KEY', 'CIRCLE_ENTITY_SECRET', 'CIRCLE_WALLET_SET_ID']}
          />
        )}

        {/* ── No wallet yet — provision ────────────────── */}
        {!isDemo && !walletAddress && !configBoundary && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card padding="lg">
              <div className="flex flex-col items-center text-center py-4 gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#0B1220] border border-white/10 flex items-center justify-center">
                  <Wallet size={20} className="text-[#A3A3A3]" />
                </div>
                <div>
                  <p className="text-base font-bold text-white mb-1">No wallet yet</p>
                  <p className="text-sm text-[#A3A3A3]">
                    Your Circle USDC wallet on Arc hasn't been provisioned yet.
                    Click below to create it now.
                  </p>
                </div>
                <Button
                  onClick={() => { void provisionWallet() }}
                  loading={provisioning}
                  leftIcon={<Zap size={14} />}
                >
                  {provisioning ? 'Creating wallet…' : 'Provision wallet'}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── Wallet card ──────────────────────────────── */}
        {!isDemo && walletAddress && (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#A3A3A3] mb-3">
              USDC wallet
            </p>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card padding="lg">
                {/* Card header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-[#0B1220] border border-white/10 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border-2 border-[#D4D4D4]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Avero wallet</p>
                    <p className="text-xs text-[#A3A3A3]">Arc · USDC</p>
                  </div>
                  <div className="ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<RefreshCw size={12} className={balanceLoading ? 'animate-spin' : ''} />}
                      onClick={() => { void loadBalance() }}
                      disabled={balanceLoading}
                    >
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Balance */}
                <div className="rounded-xl bg-[#0A0A0A] border border-[#1A1A1A] px-4 py-4 mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3] mb-1">
                    USDC Balance
                  </p>
                  {balanceLoading ? (
                    <div className="h-10 w-36 bg-[#1A1A1A] rounded animate-pulse" />
                  ) : (
                    <div className="flex items-baseline gap-2">
                      <p
                        className="text-4xl font-extrabold text-white tabular-nums"
                        style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}
                      >
                        {balance !== null ? parseFloat(balance).toFixed(2) : '0.00'}
                      </p>
                      <span className="text-sm text-[#A3A3A3]">USDC</span>
                    </div>
                  )}
                </div>

                {/* Address */}
                <div className="rounded-xl bg-[#0A0A0A] border border-[#1A1A1A] px-4 py-3 mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3] mb-1">
                    Deposit address
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-xs font-mono text-[#D4D4D4] truncate">
                      {walletAddress}
                    </p>
                    <CopyButton text={walletAddress} label="Address" />
                    {explorerUrl && (
                      <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg border border-[#242424] text-[#A3A3A3] hover:text-white hover:border-[#333] transition-colors"
                        title="View on Arc explorer"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  <p className="text-[10px] text-[#A3A3A3] mt-2">
                    Send Arc USDC to this address to fund your Avero wallet.
                  </p>
                </div>

              </Card>
            </motion.div>
          </div>
        )}

        {/* ── Deposit / faucet ─────────────────────────── */}
        {!isDemo && walletAddress && (
          <Card padding="md" className="border-dashed">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#0B1220] border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ArrowDownToLine size={14} className="text-[#A3A3A3]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white mb-1">Fund your wallet with USDC</p>
                <p className="text-xs text-[#A3A3A3] mb-3">
                  Two ways to get Arc USDC for testing:
                </p>
                <div className="space-y-2 mb-4">
                  <div className="rounded-lg bg-[#0A0A0A] border border-[#1A1A1A] px-3 py-2.5">
                    <p className="text-xs font-semibold text-white mb-0.5">Option 1 — Arc Studio sidebar</p>
                    <p className="text-xs text-[#A3A3A3]">
                      Click <span className="text-white font-mono">"Get test USDC"</span> in the Arc Studio sidebar (left panel). Connect your wallet, get free USDC instantly, then send it to the deposit address above.
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#0A0A0A] border border-[#1A1A1A] px-3 py-2.5">
                    <p className="text-xs font-semibold text-white mb-0.5">Option 2 — Circle faucet</p>
                    <p className="text-xs text-[#A3A3A3] mb-2">
                      Request directly from Circle's faucet. Paste your deposit address above when prompted.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<ExternalLink size={12} />}
                      onClick={() => window.open('https://faucet.circle.com', '_blank')}
                    >
                      Open Circle faucet
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg bg-[#0A0A0A] border border-[#1A1A1A] px-3 py-2 flex items-center gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3]">Your address</p>
                  <p className="flex-1 text-xs font-mono text-[#D4D4D4] truncate">{walletAddress}</p>
                  <CopyButton text={walletAddress} label="Address" />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ── Network info ─────────────────────────────── */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#A3A3A3] mb-3">Network</p>
          <Card padding="md">
            <div className="space-y-3">
              {[
                { label: 'Network', value: arcChain.name },
                { label: 'Chain ID', value: String(arcChain.chainId) },
                { label: 'Native asset', value: 'USDC' },
                { label: 'Explorer', value: arcChain.explorerBase },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between py-1.5 border-b border-[#111111] last:border-0"
                >
                  <span className="text-xs text-[#A3A3A3]">{row.label}</span>
                  <span className="text-xs font-semibold text-white font-mono truncate max-w-[55%] text-right">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}
