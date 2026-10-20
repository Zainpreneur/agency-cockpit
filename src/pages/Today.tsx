import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { SendEmailModal } from '../components/SendEmailModal'
import { PasteReplyModal } from '../components/PasteReplyModal'
import { CascadeConfirmModal } from '../components/CascadeConfirmModal'
import { useAppState, needsReplyLeads, cascadePreview, sendInvoice } from '../lib/store'
import { money, dateShort, dueLabel, dueTone, daysBetween } from '../lib/format'
import type { Invoice, Lead, OutboxItem } from '../lib/types'

/** Row template used by every queue section: subject left, meta, action right. */
function QueueRow({
  icon,
  title,
  meta,
  chip,
  actions,
}: {
  icon: string
  title: React.ReactNode
  meta: React.ReactNode
  chip?: React.ReactNode
  actions: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-gray-50/70 transition">
      <span className="text-base leading-none w-5 text-center shrink-0" aria-hidden>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-900 truncate">{title}</div>
        <div className="text-xs text-gray-500 truncate">{meta}</div>
      </div>
      {chip}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto">{actions}</div>
    </div>
  )
}

const btn = 'rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition'
const btnPrimary = `${btn} bg-gray-900 text-white ring-gray-900 hover:bg-gray-800`
const btnBlue = `${btn} bg-blue-600 text-white ring-blue-600 hover:bg-blue-700`
const btnGhost = `${btn} bg-white text-gray-600 ring-gray-300 hover:bg-gray-50`

