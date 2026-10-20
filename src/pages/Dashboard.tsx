import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, SectionCard } from '../components/Layout'
import { Chip } from '../components/StatusChip'
import { useAppState } from '../lib/store'
import { money, daysBetween, dateShort } from '../lib/format'
import type { Tone } from '../lib/statuses'

// Doc 24: six pillars, every metric derived from existing rows — no extra
// tracking, no hand-kept numbers. Weekly review mode = the Sunday ritual.

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'green' | 'red' | 'amber' }) {
  const cls = tone === 'green' ? 'text-emerald-600' : tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-600' : 'text-gray-900'
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</div>
      {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
    </div>
  )
}

function Bar({ label, value, max, tone, right }: { label: string; value: number; max: number; tone: Tone; right?: string }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0
  const bg = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-blue-500', gray: 'bg-gray-400' }[tone]
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 text-gray-600 truncate" title={label}>{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${bg}`} style={{ width: pct + '%' }} />
      </div>
      <span className="w-20 shrink-0 text-right tabular-nums text-gray-700 font-medium">{right ?? value}</span>
    </div>
  )
}

function Donut({ pct, label, sub, tone = 'green' }: { pct: number; label: string; sub?: string; tone?: Tone }) {
  const color = { green: '#10b981', amber: '#f59e0b', red: '#ef4444', blue: '#3b82f6', gray: '#9ca3af' }[tone]
  const deg = Math.max(0, Math.min(100, pct)) * 3.6
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative w-16 h-16 rounded-full shrink-0"
        style={{ background: `conic-gradient(${color} ${deg}deg, #e5e7eb 0deg)` }}
      >
        <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
          <span className="text-xs font-bold tabular-nums text-gray-800">{Math.round(pct)}%</span>
        </div>
      </div>
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
    </div>
  )
}

function RadarItem({ tone, text, to, action }: { tone: Tone; text: string; to: string; action: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
      <Chip tone={tone}>{tone === 'red' ? 'act now' : tone === 'amber' ? 'watch' : 'info'}</Chip>
      <span className="text-sm text-gray-700 flex-1 min-w-0">{text}</span>
      <span className="text-xs text-blue-600 shrink-0">{action} →</span>
    </Link>
  )
}

