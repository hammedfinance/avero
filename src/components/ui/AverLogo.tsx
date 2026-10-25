interface AverLogoProps {
  height?: number
  className?: string
}

// Uses the logo image from /logo.png (in public/)
// The logo is white text on white background — rendered on dark backgrounds only.
export function AverLogo({ height = 28, className = '' }: AverLogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Avero"
      height={height}
      style={{ height, width: 'auto' }}
      className={className}
    />
  )
}

// Kept as fallback for places that only want the text wordmark
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
