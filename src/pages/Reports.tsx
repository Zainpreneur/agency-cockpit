import { useState, useMemo } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { DataTable, exportToCSV } from '../components/PipelineBoard'
import { useAppState } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'
import type { Project, Invoice, PurchaseOrder, Payout } from '../lib/types'

const MODES: ViewMode[] = ['table']

type ReportView = 'pnl' | 'margins' | 'recovery'

export function Reports() {
  const s = useAppState()
  const [view, setView] = useState<ReportView>('pnl')

  // Project P&L data
  const projectPnL = useMemo(() => {
    return s.projects.map((p) => {
      const pos = s.purchaseOrders.filter((po) => po.project === p.name)
      const invoices = s.invoices.filter((inv) => pos.some((po) => po.project === p.name))
      const revenue = invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + i.total, 0)
      const costs = pos.filter((po) => po.status === 'invoiced').reduce((a, po) => a + po.total, 0)
      const teamPayouts = s.payouts.filter((payout) => payout.payeeRole === 'team' && invoices.some((i) => i.id === payout.triggerInvoiceId)).reduce((a, p) => a + p.amount, 0)
      const investorPayouts = s.payouts.filter((payout) => payout.payeeRole === 'investor' && invoices.some((i) => i.id === payout.triggerInvoiceId)).reduce((a, p) => a + p.amount, 0)
      const margin = revenue - costs - teamPayouts - investorPayouts
      const marginPct = revenue ? Math.round((margin / revenue) * 100) : 0
      return {
        project: p,
        revenue,
        costs,
        teamPayouts,
        investorPayouts,
        margin,
        marginPct,
        openInvoices: invoices.filter((i) => i.status !== 'paid' && i.status !== 'void').length,
        overdueInvoices: invoices.filter((i) => i.status === 'overdue').length,
      }
    })
  }, [s.projects, s.purchaseOrders, s.invoices, s.payouts])

  // Recovery tracker (default/salvage) — docs 20-21
  const recoveryData = useMemo(() => {
    return s.projects.filter((p) => p.status === 'delivered').map((p) => {
      const pos = s.purchaseOrders.filter((po) => po.project === p.name)
      const invoices = s.invoices.filter((inv) => pos.some((po) => po.project === p.name))
      const paid = invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + i.total, 0)
      const total = invoices.reduce((a, i) => a + i.total, 0)
      const recoveryPct = total ? Math.round((paid / total) * 100) : 0
      return {
        project: p,
        totalInvoiced: total,
        collected: paid,
        outstanding: total - paid,
        recoveryPct,
        status: recoveryPct === 100 ? 'collected' : recoveryPct > 50 ? 'partial' : 'at_risk',
      }
    })
  }, [s.projects, s.purchaseOrders, s.invoices])

  const totalRevenue = projectPnL.reduce((a, p) => a + p.revenue, 0)
  const totalCosts = projectPnL.reduce((a, p) => a + p.costs, 0)
  const totalMargin = projectPnL.reduce((a, p) => a + p.margin, 0)
  const avgMarginPct = totalRevenue ? Math.round((totalMargin / totalRevenue) * 100) : 0

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Project P&L, margins, recovery tracker — drill-down from the dashboard"
        action={
          <div className="flex gap-2">
            {(['pnl', 'margins', 'recovery'] as ReportView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset capitalize ${
                  view === v ? 'bg-gray-900 text-white ring-gray-900' : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50'
                }`}
              >
                {v === 'pnl' ? 'Project P&L' : v === 'margins' ? 'Margins' : 'Recovery'}
              </button>
            ))}
          </div>
        }
      />

      {view === 'pnl' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <Stat label="Total Revenue" value={money(totalRevenue)} tone="green" />
            <Stat label="Total Costs" value={money(totalCosts)} tone="red" />
            <Stat label="Total Margin" value={money(totalMargin)} tone={totalMargin >= 0 ? 'green' : 'red'} />
            <Stat label="Avg Margin %" value={avgMarginPct + '%'} tone={avgMarginPct >= 25 ? 'green' : 'amber'} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <th className="px-4 py-2.5 font-medium">Client</th>
                  <th className="px-4 py-2.5 font-medium text-right">Revenue</th>
                  <th className="px-4 py-2.5 font-medium text-right">Costs</th>
                  <th className="px-4 py-2.5 font-medium text-right">Team</th>
                  <th className="px-4 py-2.5 font-medium text-right">Investor</th>
                  <th className="px-4 py-2.5 font-medium text-right">Margin</th>
                  <th className="px-4 py-2.5 font-medium text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {projectPnL.map(({ project, revenue, costs, teamPayouts, investorPayouts, margin, marginPct, openInvoices, overdueInvoices }) => (
                  <tr key={project.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{project.name}</div>
                      <div className="text-xs text-gray-400">{project.status}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{project.clientName}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{money(revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">{money(costs)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-600">{money(teamPayouts)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-blue-600">{money(investorPayouts)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{money(margin)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${marginPct >= 25 ? 'text-emerald-600' : marginPct < 0 ? 'text-red-600' : 'text-amber-600'}`}>{marginPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'margins' && (
        <div className="space-y-4">
          <SectionCard title="Cost Structure" hint="team % + procurement % + tools/utilities % + investor returns %">
            <div className="p-4 text-sm text-gray-600 leading-relaxed">
              <p className="mb-3">
                <strong>Cost structure breakdown</strong> — each project's costs as a percentage of revenue.
              </p>
              <div className="space-y-2">
                {projectPnL.map(({ project, revenue, costs, teamPayouts, investorPayouts, marginPct }) => {
                  const totalCosts = costs + teamPayouts + investorPayouts
                  const teamPct = revenue ? Math.round((teamPayouts / revenue) * 100) : 0
                  const procPct = revenue ? Math.round((costs / revenue) * 100) : 0
                  const invPct = revenue ? Math.round((investorPayouts / revenue) * 100) : 0
                  return (
                    <div key={project.id} className="p-3 border border-gray-100 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">{project.name}</span>
                        <span className="text-xs text-gray-500">{money(revenue)} revenue</span>
                      </div>
                      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                        <div className="bg-amber-400" style={{ width: `${teamPct}%` }} title={`Team: ${teamPct}%`} />
                        <div className="bg-red-400" style={{ width: `${procPct}%` }} title={`Procurement: ${procPct}%`} />
                        <div className="bg-blue-400" style={{ width: `${invPct}%` }} title={`Investor: ${invPct}%`} />
                        <div className="bg-emerald-400" style={{ width: `${Math.max(0, 100 - teamPct - procPct - invPct)}%` }} title={`Margin: ${marginPct}%`} />
                      </div>
                      <div className="flex gap-3 mt-1.5 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />Team {teamPct}%</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />Proc {procPct}%</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />Investor {invPct}%</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />Margin {marginPct}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {view === 'recovery' && (
        <SectionCard title="Recovery Tracker" hint="per defaulted/delivered project: collected vs outstanding">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2.5 font-medium">Project</th>
                  <th className="px-4 py-2.5 font-medium">Client</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total Invoiced</th>
                  <th className="px-4 py-2.5 font-medium text-right">Collected</th>
                  <th className="px-4 py-2.5 font-medium text-right">Outstanding</th>
                  <th className="px-4 py-2.5 font-medium text-right">Recovery %</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recoveryData.map(({ project, totalInvoiced, collected, outstanding, recoveryPct, status }) => (
                  <tr key={project.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-3 font-medium text-gray-900">{project.name}</td>
                    <td className="px-4 py-3 text-gray-700">{project.clientName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(totalInvoiced)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{money(collected)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600">{money(outstanding)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{recoveryPct}%</td>
                    <td className="px-4 py-3">
                      <Chip tone={status === 'collected' ? 'green' : status === 'partial' ? 'amber' : 'red'}>
                        {status === 'collected' ? 'Collected' : status === 'partial' ? 'Partial' : 'At risk'}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </>
  )
}