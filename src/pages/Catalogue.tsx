import { Link } from 'react-router-dom'
import { PageHeader } from '../components/Layout'
import { useAppState } from '../lib/store'
import { money } from '../lib/format'

export function Catalogue() {
  const s = useAppState()

  return (
    <>
      <PageHeader
        title="Catalogue"
        subtitle="Templates = variant + attribute engine (doc 17) — the proposal builder renders these as pills"
        action={
          <Link to="/sales/proposals/new" className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700">
            Build a proposal →
          </Link>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {s.catalog.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div
              className="h-36 flex items-end justify-between p-3"
              style={{ background: `linear-gradient(135deg, hsl(${t.hue} 70% 88%), hsl(${(t.hue + 40) % 360} 70% 74%))` }}
            >
              <span className="text-xs font-semibold text-gray-700 bg-white/75 rounded px-2 py-0.5">{t.sold} sold</span>
              <span className="text-xs text-gray-500 bg-white/60 rounded px-2 py-0.5">image_url → initials fallback</span>
            </div>
            <div className="p-4 border-t border-gray-100">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-gray-900">{t.name}</h2>
                <span className="text-sm font-semibold tabular-nums">from {money(t.fromPrice)}</span>
              </div>

              <div className="mt-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Variants</div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {t.variants.map((v) => (
                    <span key={v.code} className="rounded-full bg-gray-50 ring-1 ring-gray-200 px-2 py-0.5 text-[11px] text-gray-600">
                      {v.name} · {money(v.price)} · {v.deliveryDays}d
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Attributes</div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {t.attributes.map((a) => (
                    <span key={a.code} className="rounded-full bg-blue-50 ring-1 ring-blue-100 px-2 py-0.5 text-[11px] text-blue-700" title={a.values.map((v) => v.name).join(' / ')}>
                      {a.name} ({a.values.length})
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-500 tabular-nums">
                margins by variant:{' '}
                {t.variants.map((v) => `${v.name} ${Math.round(((v.price - v.cost) / v.price) * 100)}%`).join(' · ')}
                <span className="text-gray-400"> · owner-only numbers</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
