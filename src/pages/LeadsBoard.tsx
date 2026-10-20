import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/Layout'
import { Chip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { CalendarBoard } from '../components/CalendarBoard'
import { useAppState, moveLeadStatus, convertLeadToClient } from '../lib/store'
import { dateShort } from '../lib/format'
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
  const navigate = useNavigate()
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

      {lead.status === 'won' ? (
        <div className="mt-2.5 pt-2 border-t border-gray-50">
          <button
            onClick={() => {
              const id = convertLeadToClient(lead.id)
              if (id) navigate(`/clients/${id}`)
            }}
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

const MODES: ViewMode[] = ['board', 'cards', 'list', 'table', 'timeline', 'calendar']

export function LeadsBoard() {
  const s = useAppState()
  const navigate = useNavigate()
  const [mode, setMode] = useViewMode('leads', MODES, 'board')

  const move = (id: number, status: LeadStatus) => moveLeadStatus(id, status)

  const timeline = [...s.commsLog].sort((a, b) => b.at.localeCompare(a.at))

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Board = status columns; a drop is a status flip with an event behind it"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <ViewSwitcher modes={MODES} value={mode} onChange={setMode} />
            <button
              onClick={() => navigate('/sales/proposals/new')}
              className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
            >
              + New proposal
            </button>
          </div>
        }
      />

      {/* ── BOARD ── */}
      {mode === 'board' && (
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
                  {leads.length === 0 && <div className="rounded-xl border border-dashed border-gray-200 h-16" />}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── CARDS ── */}
      {mode === 'cards' && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {s.leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onStatus={(st) => move(lead.id, st)} />
          ))}
        </div>
      )}

      {/* ── LIST ── */}
      {mode === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-50">
          {s.leads.map((lead) => {
            const meta = metaFor(lead.status)
            const needs = lead.lastInboundAt && new Date(lead.lastInboundAt) > new Date(lead.lastOutboundAt ?? 0)
            return (
              <Link key={lead.id} to={`/sales/leads/${lead.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-gray-50/70">
                <span className="w-7 h-7 rounded-lg bg-gray-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {lead.businessName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">{lead.businessName}</div>
                  <div className="text-xs text-gray-500">{lead.contactName} · {lead.industry} · {lead.city}</div>
                </div>
                {needs && <Chip tone="amber">↩ needs reply</Chip>}
                <Chip tone={meta.tone}>{meta.label}</Chip>
                <span className="text-xs text-gray-400 w-24 text-right">
                  {lead.nextFollowUpAt ? `follow up ${dateShort(lead.nextFollowUpAt)}` : '—'}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── TABLE ── */}
      {mode === 'table' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2.5 font-medium">Business</th>
                <th className="px-4 py-2.5 font-medium">Contact</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Next follow-up</th>
                <th className="px-4 py-2.5 font-medium">Last message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {s.leads.map((lead) => {
                const meta = metaFor(lead.status)
                const needs = lead.lastInboundAt && new Date(lead.lastInboundAt) > new Date(lead.lastOutboundAt ?? 0)
                return (
                  <tr key={lead.id} onClick={() => navigate(`/sales/leads/${lead.id}`)} className="hover:bg-gray-50/70 cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{lead.businessName}</div>
                      <div className="text-xs text-gray-400">{lead.industry} · {lead.city}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{lead.contactName}</div>
                      <div className="text-xs text-gray-400">{lead.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{lead.source.replace('_', ' ')}</td>
                    <td className="px-4 py-3"><Chip tone={meta.tone}>{meta.label}</Chip></td>
                    <td className="px-4 py-3 text-gray-600">{lead.nextFollowUpAt ? dateShort(lead.nextFollowUpAt) : '—'}</td>
                    <td className="px-4 py-3">
                      {needs ? <Chip tone="amber">↩ waiting on you</Chip>
                        : lead.lastOutboundAt ? <span className="text-xs text-gray-400">out {dateShort(lead.lastOutboundAt)}</span>
                        : <span className="text-xs text-gray-400">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TIMELINE (all conversations, newest first) ── */}
      {mode === 'timeline' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-50">
          {timeline.map((c) => {
            const lead = s.leads.find((l) => l.businessName === c.contactableName)
            return (
              <div key={c.id} className={`flex gap-3 px-4 py-3 ${lead ? 'hover:bg-gray-50/70 cursor-pointer' : ''}`}
                onClick={lead ? () => navigate(`/sales/leads/${lead.id}`) : undefined}>
                <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                  c.direction === 'in' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>{c.direction === 'in' ? '←' : '→'}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-gray-900">{c.contactableName}</span>
                    <span className="text-xs text-gray-400">{dateShort(c.at)}</span>
                    {c.templateCode && <span className="font-mono text-[11px] text-gray-400">{c.templateCode}</span>}
                  </div>
                  <div className="text-sm text-gray-700 mt-0.5">{c.snippet}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── CALENDAR (follow-ups) ── */}
      {mode === 'calendar' && (
        <CalendarBoard
          events={s.leads
            .filter((l) => l.nextFollowUpAt && !['won', 'lost'].includes(l.status))
            .map((l) => ({
              key: `lead-${l.id}`,
              date: l.nextFollowUpAt!,
              label: `${l.businessName} follow-up`,
              kind: metaFor(l.status).label,
              tone: metaFor(l.status).tone,
              onClick: () => navigate(`/sales/leads/${l.id}`),
            }))}
        />
      )}
    </>
  )
}
