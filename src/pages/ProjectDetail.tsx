import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { PasteReplyModal } from '../components/PasteReplyModal'
import { SendEmailModal } from '../components/SendEmailModal'
import { CascadeConfirmModal } from '../components/CascadeConfirmModal'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { useAppState, markInvoicePaid, advancePurchaseOrder, updateProject, deleteProject } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'
import { Waterfall } from '../components/Waterfall'
import type { Invoice, OutboxItem, Project, PurchaseOrder, DeployTarget, Credential, ClientDevice } from '../lib/types'

const PROJECT_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Project name', required: true },
  { key: 'clientName', label: 'Client', required: true },
  { key: 'phase', label: 'Phase', placeholder: 'kicked off · building · installing…' },
  {
    key: 'status', label: 'Status', type: 'select',
    options: [
      { value: 'proposal', label: 'Proposal' },
      { value: 'procurement', label: 'Procurement' },
      { value: 'building', label: 'Building' },
      { value: 'deploying', label: 'Deploying' },
      { value: 'delivered', label: 'Delivered' },
      { value: 'maintenance', label: 'Maintenance' },
    ],
  },
  {
    key: 'fundedBy', label: 'Funded by', type: 'select',
    options: [
      { value: 'own_cash', label: 'Own cash' },
      { value: 'investor_advance', label: 'Investor advance' },
    ],
  },
  { key: 'stake', label: 'Stake (SAR)', type: 'number', min: 0 },
]

type Tab = 'overview' | 'build' | 'money' | 'comms' | 'assets'