export function Dashboard() {
  const s = useAppState()
  const [review, setReview] = useState(false)
  const [copied, setCopied] = useState(false)

  const unpaid = s.invoices.filter((i) => i.status !== 'paid' && i.status !== 'void')
  const outstanding = unpaid.reduce((a, i) => a + i.total, 0)
  const overdue = unpaid.filter((i) => daysBetween(i.dueAt) > 0)
  const overdueAmt = overdue.reduce((a, i) => a + i.total, 0)
  const collected = s.invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + i.total, 0)
  const aged14 = overdue.filter((i) => daysBetween(i.dueAt) <= 14).reduce((a, i) => a + i.total, 0)
  const aged15 = overdue.filter((i) => daysBetween(i.dueAt) > 14).reduce((a, i) => a + i.total, 0)
  const current = unpaid.filter((i) => daysBetween(i.dueAt) <= 0).reduce((a, i) => a + i.total, 0)

  const leadCounts = ['discovered', 'contacted', 'demo_shared', 'proposal_sent', 'negotiating'].map((st) => ({
    st,
    n: s.leads.filter((l) => l.status === st || (st === 'demo_shared' && l.status === 'demo_built')).length,
  }))
  const sentProposals = s.proposals.filter((p) => p.status === 'sent' || p.status === 'viewed')
  const decided = s.proposals.filter((p) => ['accepted', 'rejected', 'expired'].includes(p.status))
  const won = s.proposals.filter((p) => p.status === 'accepted')
  const winRate = decided.length ? Math.round((won.length / decided.length) * 100) : null
  const avgDeal = won.length ? won.reduce((a, p) => a + p.offeredPrice, 0) / won.length : 0

  const healthy = s.deployTargets.filter((d) => d.status === 'healthy').length
  const activeProjects = s.projects.filter((p) => p.status !== 'delivered')
  const stuckPo = s.purchaseOrders.filter((p) => p.status === 'ordered' && p.orderedAt && daysBetween(p.orderedAt) >= 5)

  const teamPending = s.team.reduce((a, m) => a + m.pending, 0)
  const invDeployed = s.investors.reduce((a, i) => a + i.deployed, 0)
  const invReturned = s.investors.reduce((a, i) => a + i.returned, 0)
  const payoutSplit = (['blocked', 'payable', 'paid'] as const).map((st) => ({
    st,
    n: s.payouts.filter((p) => p.status === st).reduce((a, p) => a + p.amount, 0),
  }))
  const maxPayout = Math.max(...payoutSplit.map((p) => p.n), 1)

  // Risk radar — every item derived, every item links somewhere real
  const worstOverdue = [...overdue].sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]
  const blockedPayouts = s.payouts.filter((p) => p.status === 'blocked')
  const expiringProp = sentProposals.find((p) => daysBetween(p.validUntil) > -7)
  const expiringCred = s.credentials.find((c) => c.expiresAt && daysBetween(c.expiresAt) > -30 && daysBetween(c.expiresAt) < 0)
  const behindRepo = s.repos.find((r) => r.behindBy > 0)
  const badDeploy = s.deployTargets.find((d) => d.status === 'degraded' || d.status === 'pending_agent')
  const topClient = unpaid.length
    ? (() => {
        const byClient = new Map<string, number>()
        for (const i of unpaid) byClient.set(i.clientName, (byClient.get(i.clientName) ?? 0) + i.total)
        const [name, amt] = [...byClient.entries()].sort((a, b) => b[1] - a[1])[0]
        return { name, pct: Math.round((amt / Math.max(outstanding, 1)) * 100) }
      })()
    : null

  const outMsgs = s.commsLog.filter((c) => c.direction === 'out').length
  const inMsgs = s.commsLog.filter((c) => c.direction === 'in').length
  const replyRate = outMsgs ? Math.round((inMsgs / outMsgs) * 100) : 0
  const activeCampaigns = s.campaigns.filter((c) => c.status === 'active')
  const enrolled = s.campaigns.reduce((a, c) => a + c.enrolled, 0)
  const replied = s.campaigns.reduce((a, c) => a + c.replied, 0)

  const reviewText = useMemo(() => {
    const lines = [
      `Weekly review — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      '',
      `Wins: ${won.map((p) => `${p.no} ${p.leadName} ${money(p.offeredPrice)}`).join(' · ') || 'none this period'}`,
      `Cash in: ${money(collected)} collected · ${money(overdueAmt)} overdue`,
      `Waiting on: ${overdue.map((i) => `${i.no} ${dueShort(i.dueAt)}`).join(' · ') || 'nothing'}`,
      `${blockedPayouts.length} payouts blocked on client payments (${money(blockedPayouts.reduce((a, p) => a + p.amount, 0))})`,
      '',
      'Next week:',
      ...(worstOverdue ? [`- Nag ${worstOverdue.no} (${worstOverdue.clientName}) again`] : []),
      ...(expiringProp ? [`- Push ${expiringProp.no} before it expires ${dateShort(expiringProp.validUntil)}`] : []),
      ...(stuckPo.length ? [`- Chase ${stuckPo.map((p) => p.no).join(', ')} with vendors`] : []),
      ...(badDeploy ? [`- Fix ${badDeploy.name} (${badDeploy.status})`] : []),
    ]
    return lines.join('\n')
  }, [s])

  const copyReview = async () => {
    try {
      await navigator.clipboard.writeText(reviewText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Six pillars, every number computed from your own rows — nothing tracked twice"
        action={
          <button
            onClick={() => setReview(!review)}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition ${
              review ? 'bg-gray-900 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {review ? 'Close review' : 'Weekly review'}
          </button>
        }
      />

      {review && (
        <section className="mb-5 bg-gray-900 text-gray-100 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div>
              <div className="text-sm font-semibold">Weekly review mode</div>
              <div className="text-xs text-gray-400">read → copy → paste into your notes or team email</div>
            </div>
            <button onClick={copyReview} className="rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium px-3 py-1.5">
              {copied ? '✓ Copied' : 'Copy review'}
            </button>
          </div>
          <pre className="px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap font-sans">{reviewText}</pre>
        </section>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* 1 — Money */}
        <SectionCard title="Money">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Outstanding" value={money(outstanding)} tone={outstanding ? 'amber' : 'green'} sub={`${unpaid.length} invoices open`} />
              <Metric label="Overdue" value={money(overdueAmt)} tone={overdueAmt ? 'red' : 'green'} sub={overdue.length ? `oldest ${daysBetween(overdue[0].dueAt)}d` : 'none'} />
              <Metric label="Collected" value={money(collected)} tone="green" />
              <Metric label="Payouts blocked" value={money(payoutSplit[0].n)} sub={`${blockedPayouts.length} waiting on clients`} />
            </div>
            <div className="space-y-1.5 pt-2 border-t border-gray-50">
              <Bar label="Not due yet" value={current} max={outstanding} tone="blue" right={money(current)} />
              <Bar label="1–14d overdue" value={aged14} max={outstanding} tone="amber" right={money(aged14)} />
              <Bar label="15d+ overdue" value={aged15} max={outstanding} tone="red" right={money(aged15)} />
            </div>
          </div>
        </SectionCard>

        {/* 2 — Pipeline */}
        <SectionCard title="Pipeline">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="In play" value={String(s.leads.filter((l) => !['won', 'lost'].includes(l.status)).length)} sub="active leads" />
              <Metric label="Sent quotes" value={money(sentProposals.reduce((a, p) => a + p.offeredPrice, 0))} sub={`${sentProposals.length} awaiting`} />
              <Metric label="Win rate" value={winRate === null ? '—' : winRate + '%'} tone={winRate !== null && winRate >= 50 ? 'green' : undefined} sub={`${decided.length} decided`} />
            </div>
            <div className="space-y-1.5 pt-2 border-t border-gray-50">
              {leadCounts.map((l, i) => (
                <Bar key={l.st} label={l.st.replace('_', ' ')} value={l.n} max={Math.max(...leadCounts.map((x) => x.n), 1)} tone={['gray', 'blue', 'blue', 'amber', 'amber'][i] as Tone} right={String(l.n)} />
              ))}
            </div>
            {avgDeal > 0 && <div className="text-xs text-gray-500">avg accepted deal · <span className="font-semibold text-gray-800 tabular-nums">{money(avgDeal)}</span></div>}
          </div>
        </SectionCard>

        {/* 3 — Delivery */}
        <SectionCard title="Delivery">
          <div className="p-4 space-y-4">
            <Donut pct={(healthy / Math.max(s.deployTargets.length, 1)) * 100} label="Deployments healthy" sub={`${healthy} of ${s.deployTargets.length} targets`} tone={healthy === s.deployTargets.length ? 'green' : 'amber'} />
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-50">
              <Metric label="Active" value={String(activeProjects.length)} sub="projects" />
              <Metric label="Stuck POs" value={String(stuckPo.length)} tone={stuckPo.length ? 'amber' : 'green'} sub="≥5 days" />
              <Metric label="Repos behind" value={String(s.repos.filter((r) => r.behindBy > 0).length)} tone={s.repos.some((r) => r.behindBy > 0) ? 'amber' : 'green'} />
            </div>
            <div className="space-y-1.5">
              {activeProjects.map((p) => (
                <Bar key={p.id} label={p.clientName} value={p.stake} max={Math.max(...activeProjects.map((x) => x.stake))} tone={p.status === 'proposal' ? 'gray' : p.status === 'procurement' ? 'amber' : 'blue'} right={money(p.stake)} />
              ))}
            </div>
          </div>
        </SectionCard>

        {/* 4 — People */}
        <SectionCard title="People">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Team pending" value={money(teamPending)} tone={teamPending ? 'amber' : undefined} sub="flat fees" />
              <Metric label="Capital" value={money(invDeployed)} sub="investors" />
              <Metric label="Returned" value={money(invReturned)} tone="green" sub={`${invDeployed ? Math.round((invReturned / invDeployed) * 100) : 0}% of deployed`} />
            </div>
            <div className="space-y-1.5 pt-2 border-t border-gray-50">
              {payoutSplit.map((p) => (
                <Bar key={p.st} label={p.st} value={p.n} max={maxPayout} tone={p.st === 'paid' ? 'green' : p.st === 'payable' ? 'amber' : 'gray'} right={money(p.n)} />
              ))}
            </div>
          </div>
        </SectionCard>

        {/* 5 — Risk radar */}
        <SectionCard title="Risk radar" hint="what wants a decision">
          <div className="divide-y divide-gray-50">
            {worstOverdue && <RadarItem tone="red" text={`${worstOverdue.no} · ${worstOverdue.clientName} — ${daysBetween(worstOverdue.dueAt)}d overdue (${money(worstOverdue.total)})`} to="/money/invoices" action="nag" />}
            {blockedPayouts.length > 0 && <RadarItem tone="gray" text={`${blockedPayouts.length} payouts blocked until clients pay (${money(blockedPayouts.reduce((a, p) => a + p.amount, 0))})`} to="/money/payouts" action="watch" />}
            {topClient && topClient.pct >= 40 && <RadarItem tone="amber" text={`${topClient.name} is ${topClient.pct}% of your outstanding money (concentration)`} to="/clients" action="diversify" />}
            {badDeploy && <RadarItem tone={badDeploy.status === 'degraded' ? 'red' : 'amber'} text={`${badDeploy.name} — ${badDeploy.status === 'degraded' ? 'deployment degraded' : 'office VPS agent missing'}`} to="/projects" action="fix" />}
            {stuckPo.length > 0 && <RadarItem tone="amber" text={`${stuckPo[0].no} stuck at “ordered” for ${daysBetween(stuckPo[0].orderedAt!)}d (${stuckPo[0].vendor})`} to="/projects" action="chase" />}
            {expiringProp && <RadarItem tone="amber" text={`${expiringProp.no} expires ${dateShort(expiringProp.validUntil)} — ${expiringProp.leadName}`} to="/sales/proposals" action="follow up" />}
            {expiringCred && <RadarItem tone="amber" text={`${expiringCred.provider} credential expires ${dateShort(expiringCred.expiresAt)}`} to="/projects" action="rotate" />}
            {behindRepo && <RadarItem tone="amber" text={`${behindRepo.name} is ${behindRepo.behindBy} commits behind ${behindRepo.version}`} to="/projects" action="deploy" />}
          </div>
        </SectionCard>

        {/* 6 — Growth */}
        <SectionCard title="Growth">
          <div className="p-4 space-y-4">
            <Donut pct={replyRate} label="Reply rate" sub={`${inMsgs} replies to ${outMsgs} messages`} tone={replyRate >= 30 ? 'green' : replyRate >= 15 ? 'amber' : 'gray'} />
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-50">
              <Metric label="Campaigns on" value={String(activeCampaigns.length)} sub={`${s.campaigns.length} total`} />
              <Metric label="Enrolled" value={String(enrolled)} sub={`${replied} replied`} />
              <Metric label="Clients" value={String(s.clients.length)} sub={`${s.clients.filter((c) => c.status === 'active').length} active`} />
            </div>
            <div className="text-xs text-gray-400 leading-relaxed pt-2 border-t border-gray-50">
              Repeat business shows up here as clients with second projects — Alnoor started as a
              salon referral (lane C grows from here).
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  )
}

function dueShort(dueAt: string): string {
  const diff = daysBetween(dueAt)
  return diff > 0 ? `${diff}d overdue` : `due ${dateShort(dueAt)}`
}
