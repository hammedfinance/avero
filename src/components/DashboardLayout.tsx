import { ReactNode, useState } from 'react'
import {
  LayoutDashboard,
  ArrowUpRight,
  Link2,
  Clock,
  Wallet,
  Menu,
  X,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import { AverLogo, AverWordmark } from './ui/AverLogo'
import { clearSession, AverUser } from '../lib/auth'

export type DashView = 'overview' | 'send' | 'links' | 'transactions' | 'wallet'

interface DashboardLayoutProps {
  user: AverUser
  children: ReactNode
  activeView: DashView
  onNavigate: (v: DashView) => void
  onSignOut: () => void
}

const navItems: { id: DashView; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'send', label: 'Send money', icon: ArrowUpRight },
  { id: 'links', label: 'Payment links', icon: Link2 },
  { id: 'transactions', label: 'Transactions', icon: Clock },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
]

function NavItem({ item, active, onClick }: { item: typeof navItems[number]; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left
        ${active
          ? 'bg-white text-[#050505] font-semibold'
          : 'text-[#A3A3A3] hover:text-white hover:bg-white/[0.05]'
        }
      `}
    >
      <item.icon size={16} className="shrink-0" />
      {item.label}
      {active && <ChevronRight size={13} className="ml-auto" />}
    </button>
  )
}

interface SidebarContentProps {
  user: AverUser
  activeView: DashView
  onNavigate: (v: DashView) => void
  onSignOut: () => void
  onClose?: () => void
  mobile?: boolean
}

function SidebarContent({ user, activeView, onNavigate, onSignOut, onClose, mobile }: SidebarContentProps) {
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase()

  return (
    <aside className={`
      flex flex-col bg-[#0A0A0A] border-r border-[#1A1A1A]
      ${mobile ? 'w-full h-full p-5' : 'w-56 shrink-0 sticky top-0 h-screen p-4'}
    `}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5">
          <AverLogo size={24} />
          <AverWordmark className="text-base text-white" />
        </div>
        {mobile && onClose && (
          <button onClick={onClose} className="text-[#A3A3A3] hover:text-white">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={activeView === item.id}
            onClick={() => { onNavigate(item.id); if (mobile) onClose?.() }}
          />
        ))}
      </nav>

      <div className="pt-4 border-t border-[#1A1A1A] space-y-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-[#242424] flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user.name ?? 'User'}</p>
            <p className="text-[10px] text-[#A3A3A3] truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-[#A3A3A3] hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

export function DashboardLayout({ user, children, activeView, onNavigate, onSignOut }: DashboardLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleSignOut() {
    clearSession()
    onSignOut()
  }

  return (
    <div className="min-h-dvh bg-[#050505] flex" style={{ fontFamily: 'DM Sans, Manrope, sans-serif' }}>
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <SidebarContent
          user={user}
          activeView={activeView}
          onNavigate={onNavigate}
          onSignOut={handleSignOut}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-64 h-full">
            <SidebarContent
              user={user}
              activeView={activeView}
              onNavigate={onNavigate}
              onSignOut={handleSignOut}
              mobile
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-[#1A1A1A] bg-[#0A0A0A]">
          <button onClick={() => setMobileOpen(true)} className="text-[#A3A3A3] hover:text-white p-1">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <AverLogo size={22} />
            <AverWordmark className="text-sm text-white" />
          </div>
          <div className="w-8" />
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
