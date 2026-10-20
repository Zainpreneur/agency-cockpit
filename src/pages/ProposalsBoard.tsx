import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/Layout'
import { StatusChip, Chip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { CalendarBoard } from '../components/CalendarBoard'
import { PipelineBoard, DataTable, exportToCSV } from '../components/PipelineBoard'
import { useAppState, moveProposalStatus } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'
import type { Proposal, ProposalStatus } from '../lib/types'

const MODES: ViewMode[] = ['board', 'table', 'cards', 'calendar']

const PIPELINE_COLUMNS = [
  { key: 'draft', label: 'Draft', statuses: ['draft'] as ProposalStatus[] },
  { key: 'sent', label: 'Sent', statuses: ['sent', 'viewed'] as ProposalStatus[] },
  { key: 'accepted', label: 'Accepted', statuses: ['accepted'] as ProposalStatus[] },
  { key: 'closed', label: 'Closed lost', statuses: ['rejected', 'expired'] as ProposalStatus[] },
]

const TABLE_COLUMNS = [
  { key: 'no', label: 'No', render: (p: Proposal) => (
    <span className="font-medium text-gray-900">{p.no}</span>
  ) },
  { key: 'leadName', label: 'Client', render: (p: Proposal) => (
    <div>
      <div className="text-gray-800">{p.leadName}</div>
      {p.discountReason && <div className="text-xs text-gray-400">discount: {p.discountReason}</div>}
    </div>
  ) },
  { key: 'offeredPrice', label: 'Price', render: (p: Proposal) => (
    <span className="text-right tabular-nums font-medium">{money(p.offeredPrice)}</span>
  ), align: 'right' as const, sortable: true },
  { key: 'margin', label: 'Nets', render: (p: Proposal) => {
    const margin = p.offeredPrice - p.cost
    return <span className="text-right tabular-nums text-gray-600">{money(margin)} · {Math.round((margin / p.offeredPrice) * 100)}%</span>
  }, align: 'right' as const },
  { key: 'validUntil', label: 'Valid until', render: (p: Proposal) => (
    <span className="text-gray-600">{dateShort(p.validUntil)}</span>
  ), sortable: true },
  { key: 'status', label: 'Status', render: (p: Proposal) => (
    <StatusChip status={p.status} />
  ), groupable: true },
]

function ProposalCard({ proposal, onStatus }: { proposal: Proposal; onStatus: (s: string) => void }) {
  const p = proposal
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
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  // Table selection helpers
  const allSelected = s.proposals.length > 0 && selectedIds.length === s.proposals.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < s.proposals.length
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? s.proposals.map((p) => p.id) : [])
  const toggleRow = (id: number, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))

  const proposalColumns = (p: Proposal) => ({
    No: p.no,
    Client: p.leadName,
    Price: money(p.offeredPrice),
    Margin: money(p.offeredPrice - p.cost) + ` · ${Math.round(((p.offeredPrice - p.cost) / p.offeredPrice) * 100)}%`,
    'Valid until': dateShort(p.validUntil),
    Status: p.status,
  })

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
        <PipelineBoard
          columns={PIPELINE_COLUMNS}
          items={s.proposals}
          renderCard={(proposal, onStatus) => <ProposalCard proposal={proposal} onStatus={onStatus} />}
          onMove={moveProposalStatus}
          getId={(p) => p.id}
          getStatus={(p) => p.status}
          cardMinWidth={288}
          emptyColumnHeight={72}
          onCascadePreview={(proposal, newStatus) => (
            <div className="px-3 py-2 text-sm text-gray-700">
              Move <strong>{proposal.no}</strong> to <span className="font-medium capitalize">{newStatus}</span>
              <br />
              <span className="text-xs text-gray-500">
                {newStatus === 'accepted'
                  ? 'Requires pasted "accepted" reply first · writes event · flips lead to proposal_sent'
                  : newStatus === 'sent'
                    ? 'Writes event · queues proposal_send email · sets follow-up'
                    : 'Writes status event'}
              </span>
            </div>
          )}
        />
      )}

      {/* ── TABLE (sort, group, bulk-select, CSV) ── */}
      {mode === 'table' && (
        <DataTable
          columns={TABLE_COLUMNS}
          items={s.proposals}
          getId={(p) => p.id}
          defaultSort={{ key: 'no', direction: 'asc' }}
          onRowClick={(p) => navigate(`/sales/leads/${p.leadId}`)}
          selection={{
            selectedIds,
            onSelect: toggleRow,
            onSelectAll: toggleAll,
          }}
          onExportCSV={(items) => exportToCSV(items, TABLE_COLUMNS, 'proposals')}
          exportFilename="proposals"
        />
      )}

      {/* ── CARDS ── */}
      {mode === 'cards' && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {s.proposals.map((p) => <ProposalCard key={p.id} proposal={p} onStatus={() => {}} />)}
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
