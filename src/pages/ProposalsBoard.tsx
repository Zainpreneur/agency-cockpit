import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/Layout'
import { StatusChip, Chip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { CalendarBoard } from '../components/CalendarBoard'
import { ProposalsDraggableBoard } from '../components/DraggableBoard'
import { useAppState, moveProposalStatus } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'
import type { Proposal, ProposalStatus } from '../lib/types'

const COLUMNS: { key: string; label: string; statuses: ProposalStatus[] }[] = [
  { key: 'draft', label: 'Draft', statuses: ['draft'] },
  { key: 'sent', label: 'Sent', statuses: ['sent', 'viewed'] },
  { key: 'accepted', label: 'Accepted', statuses: ['accepted'] },
  { key: 'closed', label: 'Closed lost', statuses: ['rejected', 'expired'] },
]

const MODES: ViewMode[] = ['board', 'table', 'cards', 'calendar']

function ProposalCard({ p }: { p: Proposal }) {
  const expiring = (p.status === 'sent' || p.status === 'viewed') && daysBetween(p.validUntil) > -7
  const past = daysBetween(p.validUntil) > 0
  const margin = p.offeredPrice - p.cost
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
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
        {past && (p.status === 'sent' || p.status === 'viewed') && <Chip tone="red">expired {dateShort(p.validUntil)}</Chip>}
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
}

export function ProposalsBoard() {
  const s = useAppState()
  const navigate = useNavigate()
  const [mode, setMode] = useViewMode('proposals', MODES, 'board')

  return (
    <>
      <PageHeader
        title="Proposals"
        subtitle="Price snapshots freeze at send — later catalogue changes never touch a sent quote"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <ViewSwitcher modes={MODES} value={mode} onChange={setMode} />
            <Link to="/sales/proposals/new" className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700">
              + New proposal
            </Link>
          </div>
        }
      />

      {/* ── BOARD (drag = status flip, event written on drop; accepted drops require pasted reply first) ── */}
      {mode === 'board' && (
        <ProposalsDraggableBoard
          proposals={s.proposals}
          onMove={moveProposalStatus}
        />
      )}

      {/* ── TABLE ── */}
      {mode === 'table' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2.5 font-medium">No</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium text-right">Price</th>
                <th className="px-4 py-2.5 font-medium text-right">Nets</th>
                <th className="px-4 py-2.5 font-medium">Valid until</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {s.proposals.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/sales/leads/${p.leadId}`)} className="hover:bg-gray-50/70 cursor-pointer">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.no}</td>
                  <td className="px-4 py-3">
                    <div className="text-gray-800">{p.leadName}</div>
                    {p.discountReason && <div className="text-xs text-gray-400">discount: {p.discountReason}</div>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{money(p.offeredPrice)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {money(p.offeredPrice - p.cost)} · {Math.round(((p.offeredPrice - p.cost) / p.offeredPrice) * 100)}%
                  </td>
                  <td className="px-4 py-3 text-gray-600">{dateShort(p.validUntil)}</td>
                  <td className="px-4 py-3"><StatusChip status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CARDS ── */}
      {mode === 'cards' && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {s.proposals.map((p) => <ProposalCard key={p.id} p={p} />)}
        </div>
      )}

      {/* ── CALENDAR (quote expiry) ── */}
      {mode === 'calendar' && (
        <CalendarBoard
          events={s.proposals
            .filter((p) => p.status === 'sent' || p.status === 'viewed')
            .map((p) => ({
              key: `prop-${p.id}`,
              date: p.validUntil,
              label: `${p.no} expires · ${p.leadName}`,
              kind: 'quote',
              tone: (daysBetween(p.validUntil) > 0 ? 'red' : daysBetween(p.validUntil) > -7 ? 'amber' : 'gray') as 'red' | 'amber' | 'gray',
              onClick: () => navigate(`/sales/leads/${p.leadId}`),
            }))}
        />
      )}
    </>
  )
}
