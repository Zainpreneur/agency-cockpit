import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip } from '../components/StatusChip'
import { useAppState } from '../lib/store'
import { money } from '../lib/format'

const LANE_COLORS: Record<string, string> = {
  A: 'bg-amber-500',
  B: 'bg-red-500',
  C: 'bg-emerald-500',
}

const LANE_DESCRIPTIONS: Record<string, string> = {
  A: 'One-time project fees, custom builds, module add-ons',
  B: 'Hardware, hosting, tools, vendor costs',
  C: 'Recurring maintenance, hosting, support (MRR)',
}

export function MoneyLanes() {
  const s = useAppState()

  const invoices = s.invoices.filter((i) => i.status === 'paid')
  const expenses = (s as any).expenses || []
  const toolCosts = (s as any).toolCosts || []

  // Lane A: Custom work
  const laneARevenue = invoices.filter((i) => !i.proposalNo?.includes('maintenance')).reduce((a, i) => a + i.total, 0)
  const laneACosts = expenses.filter((e: any) => e.allocation === 'flat' || e.allocation === 'hours').reduce((a: any, e: any) => a + e.sarAmount, 0)

  // Lane B: Procurement
  const laneBRevenue = 0
  const laneBCosts = expenses.filter((e: any) => e.category === 'hosting' || e.category === 'tools').reduce((a: any, e: any) => a + e.sarAmount, 0) + toolCosts.reduce((a: any, t: any) => a + t.sarAmount, 0)

  // Lane C: Subscriptions
  const laneCRevenue = s.invoices.filter((i) => i.status === 'paid' && i.proposalNo?.includes('maintenance')).reduce((a, i) => a + i.total, 0)
  const laneCCosts = 0

  const lanes = [
    { lane: 'A' as const, name: 'Custom Work', revenue: laneARevenue, costs: laneACosts, margin: laneARevenue - laneACosts },
    { lane: 'B' as const, name: 'Procurement', revenue: laneBRevenue, costs: laneBCosts, margin: laneBRevenue - laneBCosts },
    { lane: 'C' as const, name: 'Subscriptions', revenue: laneCRevenue, costs: laneCCosts, margin: laneCRevenue - laneCCosts },
  ]

  const totalRevenue = lanes.reduce((a, l) => a + l.revenue, 0)
  const totalCosts = lanes.reduce((a, l) => a + l.costs, 0)
  const totalMargin = lanes.reduce((a, l) => a + l.margin, 0)

  return (
    <>
      <PageHeader
        title="Three Money Lanes"
        subtitle="Lane A (custom work) · Lane B (procurement) · Lane C (subscriptions/MRR) — doc 15"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total Revenue" value={money(totalRevenue)} tone="green" />
        <Stat label="Total Costs" value={money(totalCosts)} tone="red" />
        <Stat label="Total Margin" value={money(totalMargin)} tone={totalMargin >= 0 ? 'green' : 'red'} />
        <Stat label="MRR (Lane C)" value={money(laneCRevenue)} tone="blue" />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {lanes.map((lane) => {
          const marginPct = lane.revenue ? Math.round((lane.margin / lane.revenue) * 100) : 0
          return (
            <SectionCard key={lane.lane} title={`Lane ${lane.lane} — ${lane.name}`} hint={LANE_DESCRIPTIONS[lane.lane]}>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${LANE_COLORS[lane.lane]}`} />
                  <span className="text-sm font-medium text-gray-900">{lane.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">Revenue</div>
                    <div className="text-lg font-semibold tabular-nums text-emerald-600">{money(lane.revenue)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Costs</div>
                    <div className="text-lg font-semibold tabular-nums text-red-600">{money(lane.costs)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Margin</div>
                    <div className={`text-lg font-semibold tabular-nums ${lane.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{money(lane.margin)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Margin %</div>
                    <div className={`text-lg font-semibold tabular-nums ${marginPct >= 25 ? 'text-emerald-600' : 'text-amber-600'}`}>{marginPct}%</div>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${LANE_COLORS[lane.lane]}`} style={{ width: `${Math.min(100, marginPct)}%` }} />
                </div>
              </div>
            </SectionCard>
          )
        })}
      </div>

      <SectionCard title="Lane Breakdown" hint="where margin comes from">
        <div className="p-4 text-sm text-gray-600 leading-relaxed">
          <p className="mb-2"><strong>Lane A (Custom Work)</strong>: One-time project fees from accepted proposals. Highest margin, lowest recurring.</p>
          <p className="mb-2"><strong>Lane B (Procurement)</strong>: Hardware, hosting, tools. Cost-only lane — margin comes from markup on hardware.</p>
          <p><strong>Lane C (Subscriptions)</strong>: Recurring maintenance, hosting, support. Your MRR — the compounding engine.</p>
        </div>
      </SectionCard>
    </>
  )
}