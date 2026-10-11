import { HTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

type BadgeVariant = 'default' | 'success' | 'danger' | 'pending' | 'open'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  children: ReactNode
}

export function Badge({ variant = 'default', children, className, ...rest }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    default: 'bg-white/[0.08] text-[#A3A3A3] border border-[#242424]',
    success: 'bg-[#0f3d22] text-[#4ade80] border border-[#1a8047]/30',
    danger: 'bg-[#3d0f1a] text-[#f87171] border border-[#ba2b4c]/30',
    pending: 'bg-[#1c1a0f] text-[#fbbf24] border border-[#d97706]/30',
    open: 'bg-white/[0.05] text-white border border-white/10',
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold',
        variants[variant],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  )
}
