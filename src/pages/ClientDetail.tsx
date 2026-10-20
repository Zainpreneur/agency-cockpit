import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, SectionCard, EmptyRow } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { PasteReplyModal } from '../components/PasteReplyModal'
import { SendEmailModal } from '../components/SendEmailModal'
import { CascadeConfirmModal } from '../components/CascadeConfirmModal'
import { useAppState } from '../lib/store'
import { money, dateShort, dueLabel, daysBetween } from '../lib/format'
import type { Invoice, OutboxItem } from '../lib/types'

const STATUS_TONE = { active: 'green', delivered: 'blue', archived: 'gray' } as const

/** 360° view (doc 25): everything about one client on one screen —
 * projects, money, messages, quotes, machines, deployments. */
export function ClientDetail() {
  const { id } = useParams()
  const s = useAppState()
  const client = s.clients.find((c) => c.id === Number(id))
  const [sendItem, setSendItem] = useState<OutboxItem | null>(null)
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)

  if (!client) {
    return (
      <div className="text-sm text-gray-500">
        Client not found. <Link className="text-blue-600" to="/clients">Back to clients</Link>
      </div>
    )
  }

  const name = client.name
  const projects = s.projects.filter((p) => p.clientName === name)
  const invoices = s.invoices.filter((i) => i.clientName === name)
  const openInvoices = invoices.filter((i) => i.status !== 'paid' && i.status !== 'void')
  const overdue = openInvoices.filter((i) => i.status === 'overdue')
  const proposals = s.proposals.filter((p) => p.leadName === name)
  const timeline = s.commsLog.filter((c) => c.contactableName === name).sort((a, b) => b.at.localeCompare(a.at))
  const deploys = s.deployTargets.filter((d) => d.clientName === name)
  const devices = s.devices.filter((d) => d.clientName === name)
  const pos = s.purchaseOrders.filter((po) => projects.some((p) => p.name === po.project))
  const blocked = s.payouts.filter(
    (p) => p.status === 'blocked' && invoices.some((i) => i.id === p.triggerInvoiceId),
  )
  const queued = s.outbox.filter(
    (o) => o.contactableName === name && (o.status === 'ready' || o.status === 'scheduled'),
  )

  const health: { tone: 'red' | 'amber' | 'blue' | 'green'; label: string }[] = []
  if (overdue.length) health.push({ tone: 'red', label: `${overdue.length} invoice overdue` })
  else if (openInvoices.length) health.push({ tone: 'amber', label: `${openInvoices.length} invoice open` })
  else health.push({ tone: 'green', label: 'money settled' })
  if (projects.some((p) => p.status !== 'delivered')) health.push({ tone: 'blue', label: 'active project' })
  if (deploys.some((d) => d.status === 'degraded')) health.push({ tone: 'red', label: 'deployment degraded' })

  return (
    <>
      <PageHeader
        title={name}
        subtitle={`${client.contactName} · ${client.industry} · ${client.city} · client since ${dateShort(client.since)}`}
        action={
          <div className="flex gap-2">
            <Link to="/clients" className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-2 hover:bg-gray-50">← Clients</Link>
            <button onClick={() => setPasteOpen(true)} className="rounded-lg bg-gray-900 text-white text-sm font-medium px-4 py-2 hover:bg-gray-800">
              Paste reply
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5 mb-4">
        <Chip tone={STATUS_TONE[client.status]}>{client.status}</Chip>
        {health.map((h) => <Chip key={h.label} tone={h.tone}>{h.label}</Chip>)}
        {blocked.length > 0 && (
          <Chip tone="gray" title="Team/investor payouts waiting on this client">
            {blocked.length} payout{blocked.length === 1 ? '' : 's'} blocked on them
          </Chip>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="Projects">
            {projects.length === 0 && <EmptyRow text="No projects yet." />}
            {projects.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.phase}</div>
                </div>
                <Chip tone={p.fundedBy === 'investor_advance' ? 'blue' : 'gray'}>
                  {p.fundedBy === 'investor_advance' ? 'investor advance' : 'own cash'}
                </Chip>
                <span className="text-sm font-semibold tabular-nums">{money(p.stake)}</span>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Invoices" hint="overdue first · mark paid previews the cascade">
            {invoices.length === 0 && <EmptyRow text="No invoices yet." />}
            {[...invoices].sort((a, b) => (a.status === 'paid' ? 1 : 0) - (b.status === 'paid' ? 1 : 0)).map((inv) => (
              <div key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="text-sm font-medium text-gray-900">{inv.no}</span>
                <span className="text-sm tabular-nums font-semibold">{money(inv.total)}</span>
                <StatusChip status={inv.status} domain="invoice" />
                <span className="text-xs text-gray-500">{dueLabel(inv.dueAt, inv.paidAt)}</span>
                <div className="ml-auto flex gap-1.5">
                  {(inv.status === 'sent' || inv.status === 'viewed' || inv.status === 'overdue') && (
                    <>
                      <button
                        onClick={() => setSendItem({
                          id: -200 - inv.id, contactableName: name, stakeholder: 'client',
                          templateCode: 'invoice_reminder_1', subject: `Friendly reminder — ${inv.no}`,
                          body: `Hi ${client.contactName},\n\nA quick reminder that ${inv.no} (${money(inv.total)}) was due on ${dateShort(inv.dueAt)}. Anything blocking payment — happy to talk it through.\n\nThank you,\nZain`,
                          dueAt: new Date().toISOString(), status: 'ready',
                        })}
                        className="rounded-lg bg-white text-gray-600 ring-1 ring-gray-300 text-xs font-medium px-3 py-1.5 hover:bg-gray-50"
                      >Remind</button>
                      <button onClick={() => setPayInvoice(inv)} className="rounded-lg bg-gray-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-gray-800">
                        Mark paid
                      </button>
                    </>
                  )}
                  {inv.status === 'draft' && <Chip tone="gray">draft — not sent</Chip>}
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Timeline" hint="email-only v1 — paste replies to log what they said">
            {timeline.length === 0 && <EmptyRow text="No messages yet." />}
            {timeline.slice(0, 8).map((c) => (
              <div key={c.id} className="flex gap-3 px-4 py-2.5">
                <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                  c.direction === 'in' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>{c.direction === 'in' ? '←' : '→'}</span>
                <div className="min-w-0">
                  <div className="text-sm text-gray-800">{c.snippet}</div>
                  <div className="text-xs text-gray-400">{dateShort(c.at)}{c.templateCode ? ` · ${c.templateCode}` : ''}</div>
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Quotes">
            {proposals.length === 0 && <EmptyRow text="No proposals for this client." />}
            {proposals.map((p) => (
              <Link key={p.id} to="/sales/proposals" className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div>
                  <div className="text-sm font-medium text-gray-900">{p.no}</div>
                  <div className="text-xs text-gray-500">valid to {dateShort(p.validUntil)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">{money(p.offeredPrice)}</span>
                  <StatusChip status={p.status} />
                </div>
              </Link>
            ))}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Contact</div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-gray-500 shrink-0">Person</dt><dd className="font-medium text-right">{client.contactName}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-gray-500 shrink-0">Phone</dt><dd className="font-medium text-right">{client.phone}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-gray-500 shrink-0">Email</dt><dd className="font-medium text-right break-all">{client.email}</dd></div>
            </dl>
            <a
              href={`mailto:${client.email}`}
              className="mt-3 block text-center rounded-lg bg-blue-600 text-white text-xs font-medium px-3 py-2 hover:bg-blue-700"
            >
              Open mail app
            </a>
            {client.notes && <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 leading-relaxed">{client.notes}</p>}
          </section>

          <SectionCard title="Deployments">
            {deploys.length === 0 && <EmptyRow text="None yet." />}
            {deploys.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 font-mono truncate">{d.name}</div>
                  <div className="text-xs text-gray-400">{d.provider.replace('_', ' ')} · {d.version}</div>
                </div>
                <StatusChip status={d.status} />
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Machines on site">
            {devices.length === 0 && <EmptyRow text="No devices registered." />}
            <div className="grid grid-cols-2 gap-2 p-3">
              {devices.map((dev) => (
                <div key={dev.id} className="rounded-lg border border-gray-100 overflow-hidden">
                  <div className="h-14 flex items-center justify-center text-lg"
                    style={{ background: `linear-gradient(135deg, hsl(${dev.imageHue} 65% 90%), hsl(${(dev.imageHue + 30) % 360} 65% 80%))` }}>📷</div>
                  <div className="px-2 py-1.5">
                    <div className="text-xs font-semibold text-gray-900 truncate">{dev.kind}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{dev.serial}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Purchase orders">
            {pos.length === 0 && <EmptyRow text="No POs for their projects." />}
            {pos.map((po) => (
              <div key={po.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">{po.no} · {po.vendor}</div>
                  <div className="text-xs text-gray-400 truncate">{po.project}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusChip status={po.status} />
                  <span className="text-xs tabular-nums font-medium">{money(po.total)}</span>
                </div>
              </div>
            ))}
          </SectionCard>

          {queued.length > 0 && (
            <SectionCard title="Queued messages">
              {queued.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm text-gray-800 truncate">{o.subject}</div>
                    <div className="text-xs text-gray-400">{o.templateCode} · {dateShort(o.dueAt)}</div>
                  </div>
                  <button onClick={() => setSendItem(o)} className="shrink-0 rounded-lg bg-blue-600 text-white text-xs font-medium px-2.5 py-1.5 hover:bg-blue-700">
                    Send
                  </button>
                </div>
              ))}
            </SectionCard>
          )}

          <div className="text-[11px] text-gray-400 leading-relaxed">
            {daysBetween(client.since) > 0 && <>Relationship open {Math.round(daysBetween(client.since) / 30)} months · </>}
            everything here derives from existing rows — no double entry.
          </div>
        </div>
      </div>

      <PasteReplyModal lead={pasteOpen ? { businessName: name } : null} onClose={() => setPasteOpen(false)} />
      <SendEmailModal item={sendItem} onClose={() => setSendItem(null)} />
      <CascadeConfirmModal invoice={payInvoice} onClose={() => setPayInvoice(null)} />
    </>
  )
}
