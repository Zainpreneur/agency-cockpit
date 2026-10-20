import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/Layout'
import { Chip } from '../components/StatusChip'
import { useAppState, moveLeadStatus } from '../lib/store'
import { dateShort, dueLabel } from '../lib/format'
import type { Lead, LeadStatus } from '../lib/types'
import { metaFor } from '../lib/statuses'

const COLUMNS: { key: string; label: string; statuses: LeadStatus[] }[] = [
  { key: 'new', label: 'New', statuses: ['discovered'] },
  { key: 'contacted', label: 'Contacted', statuses: ['contacted'] },
  { key: 'demo', label: 'Demo', statuses: ['demo_built', 'demo_shared'] },
  { key: 'proposal', label: 'Proposal', statuses: ['proposal_sent'] },
  { key: 'negotiating', label: 'Negotiating', statuses: ['negotiating'] },
  { key: 'closed', label: 'Closed', statuses: ['won', 'lost'] },
]

function LeadCard({ lead, onStatus }: { lead: Lead; onStatus: (s: LeadStatus) => void }) {
  const meta = metaFor(lead.status)
  const lastTouch = lead.lastInboundAt && new Date(lead.lastInboundAt) > new Date(lead.lastOutboundAt ?? 0)
    ? '↩ waiting on you'
    : lead.lastOutboundAt
      ? `out ${dateShort(lead.lastOutboundAt)}`
      : 'not contacted yet'

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 hover:shadow-md transition group">
      <Link to={`/sales/leads/${lead.id}`} className="block">
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
            <span className="text-gray-400">· follow up {dateShort(lead.nextFollowUpAt)}</span>
          )}
        </div>
      </Link>
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
    </div>
  )
}

export function LeadsBoard() {
  const s = useAppState()
  const navigate = useNavigate()

  const move = (id: number, status: LeadStatus) => {
    // Board drag = flip status (same rule as the API: gestures flip, guards outrank)
    moveLeadStatus(id, status)
  }

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Board = status columns; dropping a card is a status flip with an event behind it"
        action={
          <button
            onClick={() => navigate('/sales/proposals/new')}
            className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
          >
            + New proposal
          </button>
        }
      />

      <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0">
        {COLUMNS.map((col) => {
          const leads = s.leads.filter((l) => col.statuses.includes(l.status))
          return (
            <div key={col.key} className="w-64 shrink-0">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{col.label}</span>
                <span className="text-xs text-gray-400 tabular-nums">{leads.length}</span>
              </div>
              <div className="space-y-2 min-h-8">
                {leads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} onStatus={(st) => move(lead.id, st)} />
                ))}
                {leads.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 h-16" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
