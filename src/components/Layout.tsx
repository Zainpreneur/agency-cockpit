import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SectionCard({
  title,
  hint,
  children,
  action,
}: {
  title: string
  hint?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {hint && <span className="text-xs text-gray-400">{hint}</span>}
        </div>
        {action}
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </section>
  )
}

export function EmptyRow({ text }: { text: string }) {
  return <div className="px-4 py-6 text-sm text-gray-400 text-center">{text}</div>
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' | 'amber' }) {
  const cls = tone === 'green' ? 'text-emerald-600' : tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-gray-900'
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  )
}
