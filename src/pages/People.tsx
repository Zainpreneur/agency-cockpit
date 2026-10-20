import { PageHeader, SectionCard, Stat } from '../components/Layout'
import { Chip } from '../components/StatusChip'
import { useAppState } from '../lib/store'
import { money } from '../lib/format'

export function People() {
  const s = useAppState()

  const totalPending = s.team.reduce((a, m) => a + m.pending, 0)
  const deployed = s.investors.reduce((a, i) => a + i.deployed, 0)
  const returned = s.investors.reduce((a, i) => a + i.returned, 0)

  return (
    <>
      <PageHeader
        title="Team & investors"
        subtitle="Flat fee per deliverable only — no hourly or monthly pay, ever (doc 7)"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Team pending" value={money(totalPending)} tone={totalPending ? 'amber' : undefined} />
        <Stat label="Team paid YTD" value={money(s.team.reduce((a, m) => a + m.paidYtd, 0))} tone="green" />
        <Stat label="Investor capital" value={money(deployed)} />
        <Stat label="Returned" value={money(returned)} tone="green" />
      </div>

      <div className="space-y-4">
        <SectionCard title="Team" hint="payout rows only — comp plan is fixed per assignment">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2.5 font-medium">Member</th>
                  <th className="px-4 py-2.5 font-medium">Comp plan</th>
                  <th className="px-4 py-2.5 font-medium text-right">Pending</th>
                  <th className="px-4 py-2.5 font-medium text-right">Paid YTD</th>
                  <th className="px-4 py-2.5 font-medium">Blocked on</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {s.team.map((m) => {
                  const blockedOn = s.payouts.filter((p) => p.payee === m.name && p.status === 'blocked')
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/70">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{m.name}</div>
                        <div className="text-xs text-gray-400">{m.email}</div>
                      </td>
                      <td className="px-4 py-3"><Chip tone="gray">flat fee per deliverable</Chip></td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{money(m.pending)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{money(m.paidYtd)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {blockedOn.length === 0 ? '—' : blockedOn.map((p) => s.invoices.find((i) => i.id === p.triggerInvoiceId)?.no).filter(Boolean).join(', ')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Investors" hint="positions are derived from payouts and funding rows — no hand-kept balances">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2.5 font-medium">Investor</th>
                  <th className="px-4 py-2.5 font-medium text-right">Deployed</th>
                  <th className="px-4 py-2.5 font-medium text-right">Returned</th>
                  <th className="px-4 py-2.5 font-medium text-right">Current</th>
                  <th className="px-4 py-2.5 font-medium">Flow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {s.investors.map((inv) => {
                  const current = inv.deployed - inv.returned
                  const pcts = Math.round((inv.returned / Math.max(inv.deployed, 1)) * 100)
                  const blocked = s.payouts.filter((p) => p.payee === inv.name && p.status === 'blocked')
                  const payable = s.payouts.filter((p) => p.payee === inv.name && p.status === 'payable')
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50/70">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{inv.name}</div>
                        <div className="text-xs text-gray-400">{inv.email}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(inv.deployed)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{money(inv.returned)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{money(current)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-gray-500 tabular-nums">{pcts}% returned</span>
                          {blocked.length > 0 && <Chip tone="gray">blocked on {s.invoices.find((i) => i.id === blocked[0].triggerInvoiceId)?.no}</Chip>}
                          {payable.length > 0 && <Chip tone="amber">{money(payable.reduce((a, p) => a + p.amount, 0))} payable</Chip>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Funding rounds" hint="salvage rounds offer burned investors first (doc 21)">
          {s.fundingRounds.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900">{r.project}</div>
                <div className="text-xs text-gray-500">
                  {r.rule === 'fixed' ? 'fixed return' : r.rule === 'multiple' ? '× multiple' : 'revenue share'} · {r.sourceKind.replace('_', ' ')}
                </div>
              </div>
              <Chip tone={r.status === 'seeking' ? 'amber' : r.status === 'funded' ? 'green' : 'blue'}>
                {money(r.raised)} / {money(r.target)}
              </Chip>
            </div>
          ))}
        </SectionCard>
      </div>
    </>
  )
}
