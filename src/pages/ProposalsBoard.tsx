import { Link } from 'react-router-dom'
import { PageHeader } from '../components/Layout'
import { StatusChip, Chip } from '../components/StatusChip'
import { useAppState } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'
import type { ProposalStatus } from '../lib/types'

const COLUMNS: { key: string; label: string; statuses: ProposalStatus[] }[] = [
  { key: 'draft', label: 'Draft', statuses: ['draft'] },
  { key: 'sent', label: 'Sent', statuses: ['sent', 'viewed'] },
  { key: 'accepted', label: 'Accepted', statuses: ['accepted'] },
  { key: 'closed', label: 'Closed lost', statuses: ['rejected', 'expired'] },
]

export function ProposalsBoard() {
  const s = useAppState()

  return (
    <>
      <PageHeader
        title="Proposals"
        subtitle="Price snapshots freeze at send — later catalogue changes never touch a sent quote"
        action={
          <Link to="/sales/proposals/new" className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700">
            + New proposal
          </Link>
        }
      />

      <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0">
        {COLUMNS.map((col) => {
          const items = s.proposals.filter((p) => col.statuses.includes(p.status))
          return (
            <div key={col.key} className="w-72 shrink-0">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{col.label}</span>
                <span className="text-xs text-gray-400 tabular-nums">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((p) => {
                  const expiring = p.status === 'sent' && daysBetween(p.validUntil) > -7
                  const past = daysBetween(p.validUntil) > 0
                  const margin = p.offeredPrice - p.cost
                  return (
                    <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{p.no}</div>
                          <Link to={`/sales/leads/${p.leadId}`} className="text-xs text-blue-600 hover:underline">
                            {p.leadName}
                          </Link>
                        </div>
                        <StatusChip status={p.status} />
                      </div>

                      <div className="mt-2.5 flex items-baseline justify-between">
                        <span className="text-lg font-semibold tabular-nums">{money(p.offeredPrice)}</span>
                        {p.listPrice > p.offeredPrice && (
                          <span className="text-xs text-gray-400 line-through tabular-nums">{money(p.listPrice)}</span>
                        )}
                      </div>

                      {/* owner-only numbers — this whole app is you, so they show */}
                      <div className="mt-1 text-xs text-gray-500 tabular-nums">
                        nets {money(margin)} · {Math.round((margin / p.offeredPrice) * 100)}% margin
                        {p.maintenanceMonthly ? ` + ${money(p.maintenanceMonthly)}/mo` : ''}
                      </div>

                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {past && p.status === 'sent' && <Chip tone="red">expired {dateShort(p.validUntil)}</Chip>}
                        {expiring && <Chip tone="amber">expires {dateShort(p.validUntil)}</Chip>}
                        {!expiring && !past && <Chip tone="gray">valid to {dateShort(p.validUntil)}</Chip>}
                        {p.status === 'accepted' && (
                          <Link to="/money/invoices" className="text-xs text-blue-600 hover:underline">
                            invoice →
                          </Link>
                        )}
                      </div>

                      {p.discountReason && (
                        <div className="mt-2 pt-2 border-t border-gray-50 text-[11px] text-gray-400">
                          discount reason: {p.discountReason}
                        </div>
                      )}
                    </div>
                  )
                })}
                {items.length === 0 && <div className="rounded-xl border border-dashed border-gray-200 h-14" />}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
