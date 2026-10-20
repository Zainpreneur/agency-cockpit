import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, SectionCard, EmptyRow } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { PasteReplyModal } from '../components/PasteReplyModal'
import { SendEmailModal } from '../components/SendEmailModal'
import { useAppState, sendOutboxItem } from '../lib/store'
import { dateShort, money } from '../lib/format'
import type { OutboxItem } from '../lib/types'

export function LeadDetail() {
  const { id } = useParams()
  const s = useAppState()
  const lead = s.leads.find((l) => l.id === Number(id))
  const [pasteOpen, setPasteOpen] = useState(false)
  const [sendItem, setSendItem] = useState<OutboxItem | null>(null)

  if (!lead) return <div className="text-sm text-gray-500">Lead not found. <Link className="text-blue-600" to="/sales/leads">Back to board</Link></div>

  const timeline = s.commsLog
    .filter((c) => c.contactableName === lead.businessName)
    .sort((a, b) => b.at.localeCompare(a.at))
  const proposals = s.proposals.filter((p) => p.leadId === lead.id)
  const queued = s.outbox.filter(
    (o) => o.contactableName === lead.businessName && (o.status === 'ready' || o.status === 'scheduled'),
  )

  return (
    <>
      <PageHeader
        title={lead.businessName}
        subtitle={`${lead.contactName} · ${lead.industry} · ${lead.city} · ${lead.source.replace('_', ' ')}`}
        action={
          <div className="flex gap-2">
            <Link to="/sales/leads" className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-2 hover:bg-gray-50">
              ← Board
            </Link>
            <button onClick={() => setPasteOpen(true)} className="rounded-lg bg-gray-900 text-white text-sm font-medium px-4 py-2 hover:bg-gray-800">
              Paste reply
            </button>
          </div>
        }
      />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <SectionCard title="Timeline" hint="email-only v1 — in and out, newest first">
            {timeline.length === 0 && <EmptyRow text="No messages yet." />}
            {timeline.map((c) => (
              <div key={c.id} className="flex gap-3 px-4 py-3">
                <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                  c.direction === 'in' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {c.direction === 'in' ? '←' : '→'}
                </span>
                <div className="min-w-0">
                  <div className="text-sm text-gray-800">{c.snippet}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {dateShort(c.at)} {c.templateCode && `· ${c.templateCode}`}
                  </div>
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Proposals">
            {proposals.length === 0 && <EmptyRow text="No proposals yet — build one." />}
            {proposals.map((p) => (
              <Link key={p.id} to="/sales/proposals" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div>
                  <div className="text-sm font-medium text-gray-900">{p.no}</div>
                  <div className="text-xs text-gray-500">valid until {dateShort(p.validUntil)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">{money(p.offeredPrice)}</span>
                  <StatusChip status={p.status} />
                </div>
              </Link>
            ))}
          </SectionCard>

          <SectionCard title="Queued messages" hint="reply-cancels-pending is automatic">
            {queued.length === 0 && <EmptyRow text="Nothing queued." />}
            {queued.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{o.subject}</div>
                  <div className="text-xs text-gray-500">{o.templateCode} · due {dateShort(o.dueAt)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusChip status={o.status} domain="outbox" />
                  <button onClick={() => setSendItem(o)} className="rounded-lg bg-blue-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-blue-700">
                    Send
                  </button>
                </div>
              </div>
            ))}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900">Status</span>
              <StatusChip status={lead.status} />
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Phone</dt><dd className="font-medium">{lead.phone}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Email</dt><dd className="font-medium truncate max-w-[160px]">{lead.email}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Source</dt><dd className="font-medium capitalize">{lead.source.replace('_', ' ')}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Next follow-up</dt><dd className="font-medium">{dateShort(lead.nextFollowUpAt)}</dd></div>
            </dl>
            {lead.notes && (
              <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 leading-relaxed">{lead.notes}</p>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-900 mb-2">Conversation stage</div>
            <div className="flex flex-wrap gap-1.5">
              {['contacted', 'demo_shared', 'proposal_sent', 'negotiating', 'won'].map((stage) => (
                <Chip key={stage} tone={stage === lead.status ? 'blue' : 'gray'}>
                  {stage.replace('_', ' ')}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Stages come from doc 26 — the board and this page use the same transitions.</p>
          </section>
        </div>
      </div>

      <PasteReplyModal lead={pasteOpen ? lead : null} onClose={() => setPasteOpen(false)} />
      <SendEmailModal item={sendItem} onClose={() => setSendItem(null)} />
    </>
  )
}
