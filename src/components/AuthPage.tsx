import { useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import { useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { AverLogo, AverWordmark } from './ui/AverLogo'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { IntegrationBanner } from './ui/IntegrationBanner'
import { setSession } from '../lib/auth'

interface AuthPageProps {
  onBack: () => void
  onAuthenticated: (user: { id: string; email: string; name?: string }) => void
}

const DYNAMIC_CONFIGURED = !!(
  import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID &&
  import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID !== '00000000-0000-0000-0000-000000000000'
)

export function AuthPage({ onBack, onAuthenticated }: AuthPageProps) {
  const { setShowAuthFlow } = useDynamicContext()
  const [demoEmail, setDemoEmail] = useState('')
  const [demoName, setDemoName] = useState('')
  const [loading, setLoading] = useState(false)

  // Open Dynamic's email login modal
  function handleDynamicLogin() {
    setLoading(true)
    try {
      setShowAuthFlow(true)
    } finally {
      setLoading(false)
    }
  }

  // Demo bypass — no credentials required
  function handleDemo() {
    const email = demoEmail.trim() || 'demo@avero.app'
    const name = demoName.trim() || email.split('@')[0]
    const demoUser = { id: 'demo-' + Date.now(), email, name }
    setSession(demoUser)
    onAuthenticated(demoUser)
  }

  return (
    <div
      className="min-h-dvh bg-[#050505] flex flex-col"
      style={{ fontFamily: 'DM Sans, Manrope, sans-serif' }}
    >
      {/* Nav */}
      <header className="px-5 h-14 flex items-center justify-between border-b border-[#111111]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[#A3A3A3] hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="flex items-center gap-2">
          <AverLogo size={22} />
          <AverWordmark className="text-base text-white" />
        </div>
        <div className="w-16" />
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          {/* Title */}
          <div className="mb-8 text-center">
            <h1
              className="text-3xl font-extrabold tracking-[-0.04em] text-white mb-2"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Welcome to Avero.
            </h1>
            <p className="text-sm text-[#A3A3A3]">
              Sign in with your email to access email-first USDC payments.
            </p>
          </div>

          {DYNAMIC_CONFIGURED ? (
            <>
              {/* Dynamic sign-in */}
              <Button
                fullWidth
                size="lg"
                leftIcon={<Mail size={16} />}
                loading={loading}
                onClick={handleDynamicLogin}
              >
                Continue with email
              </Button>
              <p className="text-[11px] text-[#A3A3A3] text-center mt-3 leading-relaxed">
                A magic link or one-time code will be sent to your inbox. No password needed.
              </p>

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-[#1A1A1A]" />
                <span className="text-[11px] text-[#A3A3A3]">or</span>
                <div className="flex-1 h-px bg-[#1A1A1A]" />
              </div>

              {/* Demo mode */}
              <Button variant="secondary" fullWidth size="md" onClick={handleDemo}>
                Continue in demo mode
              </Button>
              <p className="text-[10px] text-[#A3A3A3] text-center mt-2">
                Demo mode uses local state only. No real transactions.
              </p>
            </>
          ) : (
            <>
              {/* Dynamic not configured yet */}
              <div className="mb-5">
                <IntegrationBanner
                  title="Dynamic.xyz not configured"
                  description="Add your Dynamic environment ID to enable email login with embedded wallets."
                  envVars={['VITE_DYNAMIC_ENVIRONMENT_ID']}
                  link="https://docs.dynamic.xyz/introduction/welcome"
                  linkLabel="Dynamic docs"
                />
              </div>

              <p className="text-xs text-[#A3A3A3] text-center mb-4">
                You can still explore the app in demo mode:
              </p>

              <div className="space-y-3 mb-4">
                <Input
                  label="Email (optional)"
                  type="email"
                  placeholder="you@example.com"
                  value={demoEmail}
                  onChange={(e) => setDemoEmail(e.target.value)}
                  prefix={<Mail size={15} />}
                />
                <Input
                  label="Name (optional)"
                  type="text"
                  placeholder="Your name"
                  value={demoName}
                  onChange={(e) => setDemoName(e.target.value)}
                />
              </div>

              <Button variant="secondary" fullWidth size="lg" onClick={handleDemo}>
                Continue in demo mode
              </Button>
              <p className="text-[10px] text-[#A3A3A3] text-center mt-2">
                Demo mode uses local state only. No real transactions.
              </p>
            </>
          )}

          {/* Legal */}
          <p className="text-[10px] text-[#A3A3A3] text-center mt-8 leading-relaxed">
            This is a testnet application. No real funds. Built on Circle infrastructure.
          </p>
        </div>
      </div>
    </div>
  )
}
