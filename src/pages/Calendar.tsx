import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/Layout'
import { CalendarBoard, type CalEvent } from '../components/CalendarBoard'
import { useAppState } from '../lib/store'
import { dueTone } from '../lib/format'
import type { Tone } from '../lib/statuses'

/** The calendar overlay (doc 25): no new table — every due date you already
 * have, projected into one month: follow-ups, quote expiry, invoice due,
 * queued messages, credential expiry, device warranty. */
export function Calendar() {
  const s = useAppState()
  const navigate = useNavigate()

  const events: CalEvent[] = []

  for (const l of s.leads) {
    if (l.nextFollowUpAt && !['won', 'lost'].includes(l.status)) {
      events.push({
        key: `followup-${l.id}`,
        date: l.nextFollowUpAt,
        label: `${l.businessName} follow-up`,
        kind: 'lead',
        tone: 'blue',
        onClick: () => navigate(`/sales/leads/${l.id}`),
      })
    }
  }
  for (const p of s.proposals) {
    if (p.status === 'sent' || p.status === 'viewed') {
      events.push({
        key: `prop-${p.id}`,
        date: p.validUntil,
        label: `${p.no} expires · ${p.leadName}`,
        kind: 'quote',
        tone: dueTone(p.validUntil) as Tone,
        onClick: () => navigate('/sales/proposals'),
      })
    }
  }
  for (const i of s.invoices) {
    if (i.status !== 'paid' && i.status !== 'void') {
      events.push({
        key: `inv-${i.id}`,
        date: i.dueAt,
        label: `${i.no} due · ${i.clientName}`,
        kind: 'money',
        tone: dueTone(i.dueAt) as Tone,
        onClick: () => navigate('/money/invoices'),
      })
    }
  }
  for (const o of s.outbox) {
    if (o.status === 'ready' || o.status === 'scheduled') {
      events.push({
        key: `out-${o.id}`,
        date: o.dueAt,
        label: `${o.templateCode} → ${o.contactableName}`,
        kind: 'send',
        tone: o.status === 'ready' ? 'amber' : 'gray',
        onClick: () => navigate('/comms/outbox'),
      })
    }
  }
  for (const c of s.credentials) {
    if (c.expiresAt) {
      events.push({
        key: `cred-${c.id}`,
        date: c.expiresAt,
        label: `${c.provider} credential expires`,
        kind: 'infra',
        tone: 'gray',
        onClick: () => navigate('/projects'),
      })
    }
  }
  for (const dev of s.devices) {
    if (dev.warrantyUntil) {
      events.push({
        key: `dev-${dev.id}`,
        date: dev.warrantyUntil,
        label: `${dev.kind} warranty ends · ${dev.clientName}`,
        kind: 'asset',
        tone: 'gray',
        onClick: () => navigate('/assets'),
      })
    }
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Everything with a date, one month — follow-ups, quotes, invoices, sends, expiries"
        action={<span className="text-sm text-gray-400 tabular-nums">{events.length} upcoming events</span>}
      />
      <CalendarBoard events={events} />
    </>
  )
}
