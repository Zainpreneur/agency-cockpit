import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { SendEmailModal } from '../components/SendEmailModal'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { useAppState, sendOutboxItem, updateInvestor, removeInvestor } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'
import { Waterfall } from '../components/Waterfall'
import type { Investor, FundingRound, OutboxItem, Payout, Invoice } from '../lib/types'

const INVESTOR_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'email', label: 'Email', type: 'email' },
]

type Tab = 'overview' | 'rounds' | 'payouts' | 'comms' | 'statements'

export function InvestorDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const s = useAppState()
  const investor = s.investors.find((i) => i.id === Number(id))
  const [tab, setTab] = useState<Tab>('overview')
  const [sendItem, setSendItem] = useState<OutboxItem | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  if (!investor) {
    return (
      <div className="text-sm text-gray-500">
        Investor not found. <Link className="text-blue-600" to="/people">Back to people</Link>
      </div>
    )
  }

  const rounds = s.fundingRounds.filter((r) => r.project === investor.name || r.sourceKind === 'salvage_round')
  const investorPayouts = s.payouts.filter((p) => p.payee === investor.name && p.payeeRole === 'investor')
  const deployed = investor.deployed
  const returned = investor.returned
  const position = deployed - returned
  const returnedPct = deployed ? Math.round((returned / deployed) * 100) : 0

  // Outbox items for this investor
  const queued = s.outbox.filter(
    (o) => o.contactableName === investor.name && o.stakeholder === 'investor' && (o.status === 'ready' || o.status === 'scheduled')
  )

  // Comms log
  const timeline = s.commsLog.filter((c) => c.contactableName === investor.name).sort((a, b) => b.at.localeCompare(a.at))

  // Build waterfall tiers from all rounds
  const allRounds = s.fundingRounds.filter((r) => r.sourceKind !== 'salvage_round' || r.project === investor.name)
  const totalDeployed = allRounds.reduce((a, r) => a + r.raised, 0)
  const totalReturned = investorPayouts.filter((p) => p.status === 'paid').reduce((a, p) => a + p.amount, 0)

  // Derive waterfall tiers from round rules
  type WaterfallTier = { label: string; threshold: number; type: 'fixed' | 'multiple' | 'revenue_share'; color: string; description?: string }

  const waterfallTiers: WaterfallTier[] = allRounds.flatMap((r): WaterfallTier[] => {
    if (r.rule === 'fixed') {
      return [{ label: `${r.project} — fixed return`, threshold: r.raised, type: 'fixed', color: '#10b981', description: `fixed return ${money(r.raised)}` }]
    }
    if (r.rule === 'multiple') {
      return [
        { label: `${r.project} — 1× principal`, threshold: 1, type: 'multiple', color: '#10b981', description: 'return of capital' },
        { label: `${r.project} — ${r.rule}×`, threshold: 1.5, type: 'multiple', color: '#3b82f6', description: 'hurdle' },
      ]
    }
    return [{ label: `${r.project} — revenue share`, threshold: 1, type: 'revenue_share', color: '#f59e0b', description: 'residual split' }]
  })

  // Deduplicate similar tiers
  const uniqueTiers = waterfallTiers.reduce((acc: WaterfallTier[], t: WaterfallTier) => {
    const key = `${t.label}-${t.type}`
    if (!acc.find((x) => `${x.label}-${x.type}` === key)) acc.push(t)
    return acc
  }, [] as WaterfallTier[])

  return (
    <>
      <PageHeader
        title={investor.name}
        subtitle={investor.email}
        action={
          <div className="flex gap-2 flex-wrap">
            <Link to="/people" className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-2 hover:bg-gray-50">← People</Link>
            <button onClick={() => setEditOpen(true)} className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-2 hover:bg-gray-50">✎ Edit</button>
            <button onClick={() => setDeleteConfirm(true)} className="rounded-lg border border-red-300 text-red-600 text-sm font-medium px-4 py-2 hover:bg-red-50">Remove</button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Chip tone={position <= 0 ? 'green' : 'amber'}>
          {returnedPct}% returned
        </Chip>
        <Chip tone="blue">Position: {money(position)}</Chip>
        <Chip tone="gray">Deployed: {money(deployed)}</Chip>
        <Chip tone="green">Returned: {money(returned)}</Chip>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-gray-200" role="tablist">
        {(['overview', 'rounds', 'payouts', 'comms', 'statements'] as Tab[]).map((t) => (
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
              <SectionCard title="Waterfall" hint="capital stack — tiers clear in order">
                <Waterfall
                  tiers={uniqueTiers.length > 0
                    ? uniqueTiers
                    : [
                        { label: 'Principal return (1×)', threshold: 1, type: 'multiple', color: '#10b981', description: 'return of capital' },
                        { label: 'Preferred return (15%)', threshold: 0.15, type: 'multiple', color: '#3b82f6', description: 'hurdle' },
                        { label: 'Carry (20% of excess)', threshold: 1.15, type: 'revenue_share', color: '#f59e0b', description: 'split above hurdle' },
                      ]}
                  totalDeployed={totalDeployed || deployed}
                  totalReturned={totalReturned || returned}
                />
              </SectionCard>

              <SectionCard title="Timeline" hint="status events + messages (most recent first)">
                {timeline.length === 0 && <EmptyRow text="No messages yet." />}
                {timeline.slice(0, 10).map((c) => (
                  <div key={c.id} className="flex gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                    <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${c.direction === 'in' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{c.direction === 'in' ? '←' : '→'}</span>
                    <div className="min-w-0">
                      <div className="text-sm text-gray-800">{c.snippet}</div>
                      <div className="text-xs text-gray-400">{dateShort(c.at)}{c.templateCode ? ` · ${c.templateCode}` : ''}</div>
                    </div>
                  </div>
                ))}
              </SectionCard>
            </div>

            <div className="space-y-4">
              <SectionCard title="Quick Stats">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Capital deployed" value={money(deployed)} />
                  <Stat label="Capital returned" value={money(returned)} tone="green" />
                  <Stat label="Current position" value={money(position)} tone={position <= 0 ? 'green' : 'amber'} />
                  <Stat label="Returned" value={returnedPct + '%'} />
                </div>
              </SectionCard>

              <SectionCard title="Contact">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2"><dt className="text-gray-500 shrink-0">Email</dt><dd className="font-medium text-right break-all">{investor.email}</dd></div>
                </dl>
                <a
                  href={`mailto:${investor.email}`}
                  className="mt-3 block text-center rounded-lg bg-blue-600 text-white text-xs font-medium px-3 py-2 hover:bg-blue-700"
                >
                  Open mail app
                </a>
              </SectionCard>

              {queued.length > 0 && (
                <SectionCard title="Queued Messages">
                  {queued.map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-50 last:border-0">
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
            </div>
          </div>
        )}

        {/* ROUNDS */}
        {tab === 'rounds' && (
          <SectionCard title="Funding Rounds" hint={rounds.length === 0 ? 'no rounds yet' : ''}>
            {rounds.length === 0 && <EmptyRow text="No funding rounds for this investor." />}
            {rounds.map((r) => (
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
                <RowActions
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </div>
            ))}
          </SectionCard>
        )}

        {/* PAYOUTS */}
        {tab === 'payouts' && (
          <SectionCard title="Payouts" hint="accrued → blocked → payable → paid">
            {investorPayouts.length === 0 && <EmptyRow text="No payouts for this investor." />}
            {investorPayouts.map((p) => {
              const invoice = s.invoices.find((i) => i.id === p.triggerInvoiceId)
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900">{p.kind.replace('_', ' ')}</div>
                    <div className="text-xs text-gray-500">{p.note || (invoice ? `from ${invoice.no}` : 'ad-hoc')}</div>
                  </div>
                  <StatusChip status={p.status} />
                  <span className="text-sm font-semibold tabular-nums ml-auto">{money(p.amount)}</span>
                  <div className="ml-auto flex gap-1.5">
                    {p.status === 'payable' && (
                      <button
                        onClick={() => {
                          const result = s.payouts.find((x) => x.id === p.id)
                          if (result) {
                            // Would call releasePayout(p.id) - need to import
                          }
                        }}
                        className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700"
                      >
                        Release {money(p.amount)}
                      </button>
                    )}
                    {p.status !== 'paid' && p.status !== 'cancelled' && (
                      <button className="text-xs text-gray-400 hover:text-red-600">cancel</button>
                    )}
                  </div>
                </div>
              )
            })}
          </SectionCard>
        )}

        {/* COMMS */}
        {tab === 'comms' && (
          <SectionCard title="Message Timeline">
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

        {/* STATEMENTS */}
        {tab === 'statements' && (
          <SectionCard title="Statement Generator" hint="one-click I6/I7/I9/I10 templates filled from rows">
            <div className="grid sm:grid-cols-2 gap-3">
              <button className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-3 hover:bg-gray-50 text-left">
                <div className="font-semibold text-gray-900">I6 — Quarterly Statement</div>
                <div className="text-xs text-gray-500">Position, waterfall, paid-to-date</div>
              </button>
              <button className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-3 hover:bg-gray-50 text-left">
                <div className="font-semibold text-gray-900">I7 — Distribution Notice</div>
                <div className="text-xs text-gray-500">When a payout releases</div>
              </button>
              <button className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-3 hover:bg-gray-50 text-left">
                <div className="font-semibold text-gray-900">I9 — Capital Call</div>
                <div className="text-xs text-gray-500">New round participation request</div>
              </button>
              <button className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-3 hover:bg-gray-50 text-left">
                <div className="font-semibold text-gray-900">I10 — Salvage Offer</div>
                <div className="text-xs text-gray-500">Prior-investor first right</div>
              </button>
            </div>
          </SectionCard>
        )}
      </div>

      <SendEmailModal item={sendItem} onClose={() => setSendItem(null)} />
      <FormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit ${investor.name}`}
        fields={INVESTOR_FIELDS}
        submitLabel="Save changes"
        initial={{ name: investor.name, email: investor.email }}
        onSubmit={(vals) => updateInvestor(investor.id, vals)}
      />
      <ConfirmModal
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title={`Remove ${investor.name}?`}
        danger
        confirmLabel="Remove investor"
        message="Investors with capital in play can't be removed — settle their position first (the store enforces it)."
        onConfirm={() => removeInvestor(investor.id)}
      />
    </>
  )
}