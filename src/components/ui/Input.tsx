import { forwardRef, InputHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

interface InputBaseProps {
  label?: string
  error?: string
  hint?: string
  prefix?: ReactNode
  suffix?: ReactNode
}

// Omit 'prefix' from InputHTMLAttributes since we're redefining it
type InputProps = InputBaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'>

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, prefix, suffix, className, id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-[#A3A3A3]">
            {label}
          </label>
        )}
        <div className={clsx(
          'flex items-center gap-2 rounded-xl border bg-[#0A0A0A] px-3 h-11 transition-colors',
          error
            ? 'border-[#ba2b4c]/60 focus-within:border-[#ba2b4c]'
            : 'border-[#242424] focus-within:border-[#333]',
        )}>
          {prefix && <span className="text-[#A3A3A3] shrink-0">{prefix}</span>}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'flex-1 bg-transparent text-sm text-white placeholder-[#525252] outline-none min-w-0',
              className,
            )}
            {...rest}
          />
          {suffix && <span className="text-[#A3A3A3] shrink-0">{suffix}</span>}
        </div>
        {error && <p className="text-xs text-[#f87171]">{error}</p>}
        {hint && !error && <p className="text-xs text-[#A3A3A3]">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

// Dedicated amount input with USDC currency label
interface AmountInputProps extends InputBaseProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  disabled?: boolean
}

export function AmountInput({ label = 'Amount', error, hint, value, onChange, placeholder = '0.00', disabled }: AmountInputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-[#A3A3A3]">{label}</label>
      )}
      <div className={clsx(
        'flex items-baseline gap-2 rounded-xl border bg-[#0A0A0A] px-4 py-3 transition-colors',
        error ? 'border-[#ba2b4c]/60' : 'border-[#242424] focus-within:border-[#333]',
      )}>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-3xl font-bold text-white placeholder-[#525252] outline-none tabular-nums min-w-0"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        />
        <span className="text-sm font-semibold text-[#A3A3A3] shrink-0">USDC</span>
      </div>
      {error && <p className="text-xs text-[#f87171]">{error}</p>}
      {hint && !error && <p className="text-xs text-[#A3A3A3]">{hint}</p>}
    </div>
  )
}
