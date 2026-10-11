import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, leftIcon, rightIcon, fullWidth, className, children, disabled, ...rest }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 select-none cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30'

    const variants: Record<Variant, string> = {
      primary: 'bg-white text-[#050505] hover:bg-[#D4D4D4] active:scale-[0.98] disabled:bg-[#242424] disabled:text-[#A3A3A3]',
      secondary: 'bg-[#111111] text-[#D4D4D4] border border-[#242424] hover:bg-[#171717] hover:border-[#333] active:scale-[0.98] disabled:opacity-40',
      ghost: 'bg-transparent text-[#A3A3A3] hover:text-white hover:bg-white/[0.05] active:scale-[0.98] disabled:opacity-40',
      danger: 'bg-[#3d0f1a] text-[#f87171] border border-[#ba2b4c]/30 hover:bg-[#ba2b4c]/20 active:scale-[0.98] disabled:opacity-40',
    }

    const sizes: Record<Size, string> = {
      sm: 'h-8 px-3 text-sm rounded-lg',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
        {...rest}
      >
        {loading ? (
          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'
