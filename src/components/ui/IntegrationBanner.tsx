import { AlertTriangle, ExternalLink } from 'lucide-react'

interface IntegrationBannerProps {
  title?: string
  description?: string
  envVars?: string[]
  link?: string
  linkLabel?: string
}

export function IntegrationBanner({
  title = 'Integration not configured',
  description,
  envVars,
  link,
  linkLabel = 'Setup guide',
}: IntegrationBannerProps) {
  return (
    <div className="rounded-xl border border-[#d97706]/20 bg-[#1c1a0f] p-4 flex gap-3">
      <AlertTriangle className="text-[#fbbf24] shrink-0 mt-0.5" size={16} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#fbbf24]">{title}</p>
        {description && <p className="text-xs text-[#A3A3A3] mt-1 leading-relaxed">{description}</p>}
        {envVars && envVars.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {envVars.map((v) => (
              <code key={v} className="text-[10px] font-mono bg-white/[0.06] border border-white/10 rounded px-1.5 py-0.5 text-[#D4D4D4]">
                {v}
              </code>
            ))}
          </div>
        )}
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-[#fbbf24] hover:text-white transition-colors"
          >
            {linkLabel}
            <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  )
}
