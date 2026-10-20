import { useState, useCallback } from 'react'
import { Chip } from './StatusChip'
import { StatusChip } from './StatusChip'
import { money, dateShort, daysBetween } from '../lib/format'
import type { Lead, Proposal } from '../lib/types'
import { metaFor } from '../lib/statuses'

interface ColumnDef<T> {
  key: string
  label: string
  statuses: string[]
}

interface BoardProps<T> {
  columns: ColumnDef<T>[]
  items: T[]
  renderCard: (item: T, onStatusChange: (newStatus: string) => void) => React.ReactElement
  onMove: (itemId: number, newStatus: string) => void
  getId: (item: T) => number
  getStatus: (item: T) => string
  emptyColumnHeight?: number
  cardMinWidth?: number
  cardGap?: number
}

/**
 * Generic drag-and-drop board for any pipeline entity.
 * - Drag = status flip (doc 25: "drag = status flip, cascades fire on drop")
 * - Payouts board explicitly excluded: "guard decides, not drag"
 * - Drops write an append-only status event via the onMove callback
 */
export function DraggableBoard<T extends { id: number }>({
  columns,
  items,
  renderCard,
  onMove,
  getId,
  getStatus,
  emptyColumnHeight = 96,
  cardMinWidth = 256,
  cardGap = 8,
}: BoardProps<T>) {
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, id: number) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(id))
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedId(null)
    setDragOverColumn(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnKey)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault()
    const id = Number(e.dataTransfer.getData('text/plain'))
    const targetColumn = columns.find((c) => c.key === columnKey)
    if (!targetColumn || !id) {
      setDragOverColumn(null)
      setDraggedId(null)
      return
    }
    // Use the first status in the column as the new status
    const newStatus = targetColumn.statuses[0]
    const item = items.find((i) => getId(i) === id)
    if (item && getStatus(item) !== newStatus) {
      onMove(id, newStatus)
    }
    setDragOverColumn(null)
    setDraggedId(null)
  }, [columns, items, onMove, getId, getStatus])

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0"
      role="list"
      aria-label="Pipeline board"
    >
      {columns.map((col) => {
        const columnItems = items.filter((i) => col.statuses.includes(getStatus(i)))
        const isDragOver = dragOverColumn === col.key

        return (
          <div
            key={col.key}
            className={`w-64 shrink-0 ${isDragOver ? 'ring-2 ring-blue-500/50 rounded-xl bg-blue-50/50' : ''}`}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.key)}
            role="listitem"
            aria-label={`${col.label} column, ${columnItems.length} items`}
          >
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{col.label}</span>
              <span className="text-xs text-gray-400 tabular-nums">{columnItems.length}</span>
            </div>
            <div
              className="space-y-2 min-h-8"
              style={{ minHeight: emptyColumnHeight }}
              role="list"
            >
              {columnItems.map((item) => (
                <div
                  key={getId(item)}
                  draggable
                  onDragStart={(e) => handleDragStart(e, getId(item))}
                  onDragEnd={handleDragEnd}
                  className="opacity-100"
                  role="listitem"
                >
                  {renderCard(item, (newStatus) => onMove(getId(item), newStatus))}
                </div>
              ))}
              {columnItems.length === 0 && (
                <div
                  className={`rounded-xl border-2 border-dashed border-gray-200 transition-colors ${
                    isDragOver ? 'border-blue-400 bg-blue-50' : ''
                  }`}
                  style={{ height: emptyColumnHeight }}
                  aria-label={`${col.label} is empty, drop items here`}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Lead-specific board (uses LeadsBoard's LeadCard pattern)
 */
export function LeadsDraggableBoard({
  leads,
  onMove,
}: {
  leads: Lead[]
  onMove: (leadId: number, newStatus: string) => void
}) {
  const COLUMNS: ColumnDef<Lead>[] = [
    { key: 'new', label: 'New', statuses: ['discovered'] },
    { key: 'contacted', label: 'Contacted', statuses: ['contacted'] },
    { key: 'demo', label: 'Demo', statuses: ['demo_built', 'demo_shared'] },
    { key: 'proposal', label: 'Proposal', statuses: ['proposal_sent'] },
    { key: 'negotiating', label: 'Negotiating', statuses: ['negotiating'] },
    { key: 'closed', label: 'Closed', statuses: ['won', 'lost'] },
  ]

  function LeadCard({ lead, onStatus }: { lead: Lead; onStatus: (s: string) => void }) {
    const meta = metaFor(lead.status)
    const lastTouch = lead.lastInboundAt && new Date(lead.lastInboundAt) > new Date(lead.lastOutboundAt ?? 0)
      ? '↩ waiting on you'
      : lead.lastOutboundAt
        ? `out ${lead.lastOutboundAt.slice(0, 10)}`
        : 'not contacted yet'

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 hover:shadow-md transition group">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-semibold text-gray-900">{lead.businessName}</div>
          <Chip tone={meta.tone}>{meta.label}</Chip>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {lead.industry} · {lead.city} · {lead.contactName}
        </div>
        <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-2 flex-wrap">
          <span>{lastTouch}</span>
          {lead.nextFollowUpAt && (
            <span className="text-gray-400">· follow up {lead.nextFollowUpAt.slice(0, 10)}</span>
          )}
        </div>

        {lead.status === 'won' ? (
          <div className="mt-2.5 pt-2 border-t border-gray-50">
            <button
              onClick={() => onStatus('convert')}
              className="w-full rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700"
              title="Creates the client record and queues the intake questionnaire"
            >
              → Turn into client
            </button>
          </div>
        ) : (
          <div className="mt-2.5 pt-2 border-t border-gray-50 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
            <span className="text-[11px] text-gray-400 mr-auto">move →</span>
            {COLUMNS.filter((c) => !c.statuses.includes(lead.status)).map((c) => (
              <button
                key={c.key}
                onClick={() => onStatus(c.statuses[0])}
                className="rounded-full bg-gray-50 text-gray-600 ring-1 ring-gray-200 px-2 py-0.5 text-[11px] hover:bg-gray-100"
                title={`Move to ${c.label}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <DraggableBoard
      columns={COLUMNS}
      items={leads}
      renderCard={(lead, onStatus) => <LeadCard lead={lead} onStatus={onStatus} />}
      onMove={onMove}
      getId={(l) => l.id}
      getStatus={(l) => l.status}
    />
  )
}

/**
 * Proposal-specific board
 */
export function ProposalsDraggableBoard({
  proposals,
  onMove,
}: {
  proposals: Proposal[]
  onMove: (proposalId: number, newStatus: string) => void
}) {
  const COLUMNS: ColumnDef<Proposal>[] = [
    { key: 'draft', label: 'Draft', statuses: ['draft'] },
    { key: 'sent', label: 'Sent', statuses: ['sent', 'viewed'] },
    { key: 'accepted', label: 'Accepted', statuses: ['accepted'] },
    { key: 'closed', label: 'Closed lost', statuses: ['rejected', 'expired'] },
  ]

  function ProposalCard({ proposal, onStatus }: { proposal: Proposal; onStatus: (s: string) => void }) {
    const expiring = (proposal.status === 'sent' || proposal.status === 'viewed') && daysBetween(proposal.validUntil) > -7
    const past = daysBetween(proposal.validUntil) > 0
    const margin = proposal.offeredPrice - proposal.cost

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-900">{proposal.no}</div>
            <a href={`/sales/leads/${proposal.leadId}`} className="text-xs text-blue-600 hover:underline">
              {proposal.leadName}
            </a>
          </div>
          <StatusChip status={proposal.status} />
        </div>

        <div className="mt-2.5 flex items-baseline justify-between">
          <span className="text-lg font-semibold tabular-nums">{money(proposal.offeredPrice)}</span>
          {proposal.listPrice > proposal.offeredPrice && (
            <span className="text-xs text-gray-400 line-through tabular-nums">{money(proposal.listPrice)}</span>
          )}
        </div>

        <div className="mt-1 text-xs text-gray-500 tabular-nums">
          nets {money(margin)} · {Math.round((margin / proposal.offeredPrice) * 100)}%
          {proposal.maintenanceMonthly ? ` + ${money(proposal.maintenanceMonthly)}/mo` : ''}
        </div>

        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {past && (proposal.status === 'sent' || proposal.status === 'viewed') && <Chip tone="red">expired {dateShort(proposal.validUntil)}</Chip>}
          {expiring && <Chip tone="amber">expires {dateShort(proposal.validUntil)}</Chip>}
          {!expiring && !past && <Chip tone="gray">valid to {dateShort(proposal.validUntil)}</Chip>}
          {proposal.status === 'accepted' && (
            <a href="/money/invoices" className="text-xs text-blue-600 hover:underline">
              invoice →
            </a>
          )}
        </div>

        {proposal.discountReason && (
          <div className="mt-2 pt-2 border-t border-gray-50 text-[11px] text-gray-400">
            discount reason: {proposal.discountReason}
          </div>
        )}
      </div>
    )
  }

  return (
    <DraggableBoard
      columns={COLUMNS}
      items={proposals}
      renderCard={(proposal, onStatus) => <ProposalCard proposal={proposal} onStatus={onStatus} />}
      onMove={onMove}
      getId={(p) => p.id}
      getStatus={(p) => p.status}
      cardMinWidth={288}
      emptyColumnHeight={72}
    />
  )
}