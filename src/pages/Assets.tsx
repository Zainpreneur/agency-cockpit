import { PageHeader, SectionCard } from '../components/Layout'
import { Chip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { useAppState } from '../lib/store'
import { dateShort, daysBetween } from '../lib/format'

/** Client devices = physical assets (doc 25 gallery view): color card first,
 * image_url optional — fallback is never a broken image. */
export function Assets() {
  const s = useAppState()
  const [mode, setMode] = useViewMode('assets', ['gallery', 'list'] as ViewMode[], 'gallery')

  const warrantyTone = (until?: string) => {
    if (!until) return 'gray' as const
    const left = -daysBetween(until) // days remaining
    if (left < 0) return 'red' as const
    if (left < 60) return 'amber' as const
    return 'green' as const
  }

  return (
    <>
      <PageHeader
        title="Assets"
        subtitle="Machines on client sites — photos, serials, warranties, provenance from POs"
        action={
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 tabular-nums">{s.devices.length} devices</span>
            <ViewSwitcher modes={['gallery', 'list']} value={mode} onChange={setMode} />
          </div>
        }
      />

      {mode === 'gallery' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {s.devices.map((dev) => (
            <div key={dev.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div
                className="h-32 flex items-center justify-center text-3xl"
                style={{ background: `linear-gradient(135deg, hsl(${dev.imageHue} 65% 90%), hsl(${(dev.imageHue + 30) % 360} 65% 78%))` }}
                title={`${dev.kind} — photo placeholder (image_url → initials fallback)`}
              >
                📷
              </div>
              <div className="p-3 border-t border-gray-100">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{dev.kind}</div>
                    <div className="text-xs text-gray-500 truncate">{dev.clientName}</div>
                  </div>
                  <Chip tone={warrantyTone(dev.warrantyUntil)} title={dev.warrantyUntil ? 'warranty' : undefined}>
                    {dev.warrantyUntil ? (daysBetween(dev.warrantyUntil) > 0 ? 'in warranty' : 'expired') : 'no warranty'}
                  </Chip>
                </div>
                <div className="mt-1.5 text-[11px] text-gray-400 font-mono">{dev.serial}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2.5 font-medium">Device</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Serial</th>
                <th className="px-4 py-2.5 font-medium">Warranty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {s.devices.map((dev) => (
                <tr key={dev.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3 font-medium text-gray-900">{dev.kind}</td>
                  <td className="px-4 py-3 text-gray-600">{dev.clientName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{dev.serial}</td>
                  <td className="px-4 py-3">
                    <Chip tone={warrantyTone(dev.warrantyUntil)}>
                      {dev.warrantyUntil ? `until ${dateShort(dev.warrantyUntil)}` : '—'}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <SectionCard title="How assets connect">
          <div className="px-4 py-3 text-sm text-gray-600 leading-relaxed">
            Every device traces back to the PO that bought it — when a machine fails on site you see
            the vendor, the price paid, and whether warranty still covers it. Registration happens in
            the device form (photo required, serial + warranty date, kind-driven fields).
          </div>
        </SectionCard>
      </div>
    </>
  )
}
