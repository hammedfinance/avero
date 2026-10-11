import { HTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  hover?: boolean
  active?: boolean
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

export function Card({ children, hover, active, padding = 'md', className, ...rest }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  }

  return (
    <div
      className={clsx(
        'rounded-2xl border border-[#242424] bg-[#111111]',
        paddings[padding],
        hover && 'transition-colors duration-150 hover:border-[#333] hover:bg-[#171717] cursor-pointer',
        active && 'border-white/20 bg-[#171717]',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export function SurfaceCard({ children, className, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={clsx('rounded-xl bg-[#171717] border border-[#1A1A1A]', className)}
      {...rest}
    >
      {children}
    </div>
  )
}
