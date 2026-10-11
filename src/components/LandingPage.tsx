import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Mail,
  Zap,
  Link2,
  Receipt,
  Code2,
  Github,
  ChevronRight,
} from 'lucide-react'
import { AverLogo, AverWordmark } from './ui/AverLogo'
import { Button } from './ui/Button'

interface LandingPageProps {
  onGetStarted: () => void
}

const fade = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] } }),
}

const features = [
  {
    icon: Mail,
    title: 'Email-first payments',
    body: 'Send USDC to any registered email address. No wallet addresses, no blockchain jargon — just a name and a number.',
  },
  {
    icon: Zap,
    title: 'Invisible payment rails',
    body: 'Circle developer wallets and ARC-TESTNET settlement run quietly behind every transaction. Users see names and amounts.',
  },
  {
    icon: Receipt,
    title: 'Real-time receipts',
    body: 'Every send and receive generates a timestamped receipt with status tracking, available in your transaction history.',
  },
  {
    icon: Link2,
    title: 'Payment links',
    body: 'Create a shareable link for any amount. Send it by email, message, or embed it in an invoice.',
  },
]

const howItWorks = [
  { step: '01', title: 'Create your account', body: 'Sign up with your email. A Circle USDC wallet is provisioned for you automatically in the background.' },
  { step: '02', title: 'Fund your wallet', body: 'Add USDC to your Avero wallet on Arc Testnet. No ETH needed — USDC is the native gas token.' },
  { step: '03', title: 'Send to any email', body: 'Type a recipient email and an amount. Avero resolves the wallet address and executes the transfer.' },
  { step: '04', title: 'Track everything', body: 'Every payment appears in your transaction history with status, timestamp, and a copy of the receipt.' },
]

