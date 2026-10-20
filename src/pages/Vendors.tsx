import { useState } from 'react'
import { PageHeader } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { Modal } from '../components/Modal'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { useAppState } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'
import type { Vendor } from '../lib/types'

export function Vendors() {
  const s = useAppState()
  const [mode, setMode] = useViewMode('vendors', ['table', 'cards'] as ViewMode[], 'table')
  const [selected, setSelected] = useState<Vendor | null>(null)

  const posOf = (v: Vendor) => s.purchaseOrders.filter((p) => p.vendor === v.name)
  const open = (v: Vendor) => posOf(v).filter((p) => p.status !== 'invoiced')

  const selectedPos = selected ? posOf(selected) : []

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle="Who you buy from — POs, terms and lead times per supplier"
        action={
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 tabular-nums">{s.vendors.length} vendors</span>
            <ViewSwitcher modes={['table', 'cards']} value={mode} onChange={setMode} />
          </div>
        }
      />

      {mode === 'table' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2.5 font-medium">Vendor</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Contact</th>
                <th className="px-4 py-2.5 font-medium">Terms</th>
                <th className="px-4 py-2.5 font-medium">Open POs</th>
                <th className="px-4 py-2.5 font-medium text-right">Total value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {s.vendors.map((v) => {
                const pos = posOf(v)
                const openPos = open(v)
                return (
                  <tr key={v.id} onClick={() => setSelected(v)} className="hover:bg-gray-50/70 cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0">
                          {v.name.slice(0, 1)}
                        </span>
                        <div>
                          <div className="font-medium text-gray-900">{v.name}</div>
                          <div className="text-xs text-gray-400">{v.contactName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{v.category}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{v.phone}</div>
                      <div className="text-xs text-gray-400">{v.email}</div>
                    </td>
                    <td className="px-4 py-3"><Chip tone="gray">{v.terms}</Chip></td>
                    <td className="px-4 py-3">
                      {openPos.length ? <Chip tone="amber">{openPos.length} open</Chip> : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {pos.length ? money(pos.reduce((a, p) => a + p.total, 0)) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {mode === 'cards' && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {s.vendors.map((v) => {
            const pos = posOf(v)
            const openPos = open(v)
            return (
              <button key={v.id} onClick={() => setSelected(v)} className="text-left bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 text-sm font-bold flex items-center justify-center">
                      {v.name.slice(0, 1)}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{v.name}</div>
                      <div className="text-xs text-gray-500">{v.category}</div>
                    </div>
                  </div>
                  {openPos.length > 0 && <Chip tone="amber">{openPos.length} open</Chip>}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-xs">
                  <span className="text-gray-500">{v.terms}</span>
                  <span className="tabular-nums font-semibold text-gray-800">
                    {pos.length ? money(pos.reduce((a, p) => a + p.total, 0)) : 'no POs yet'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? selected.name : ''} wide>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500 block text-xs">Category</span>{selected.category}</div>
              <div><span className="text-gray-500 block text-xs">Contact</span>{selected.contactName} · {selected.phone}</div>
              <div><span className="text-gray-500 block text-xs">Email</span><span className="break-all">{selected.email}</span></div>
              <div><span className="text-gray-500 block text-xs">Terms</span><Chip tone="gray">{selected.terms}</Chip></div>
            </div>

            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 border-b border-gray-100">
                Purchase orders ({selectedPos.length})
              </div>
              {selectedPos.length === 0 && (
                <div className="px-3 py-4 text-sm text-gray-400 text-center">No POs yet.</div>
              )}
              {selectedPos.map((po) => {
                const stuck = po.status === 'ordered' && po.orderedAt && daysBetween(po.orderedAt) >= 5
                return (
                  <div key={po.id} className="px-3 py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{po.no}</span>
                      <span className="text-xs text-gray-500">{po.project}</span>
                      <StatusChip status={po.status} />
                      {po.fundedBy === 'investor_advance' && <Chip tone="blue">investor advance</Chip>}
                      {stuck && <Chip tone="amber">{daysBetween(po.orderedAt!)}d waiting</Chip>}
                      <span className="ml-auto text-sm tabular-nums font-semibold">{money(po.total)}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {po.items.map((i) => `${i.qty}× ${i.description}`).join(' · ')}
                      {po.orderedAt ? ` · ordered ${dateShort(po.orderedAt)}` : ''}
                    </div>
                  </div>
                )
              })}
            </div>

            <a
              href={`mailto:${selected.email}?subject=${encodeURIComponent('Purchase order check-in')}`}
              className="block text-center rounded-lg bg-gray-900 text-white text-sm font-medium px-4 py-2 hover:bg-gray-800"
            >
              Email {selected.contactName}
            </a>
          </div>
        )}
      </Modal>
    </>
  )
}
