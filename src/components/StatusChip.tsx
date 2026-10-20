import { metaFor, statusMeta, toneCls, type Tone } from '../lib/statuses'

export function StatusChip({
  status,
  domain,
  title,
}: {
  status: string
  domain?: 'invoice' | 'payout' | 'outbox'
  title?: string
}) {
  const meta = domain ? statusMeta(domain, status) : metaFor(status)
  return (
    <span
      title={title ?? meta.label}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${toneCls(meta.tone)}`}
    >
      {meta.label}
    </span>
  )
}

export function Chip({ children, tone = 'gray', title, className }: { children: React.ReactNode; tone?: Tone; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${toneCls(tone)} ${className ?? ''}`}
    >
      {children}
    </span>
  )
}