// Product preview card
function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-8 rounded-[2.5rem] bg-white/[0.03] blur-3xl pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
        className="relative rounded-2xl border border-[#242424] bg-[#111111] p-5 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#A3A3A3]">Send money</p>
            <p className="text-sm font-semibold text-white mt-0.5">New payment</p>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[#1a8047]/30 bg-[#0f3d22] text-[10px] font-bold text-[#4ade80]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
            Arc Testnet
          </span>
        </div>

        {/* Amount */}
        <div className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] px-4 py-4 mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3] mb-1">Amount</p>
          <p
            className="text-5xl font-bold text-white tabular-nums"
            style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}
          >
            50.<span className="text-[#A3A3A3]">00</span>
          </p>
          <p className="text-xs font-semibold text-[#A3A3A3] mt-1">USDC</p>
        </div>

        {/* Recipient row */}
        <div className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] px-4 py-3 mb-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#242424] flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">A</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">alex@studio.io</p>
            <p className="text-[10px] text-[#A3A3A3]">Avero user</p>
          </div>
          <span className="text-[10px] font-bold text-[#4ade80] bg-[#0f3d22] rounded-full px-2 py-0.5">Found</span>
        </div>

        {/* Note */}
        <div className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] px-4 py-3 mb-4">
          <p className="text-xs text-[#A3A3A3]">Project milestone — Phase 1</p>
        </div>

        {/* CTA */}
        <button className="w-full h-11 rounded-xl bg-white text-[#050505] text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#D4D4D4] transition-colors">
          Send 50.00 USDC
          <ArrowRight size={15} />
        </button>

        {/* Rail info */}
        <p className="text-center text-[10px] text-[#A3A3A3] mt-3">
          Powered by Circle + Arc Testnet
        </p>
      </motion.div>
    </div>
  )
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <div className="min-h-dvh bg-[#050505] text-white" style={{ fontFamily: 'DM Sans, Manrope, sans-serif' }}>
      {/* ── Nav ── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'border-b border-[#1A1A1A] bg-[#050505]/90 backdrop-blur-xl' : ''}`}>
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AverLogo size={26} />
            <AverWordmark className="text-lg text-white" />
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {['Product', 'How it works', 'Developers'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-sm text-[#A3A3A3] hover:text-white transition-colors"
              >
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onGetStarted}>
              Sign in
            </Button>
            <Button size="sm" onClick={onGetStarted}>
              Get started
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-20 px-5 overflow-hidden">
        {/* Subtle atmospheric gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(255,255,255,0.04),transparent)] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-40 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.div
                initial="hidden"
                animate="show"
                variants={{ show: { transition: { staggerChildren: 0.07 } } }}
              >
                <motion.div variants={fade} custom={0}>
                  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#242424] bg-[#111111] text-xs font-semibold text-[#A3A3A3] mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                    Arc Testnet · USDC
                  </span>
                </motion.div>

                <motion.h1
                  variants={fade}
                  custom={1}
                  className="text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-[0.96] tracking-[-0.04em] text-white"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  Send money with an email address.
                </motion.h1>

                <motion.p variants={fade} custom={2} className="mt-6 text-lg text-[#A3A3A3] leading-relaxed max-w-lg">
                  Avero is an email-first USDC payments platform. Send, receive, and track payments — no wallet addresses, no crypto complexity.
                </motion.p>

                <motion.div variants={fade} custom={3} className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Button size="lg" onClick={onGetStarted} rightIcon={<ArrowRight size={16} />}>
                    Start for free
                  </Button>
                  <Button variant="secondary" size="lg" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
                    Explore how it works
                  </Button>
                </motion.div>

                <motion.p variants={fade} custom={4} className="mt-5 text-xs text-[#A3A3A3]">
                  Built on Circle USDC infrastructure · Arc Testnet · No crypto knowledge required
                </motion.p>
              </motion.div>
            </div>

            <ProductPreview />
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-y border-[#1A1A1A] bg-[#0A0A0A] py-8 px-5">
        <div className="max-w-6xl mx-auto grid grid-cols-3 gap-8 divide-x divide-[#1A1A1A]">
          {[
            ['USDC', 'Native currency'],
            ['Email', 'Recipient handle'],
            ['Arc Testnet', 'Settlement layer'],
          ].map(([value, label]) => (
            <div key={label} className="px-4 first:pl-0 last:pr-0">
              <p className="text-xl font-bold text-white tabular-nums" style={{ fontFamily: 'Manrope, sans-serif' }}>{value}</p>
              <p className="text-xs text-[#A3A3A3] mt-1 font-medium">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="product" className="py-24 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-xl mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#A3A3A3] mb-3">Product</p>
            <h2
              className="text-4xl lg:text-5xl font-extrabold tracking-[-0.04em] text-white leading-[1.05]"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Move money intelligently.
            </h2>
            <p className="mt-4 text-[#A3A3A3] leading-relaxed">
              Avero abstracts Circle's payment infrastructure into a clean, email-native experience. No wallet management for your users.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl border border-[#242424] bg-[#111111] p-5"
              >
                <div className="w-9 h-9 rounded-xl bg-[#171717] border border-[#242424] flex items-center justify-center mb-4">
                  <f.icon size={16} className="text-[#D4D4D4]" />
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{f.title}</h3>
                <p className="text-xs text-[#A3A3A3] leading-relaxed">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-24 px-5 bg-[#0A0A0A] border-y border-[#1A1A1A]">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-xl mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#A3A3A3] mb-3">How it works</p>
            <h2
              className="text-4xl lg:text-5xl font-extrabold tracking-[-0.04em] text-white leading-[1.05]"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              From email to USDC in seconds.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
              >
                <p
                  className="text-4xl font-extrabold text-[#1A1A1A] mb-4 tabular-nums"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  {item.step}
                </p>
                <h3 className="text-sm font-bold text-white mb-2">{item.title}</h3>
                <p className="text-xs text-[#A3A3A3] leading-relaxed">{item.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Payment links showcase ── */}
      <section className="py-24 px-5">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#A3A3A3] mb-3">Payment links</p>
            <h2
              className="text-4xl font-extrabold tracking-[-0.04em] text-white leading-[1.05] mb-5"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Create a link. Share it anywhere.
            </h2>
            <p className="text-[#A3A3A3] leading-relaxed mb-6">
              Generate a payment request in seconds. Anyone with the link can pay you directly in USDC — no Avero account needed to send.
            </p>
            <ul className="space-y-3">
              {['Set any USDC amount', 'Custom title and memo', 'Shareable via email or message', 'Real-time payment status'].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-[#D4D4D4]">
                  <ChevronRight size={14} className="text-[#A3A3A3] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Payment link card mockup */}
          <div className="rounded-2xl border border-[#242424] bg-[#111111] p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <AverLogo size={22} />
                <AverWordmark className="text-sm text-white" />
              </div>
              <span className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-wider">Payment request</span>
            </div>
            <div className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] p-5 mb-3">
              <p className="text-xs text-[#A3A3A3] mb-1">Freelance project · Phase 2 delivery</p>
              <p
                className="text-5xl font-extrabold text-white tabular-nums"
                style={{ fontFamily: 'Manrope, sans-serif', letterSpacing: '-0.04em' }}
              >
                120<span className="text-2xl text-[#A3A3A3]">.00</span>
              </p>
              <p className="text-xs text-[#A3A3A3] mt-1">USDC</p>
            </div>
            <div className="rounded-xl border border-[#1A1A1A] bg-[#0A0A0A] px-4 py-3 mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#A3A3A3] mb-1">Payment link</p>
              <p className="text-xs font-mono text-[#D4D4D4] break-all">avero.app/pay/freelance-phase2-120</p>
            </div>
            <button className="w-full h-10 rounded-xl bg-white text-[#050505] text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#D4D4D4] transition-colors">
              Pay 120.00 USDC
            </button>
          </div>
        </div>
      </section>

      {/* ── Developers ── */}
      <section id="developers" className="py-24 px-5 bg-[#0A0A0A] border-y border-[#1A1A1A]">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* Code block */}
          <div className="rounded-2xl border border-[#242424] bg-[#0A0A0A] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1A1A1A]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#242424]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#242424]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#242424]" />
              <span className="ml-2 text-[10px] font-mono text-[#A3A3A3]">POST /api/wallet/send</span>
            </div>
            <pre className="p-5 text-xs font-mono text-[#D4D4D4] overflow-x-auto leading-relaxed">
              <code>{`{
  "senderEmail": "you@company.com",
  "recipientEmail": "client@studio.io",
  "amount": "50.00",
  "message": "Invoice #1042"
}

// Response
{
  "success": true,
  "transactionId": "txn_abc123",
  "status": "pending"
}`}
              </code>
            </pre>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#A3A3A3] mb-3">Developers</p>
            <h2
              className="text-4xl font-extrabold tracking-[-0.04em] text-white leading-[1.05] mb-5"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Simple API. Real infrastructure.
            </h2>
            <p className="text-[#A3A3A3] leading-relaxed mb-6">
              Avero's backend exposes clean REST endpoints backed by Circle developer-controlled wallets and Supabase. Connect your services to email-first USDC payments without building the plumbing yourself.
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              {['Circle Wallets', 'Supabase', 'Arc Testnet', 'USDC', 'REST API'].map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full border border-[#242424] text-xs font-semibold text-[#A3A3A3]">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" leftIcon={<Github size={14} />} onClick={() => window.open('https://github.com/hammedfinance/arclink', '_blank')}>
                View reference repo
              </Button>
              <Button variant="ghost" size="sm" leftIcon={<Code2 size={14} />} onClick={() => window.open('https://developers.circle.com', '_blank')}>
                Circle docs
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-32 px-5 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center mx-auto mb-8">
            <AverLogo size={28} />
          </div>
          <h2
            className="text-5xl font-extrabold tracking-[-0.04em] text-white mb-5"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Ready to move money intelligently?
          </h2>
          <p className="text-[#A3A3A3] mb-8 leading-relaxed">
            Create your Avero account. A USDC wallet is provisioned automatically — no crypto setup, no fees to get started.
          </p>
          <Button size="lg" onClick={onGetStarted} rightIcon={<ArrowRight size={16} />}>
            Create free account
          </Button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#1A1A1A] py-8 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AverLogo size={20} />
            <AverWordmark className="text-sm text-[#A3A3A3]" />
          </div>
          <p className="text-xs text-[#A3A3A3]">
            Built on Circle USDC + Arc Testnet. For development use only.
          </p>
          <p className="text-xs text-[#A3A3A3]">
            &copy; 2026 Avero
          </p>
        </div>
      </footer>
    </div>
  )
}
