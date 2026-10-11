interface AverLogoProps {
  size?: number
  className?: string
}

export function AverLogo({ size = 28, className = '' }: AverLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Avero"
    >
      {/* Clean geometric mark: stylized "A" chevron */}
      <rect width="28" height="28" rx="7" fill="white" />
      <path
        d="M14 5L5 22H9.5L14 12.5L18.5 22H23L14 5Z"
        fill="#050505"
      />
      <path
        d="M11 17H17L15.5 14H12.5L11 17Z"
        fill="white"
      />
    </svg>
  )
}

export function AverWordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-bold tracking-[-0.04em] ${className}`}
      style={{ fontFamily: 'Manrope, DM Sans, sans-serif' }}
    >
      avero
    </span>
  )
}