export function Today() {
  const s = useAppState()
  const [sendItem, setSendItem] = useState<OutboxItem | null>(null)
  const [pasteLead, setPasteLead] = useState<Lead | null>(null)
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null)

  const todayEnd = new Date().setHours(23, 59, 59, 999)
  const weekEnd = Date.now() + 7 * 86_400_000

  const needsReply = useMemo(() => needsReplyLeads(), [s])

  const sendToday = s.outbox.filter(
    (o) => o.status === 'ready' && new Date(o.dueAt).getTime() <= todayEnd,
  )
  const overdue = s.invoices.filter((i) => i.status === 'overdue')
  const readyInvoices = s.invoices.filter((i) => i.status === 'draft')
  const stuckPo = s.purchaseOrders.filter(
    (p) => p.status === 'ordered' && p.orderedAt && daysBetween(p.orderedAt) >= 5,
  )
  const badDeploys = s.deployTargets.filter((t) => t.status === 'degraded' || t.status === 'pending_agent')
  const expiring = s.proposals.filter(
    (p) => (p.status === 'sent' || p.status === 'viewed') && new Date(p.validUntil).getTime() <= weekEnd,
  )
  const scheduledSoon = s.outbox.filter(
    (o) =>
      o.status === 'scheduled' &&
      new Date(o.dueAt).getTime() <= weekEnd &&
      new Date(o.dueAt).getTime() > todayEnd,
  )
  const blocked = s.payouts.filter((p) => p.status === 'blocked')
  const payable = s.payouts.filter((p) => p.status === 'payable')

  const moneyAtRisk =
    overdue.reduce((a, i) => a + i.total, 0)

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · drain the queues, then you are done'}
        action={
          <Link to="/sales/proposals/new" className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700">
            + New proposal
          </Link>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Needs your reply" value={String(needsReply.length)} tone={needsReply.length ? 'amber' : 'green'} />
        <Stat label="Messages to send" value={String(sendToday.length)} />
        <Stat label="Overdue money" value={money(moneyAtRisk)} tone={moneyAtRisk ? 'red' : 'green'} />
        <Stat label="Blocked payouts" value={String(blocked.length)} />
      </div>

      <div className="space-y-4">
        {/* 1 — needs reply */}
        <SectionCard title="Needs your reply" hint="paste what they said, the app does the rest">
          {needsReply.length === 0 && <EmptyRow text="Nothing waiting — inbox zero ✓" />}
          {needsReply.map((lead) => {
            const lastIn = [...s.commsLog]
              .filter((c) => c.contactableName === lead.businessName && c.direction === 'in')
              .sort((a, b) => b.at.localeCompare(a.at))[0]
            return (
              <QueueRow
                key={lead.id}
                icon="↩"
                title={lead.businessName}
                meta={`“${lastIn?.snippet ?? ''}”`}
                chip={<Chip tone="amber">waiting since {dateShort(lastIn?.at)}</Chip>}
                actions={
                  <>
                    <button className={btnPrimary} onClick={() => setPasteLead(lead)}>Paste reply</button>
                    <Link className={btnGhost} to={`/sales/leads/${lead.id}`}>Open</Link>
                  </>
                }
              />
            )
          })}
        </SectionCard>

        {/* 2 — send today */}
        <SectionCard title="Send today" hint="copy → mail app → mark sent">
          {sendToday.length === 0 && <EmptyRow text="Nothing scheduled for today." />}
          {sendToday.map((o) => (
            <QueueRow
              key={o.id}
              icon="✉"
              title={o.subject}
              meta={`${o.contactableName} · ${o.templateCode}`}
              chip={<Chip tone="amber">due {dueLabel(o.dueAt)}</Chip>}
              actions={
                <>
                  <button className={btnBlue} onClick={() => setSendItem(o)}>Copy + Send</button>
                  <Link className={btnGhost} to="/comms/outbox">Outbox</Link>
                </>
              }
            />
          ))}
        </SectionCard>

        {/* 3 — money */}
        <SectionCard title="Money" hint="overdue first, ready-to-send next">
          {overdue.length === 0 && readyInvoices.length === 0 && <EmptyRow text="All settled." />}
          {overdue.map((inv) => (
            <QueueRow
              key={inv.id}
              icon="⚠"
              title={`${inv.no} — ${inv.clientName}`}
              meta={money(inv.total)}
              chip={<StatusChip status={inv.status} domain="invoice" title={dueLabel(inv.dueAt)} />}
              actions={
                <>
                  <button className={btnBlue} onClick={() => setSendItem({
                    id: -1, contactableName: inv.clientName, stakeholder: 'client',
                    templateCode: 'invoice_reminder_1', subject: `Friendly reminder — ${inv.no}`,
                    body: `Hi,\n\nA quick reminder that ${inv.no} (${money(inv.total)}) was due on ${dateShort(inv.dueAt)}. Let me know if anything is blocking payment.\n\nThank you,\nZain`,
                    dueAt: new Date().toISOString(), status: 'ready',
                  })}>Remind</button>
                  <button className={btnPrimary} onClick={() => setPayInvoice(inv)}>Mark paid</button>
                </>
              }
            />
          ))}
          {readyInvoices.map((inv) => (
            <QueueRow
              key={inv.id}
              icon="→"
              title={`${inv.no} — ${inv.clientName} (ready to send)`}
              meta={money(inv.total)}
              chip={<StatusChip status={inv.status} domain="invoice" />}
              actions={
                <>
                  <button className={btnBlue} onClick={() => sendInvoice(inv.id)}>Send invoice</button>
                </>
              }
            />
          ))}
        </SectionCard>

        {/* 4 — blockers */}
        <SectionCard title="Blockers" hint="nothing moves until these clear">
          {stuckPo.length === 0 && badDeploys.length === 0 && <EmptyRow text="No blockers." />}
          {stuckPo.map((po) => (
            <QueueRow
              key={po.id}
              icon="⛬"
              title={`${po.no} — ${po.vendor} still “ordered”`}
              meta={`${po.project} · ${money(po.total)}${po.fundedBy === 'investor_advance' ? ' · investor advance' : ''}`}
              chip={<Chip tone="amber">waiting {daysBetween(po.orderedAt!)}d</Chip>}
              actions={<Link className={btnGhost} to="/projects">Open</Link>}
            />
          ))}
          {badDeploys.map((t) => (
            <QueueRow
              key={t.id}
              icon="⚙"
              title={`${t.name} — ${t.status === 'degraded' ? 'deployment degraded' : 'office VPS agent not installed'}`}
              meta={`${t.clientName} · ${t.provider} · ${t.version}`}
              chip={<StatusChip status={t.status} domain={undefined} />}
              actions={<Link className={btnGhost} to="/projects">Open</Link>}
            />
          ))}
        </SectionCard>

        {/* 5 — this week */}
        <SectionCard title="This week" hint="expiries + scheduled sends">
          {expiring.length === 0 && scheduledSoon.length === 0 && <EmptyRow text="Nothing time-sensitive." />}
          {expiring.map((p) => (
            <QueueRow
              key={p.id}
              icon="⏱"
              title={`${p.no} — ${p.leadName}`}
              meta={`${money(p.offeredPrice)} · offered`}
              chip={<Chip tone={dueTone(p.validUntil) as 'amber' | 'red'}>expires {dateShort(p.validUntil)}</Chip>}
              actions={<Link className={btnGhost} to="/sales/proposals">Open</Link>}
            />
          ))}
          {scheduledSoon.map((o) => (
            <QueueRow
              key={o.id}
              icon="📅"
              title={o.subject}
              meta={`${o.contactableName} · ${o.templateCode}`}
              chip={<Chip tone="gray">scheduled {dateShort(o.dueAt)}</Chip>}
              actions={<button className={btnBlue} onClick={() => setSendItem(o)}>Send now</button>}
            />
          ))}
        </SectionCard>

        {/* payout pulses */}
        {(payable.length > 0 || blocked.length > 0) && (
          <SectionCard title="Payouts" hint="payable = money is in; blocked = waiting on a client payment">
            {payable.map((p) => (
              <QueueRow
                key={p.id}
                icon="✓"
                title={`${p.payee} — ${p.kind.replace('_', ' ')}`}
                meta={p.note}
                chip={<StatusChip status={p.status} domain="payout" />}
                actions={<Link className={btnGhost} to="/money/payouts">Release</Link>}
              />
            ))}
            {blocked.map((p) => (
              <QueueRow
                key={p.id}
                icon="⏳"
                title={`${p.payee} — ${p.kind.replace('_', ' ')}`}
                meta={`${p.note} · unlocks when ${s.invoices.find((i) => i.id === p.triggerInvoiceId)?.no ?? 'the client'} pays`}
                chip={<StatusChip status={p.status} domain="payout" />}
                actions={<Link className={btnGhost} to="/money/payouts">Details</Link>}
              />
            ))}
          </SectionCard>
        )}
      </div>

      <SendEmailModal item={sendItem} onClose={() => setSendItem(null)} />
      <PasteReplyModal lead={pasteLead} onClose={() => setPasteLead(null)} />
      <CascadeConfirmModal invoice={payInvoice} onClose={() => setPayInvoice(null)} />
    </>
  )
}