export function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const s = useAppState()
  const project = s.projects.find((p) => p.id === Number(id))
  const [tab, setTab] = useState<Tab>('overview')
  const [sendItem, setSendItem] = useState<OutboxItem | null>(null)
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  if (!project) {
    return (
      <div className="text-sm text-gray-500">
        Project not found. <Link className="text-blue-600" to="/projects">Back to projects</Link>
      </div>
    )
  }

  const pos = s.purchaseOrders.filter((po) => po.project === project.name)
  const invoices = s.invoices.filter((inv) => pos.some((po) => po.project === project.name))
  const openInvoices = invoices.filter((i) => i.status !== 'paid' && i.status !== 'void')
  const overdue = openInvoices.filter((i) => i.status === 'overdue')
  const deploys = s.deployTargets.filter((d) => d.clientName === project.clientName)
  const devices = s.devices.filter((d) => d.clientName === project.clientName)
  const timeline = s.commsLog.filter((c) => c.contactableName === project.clientName).sort((a, b) => b.at.localeCompare(a.at))
  const statusEvents = s.statusEvents.filter((e) => e.entity === 'project' && e.entityId === project.id).sort((a, b) => b.at.localeCompare(a.at))
  const investorRounds = s.fundingRounds.filter((r) => r.project === project.name)
  const blockedPayouts = s.payouts.filter(
    (p) => p.status === 'blocked' && invoices.some((i) => i.id === p.triggerInvoiceId)
  )

  // Money tab data
  const projectRevenue = invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + i.total, 0)
  const projectCosts = pos.filter((po) => po.status === 'invoiced').reduce((a, po) => a + po.total, 0)
  const projectMargin = projectRevenue - projectCosts
  const marginPct = projectRevenue ? Math.round((projectMargin / projectRevenue) * 100) : 0

  // Investor waterfall data if investor-advance
  const isInvestorAdvance = project.fundedBy === 'investor_advance'
  const totalInvestorDeployed = investorRounds.reduce((a, r) => a + r.raised, 0)
  const totalInvestorReturned = s.payouts
    .filter((p) => p.payeeRole === 'investor' && invoices.some((i) => i.id === p.triggerInvoiceId))
    .reduce((a, p) => a + p.amount, 0)

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={project.clientName}
        action={
          <div className="flex gap-2 flex-wrap">
            <Link to="/projects" className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-2 hover:bg-gray-50">← Projects</Link>
            <button onClick={() => setEditOpen(true)} className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-2 hover:bg-gray-50">✎ Edit</button>
            <button onClick={() => setPasteOpen(true)} className="rounded-lg bg-gray-900 text-white text-sm font-medium px-4 py-2 hover:bg-gray-800">Paste reply</button>
            <button onClick={() => setDeleteConfirm(true)} className="rounded-lg border border-red-300 text-red-600 text-sm font-medium px-4 py-2 hover:bg-red-50">Delete</button>
          </div>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-gray-200" role="tablist">
        {(['overview', 'build', 'money', 'comms', 'assets'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? 'bg-white text-gray-900 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <SectionCard title="Health & Next Action">
                <div className="flex flex-wrap gap-2 mb-3">
                  <StatusChip status={project.status} />
                  <Chip tone={project.fundedBy === 'investor_advance' ? 'blue' : 'gray'}>
                    {project.fundedBy === 'investor_advance' ? 'Investor advance' : 'Own cash'}
                  </Chip>
                  {overdue.length > 0 && <Chip tone="red">{overdue.length} invoice overdue</Chip>}
                  {openInvoices.length > 0 && overdue.length === 0 && <Chip tone="amber">{openInvoices.length} invoice open</Chip>}
                  {blockedPayouts.length > 0 && <Chip tone="gray">{blockedPayouts.length} payout blocked</Chip>}
                  {deploys.some((d) => d.status === 'degraded') && <Chip tone="red">Deployment degraded</Chip>}
                </div>
                <div className="text-sm text-gray-600">
                  {project.phase || 'No phase set — add one in Edit'}
                </div>
              </SectionCard>

              <SectionCard title="Timeline" hint="status events + messages (most recent first)">
                {timeline.length === 0 && statusEvents.length === 0 && <EmptyRow text="No activity yet." />}
                {[
                  ...timeline.slice(0, 6).map((c) => ({
                    id: `comms-${c.id}`,
                    time: c.at,
                    type: 'comms' as const,
                    direction: c.direction,
                    snippet: c.snippet,
                    meta: c.templateCode,
                  })),
                  ...statusEvents.slice(0, 6).map((e) => ({
                    id: `event-${e.id}`,
                    time: e.at,
                    type: 'event' as const,
                    from: e.from,
                    to: e.to,
                    note: e.note,
                  })),
                ]
                  .sort((a, b) => b.time.localeCompare(a.time))
                  .slice(0, 8)
                  .map((item) => (
                    <div key={item.id} className="flex gap-3 px-4 py-2.5">
                      <span
                        className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                          item.type === 'comms'
                            ? (item as any).direction === 'in'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-500'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {item.type === 'comms'
                          ? (item as any).direction === 'in'
                            ? '←'
                            : '→'
                          : '◆'}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm text-gray-800">
                          {item.type === 'comms'
                            ? (item as any).snippet
                            : `Status: ${(item as any).from} → ${(item as any).to}`}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-2">
                          {dateShort(item.time)}
                          {(item as any).meta && <span className="font-mono text-[11px] text-gray-400">{(item as any).meta}</span>}
                          {(item as any).note && <span className="text-gray-500">— {(item as any).note}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
              </SectionCard>
            </div>

            <div className="space-y-4">
              <SectionCard title="Contact">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2"><dt className="text-gray-500 shrink-0">Client</dt><dd className="font-medium text-right">{project.clientName}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-gray-500 shrink-0">Funded by</dt><dd className="font-medium text-right">{project.fundedBy === 'investor_advance' ? 'Investor advance' : 'Own cash'}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-gray-500 shrink-0">Stake</dt><dd className="font-medium text-right">{money(project.stake)}</dd></div>
                </dl>
              </SectionCard>

              <SectionCard title="Quick Stats">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Revenue" value={money(projectRevenue)} tone="green" />
                  <Stat label="Cost (invoiced POs)" value={money(projectCosts)} tone="red" />
                  <Stat label="Margin" value={money(projectMargin)} tone={projectMargin >= 0 ? 'green' : 'red'} />
                  <Stat label="Margin %" value={marginPct + '%'} tone={marginPct >= 25 ? 'green' : projectMargin < 0 ? 'red' : 'amber'} />
                </div>
              </SectionCard>

              {isInvestorAdvance && totalInvestorDeployed > 0 && (
                <SectionCard title="Investor Waterfall" hint="capital stack visual — tiers clear in order">
                  <Waterfall
                    tiers={[
                      { label: 'Principal return (1×)', threshold: 1, type: 'multiple', color: '#10b981', description: 'return of capital' },
                      { label: 'Preferred return (15%)', threshold: 0.15, type: 'multiple', color: '#3b82f6', description: 'hurdle' },
                      { label: 'Carry (20% of excess)', threshold: 1.15, type: 'revenue_share', color: '#f59e0b', description: 'split above hurdle' },
                    ]}
                    totalDeployed={totalInvestorDeployed}
                    totalReturned={totalInvestorReturned}
                  />
                </SectionCard>
              )}
            </div>
          </div>
        )}

        {/* BUILD */}
        {tab === 'build' && (
          <div className="space-y-4">
            <SectionCard title="Module Orders" hint="requested → … → invoiced (board in projects list)">
              <EmptyRow text="Module orders board lives on the Projects page — filter by this project to see your build pipeline." />
            </SectionCard>

            <SectionCard title="Purchase Orders" action={
              <Link to="/projects" className="text-sm text-blue-600 hover:underline">Manage on Projects page →</Link>
            }>
              {pos.length === 0 && <EmptyRow text="No POs yet." />}
              {pos.map((po) => (
                <div key={po.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900">{po.no}</div>
                    <div className="text-xs text-gray-500">{po.vendor} · {po.items.map((i) => `${i.qty}× ${i.description}`).join(' · ')}</div>
                  </div>
                  {po.fundedBy === 'investor_advance' && <Chip tone="blue">investor advance</Chip>}
                  <StatusChip status={po.status} />
                  <span className="text-sm font-semibold tabular-nums ml-auto">{money(po.total)}</span>
                  {({ draft: 'Order', ordered: 'Mark received', received: 'Mark installed', installed: 'Mark invoiced' } as Record<string, string>)[po.status] && (
                    <button
                      onClick={() => advancePurchaseOrder(po.id)}
                      className="rounded-lg bg-gray-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-gray-800"
                    >
                      {({ draft: 'Order', ordered: 'Mark received', received: 'Mark installed', installed: 'Mark invoiced' } as Record<string, string>)[po.status]} →
                    </button>
                  )}
                  <RowActions
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Deploy Targets" hint="office VPS runs the pull-agent — W15 rollback is one click in v2" action={
              <Link to="/projects" className="text-sm text-blue-600 hover:underline">Manage on Projects page →</Link>
            }>
              {deploys.length === 0 && <EmptyRow text="No deploy targets for this client." />}
              {deploys.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 font-mono">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.provider.replace('_', ' ')} · {t.env} · {t.version}</div>
                  </div>
                  {t.behindBy > 0 && <Chip tone="amber" title="Commits behind the deployed tag">{t.behindBy} behind</Chip>}
                  <StatusChip status={t.status} />
                  <span className="text-xs text-gray-400">{t.lastDeployAt ? `deployed ${dateShort(t.lastDeployAt)}` : 'never'}</span>
                  <RowActions onEdit={() => {}} onDelete={() => {}} />
                </div>
              ))}
            </SectionCard>
          </div>
        )}

        {/* MONEY */}
        {tab === 'money' && (
          <div className="space-y-4">
            <SectionCard title="Invoices" hint="overdue first · mark paid previews cascade">
              {invoices.length === 0 && <EmptyRow text="No invoices yet." />}
              {[...invoices].sort((a, b) => (a.status === 'paid' ? 1 : 0) - (b.status === 'paid' ? 1 : 0)).map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                  <span className="text-sm font-medium text-gray-900">{inv.no}</span>
                  <span className="text-sm tabular-nums font-semibold">{money(inv.total)}</span>
                  <StatusChip status={inv.status} domain="invoice" />
                  <span className="text-xs text-gray-500">{dateShort(inv.dueAt)}{inv.paidAt ? ` · paid ${dateShort(inv.paidAt)}` : ''}</span>
                  <div className="ml-auto flex gap-1.5">
                    {(inv.status === 'sent' || inv.status === 'viewed' || inv.status === 'overdue') && (
                      <>
                        <button
                          onClick={() => setSendItem({
                            id: -200 - inv.id, contactableName: project.clientName, stakeholder: 'client',
                            templateCode: 'invoice_reminder_1', subject: `Friendly reminder — ${inv.no}`,
                            body: `Hi,\n\nA quick reminder that ${inv.no} (${money(inv.total)}) was due on ${dateShort(inv.dueAt)}. Let me know if anything is blocking payment.\n\nThank you,\nZain`,
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

            <SectionCard title="Payouts (project-scoped)">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Team paid" value={money(s.payouts.filter(p => p.payeeRole === 'team' && invoices.some(i => i.id === p.triggerInvoiceId)).reduce((a, p) => a + p.amount, 0))} tone="green" />
                <Stat label="Investor paid" value={money(totalInvestorReturned)} tone="green" />
                <Stat label="Team pending" value={money(s.payouts.filter(p => p.payeeRole === 'team' && p.status !== 'paid' && invoices.some(i => i.id === p.triggerInvoiceId)).reduce((a, p) => a + p.amount, 0))} tone="amber" />
                <Stat label="Investor blocked" value={money(blockedPayouts.filter(p => p.payeeRole === 'investor').reduce((a, p) => a + p.amount, 0))} tone="red" />
              </div>
            </SectionCard>

            <SectionCard title="Funding Rounds" hint={isInvestorAdvance ? 'investor-advance project' : 'own-cash project'}>
              {investorRounds.length === 0 && <EmptyRow text={isInvestorAdvance ? 'No funding rounds linked to this project.' : 'This project is own-cash funded.'} />}
              {investorRounds.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900">{r.project}</div>
                    <div className="text-xs text-gray-500">
                      {r.rule === 'fixed' ? 'fixed return' : r.rule === 'multiple' ? '× multiple' : 'revenue share'} · {r.sourceKind.replace('_', ' ')}
                    </div>
                  </div>
                  <Chip tone={r.status === 'seeking' ? 'amber' : r.status === 'funded' ? 'green' : 'blue'}>
                    {money(r.raised)} / {money(r.target)}
                  </Chip>
                  <Chip tone="gray">{r.status}</Chip>
                </div>
              ))}
            </SectionCard>
          </div>
        )}

        {/* COMMS */}
        {tab === 'comms' && (
          <SectionCard title="Message Timeline" hint="email-only v1 — paste replies to log what they said">
            {timeline.length === 0 && <EmptyRow text="No messages yet." />}
            {timeline.map((c) => (
              <div key={c.id} className="flex gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${c.direction === 'in' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{c.direction === 'in' ? '←' : '→'}</span>
                <div className="min-w-0">
                  <div className="text-sm text-gray-800">{c.snippet}</div>
                  <div className="text-xs text-gray-400">{dateShort(c.at)}{c.templateCode ? ` · ${c.templateCode}` : ''}</div>
                </div>
              </div>
            ))}
          </SectionCard>
        )}

        {/* ASSETS */}
        {tab === 'assets' && (
          <SectionCard title="Machines on Site" hint="serials, warranties, provenance from POs">
            {devices.length === 0 && <EmptyRow text="No devices registered for this client." />}
            <div className="grid grid-cols-2 gap-2 p-3">
              {devices.map((dev) => (
                <div key={dev.id} className="rounded-lg border border-gray-100 overflow-hidden">
                  <div className="h-14 flex items-center justify-center text-lg"
                    style={{ background: `linear-gradient(135deg, hsl(${dev.imageHue} 65% 90%), hsl(${(dev.imageHue + 30) % 360} 65% 80%))` }}>📷</div>
                  <div className="px-2 py-1.5">
                    <div className="text-xs font-semibold text-gray-900 truncate">{dev.kind}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{dev.serial}</div>
                    {dev.warrantyUntil && <div className="text-[10px] text-amber-600">warranty until {dateShort(dev.warrantyUntil)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      <PasteReplyModal lead={pasteOpen ? { businessName: project.clientName } : null} onClose={() => setPasteOpen(false)} />
      <SendEmailModal item={sendItem} onClose={() => setSendItem(null)} />
      <CascadeConfirmModal invoice={payInvoice} onClose={() => setPayInvoice(null)} />
      <FormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit ${project.name}`}
        fields={PROJECT_FIELDS}
        submitLabel="Save changes"
        initial={{
          name: project.name, clientName: project.clientName, phase: project.phase,
          status: project.status, fundedBy: project.fundedBy, stake: project.stake,
        }}
        onSubmit={(vals) => updateProject(project.id, vals)}
      />
      <ConfirmModal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title={`Delete ${project.name}?`}
        danger
        confirmLabel="Delete project"
        message="The store blocks deleting a project with POs pointing at it — those costs stay traceable. Move it to delivered instead."
        onConfirm={() => deleteProject(project.id)}
      />
    </>
  )
}