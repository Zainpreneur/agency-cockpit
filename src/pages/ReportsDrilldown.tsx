import { useState, useMemo } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { useAppState } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'
import { computeAllMetrics } from '../lib/analytics'
import type { Metric } from '../lib/analytics'

const MODES: ViewMode[] = ['cards', 'table']

export function ReportsDrilldown() {
  const s = useAppState()
  const [pillar, setPillar] = useState('Money')
  const [metricId, setMetricId] = useState<string | null>(null)

  const pillars = useMemo(() => computeAllMetrics(s), [s])
  const selectedPillar = pillars.find((p) => p.name === pillar)
  const selectedMetric = selectedPillar?.metrics.find((m) => m.id === metricId)

  const getDrillDownRows = (metric: Metric): { label: string; value: string }[] => {
    switch (metric.id) {
      case 'cash-position':
      case 'revenue-collected':
      case 'outstanding':
      case 'overdue-total':
        return s.invoices.filter((i: any) => i.status !== 'void').map((i: any) => ({
          label: `${i.no} — ${i.clientName}`,
          value: money(i.total),
        }))
      case 'win-rate':
      case 'proposals-sent':
      case 'proposals-accepted':
      case 'proposals-lost':
        return s.proposals.map((p: any) => ({
          label: `${p.no} — ${p.leadName}`,
          value: `${p.status} · ${money(p.offeredPrice)}`,
        }))
      case 'active-projects':
      case 'delivered-projects':
        return s.projects.map((p: any) => ({
          label: p.name,
          value: `${p.status} · ${money(p.stake)}`,
        }))
      case 'leads-total':
      case 'leads-won':
      case 'leads-lost':
        return s.leads.map((l: any) => ({
          label: l.businessName,
          value: `${l.status} · ${l.industry}`,
        }))
      case 'team-total-pending':
      case 'team-total-paid-ytd':
        return s.team.map((t: any) => ({
          label: t.name,
          value: `pending ${money(t.pending)} · paid ${money(t.paidYtd)}`,
        }))
      case 'investor-deployed':
      case 'investor-returned':
        return s.investors.map((i: any) => ({
          label: i.name,
          value: `deployed ${money(i.deployed)} · returned ${money(i.returned)}`,
        }))
      case 'po-total':
      case 'po-stuck':
        return s.purchaseOrders.map((po: any) => ({
          label: `${po.no} — ${po.project}`,
          value: `${po.status} · ${money(po.total)}`,
        }))
      case 'tickets-open':
      case 'tickets-resolved':
        return (s.tickets || []).map((t: any) => ({
          label: t.subject,
          value: `${t.status} · ${t.priority}`,
        }))
      case 'demos-total':
      case 'demos-live':
        return (s.demos || []).map((d: any) => ({
          label: `${d.templateName} — ${d.forWhom}`,
          value: `${d.status} · ${d.views} views`,
        }))
      default:
        return []
    }
  }

  return (
    <>
      <PageHeader
        title="Reports — Drill-Down"
        subtitle="Every chart drills to its rows (doc 24 rule #1)"
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {pillars.map((p) => (
          <button
            key={p.name}
            onClick={() => { setPillar(p.name); setMetricId(null) }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-inset transition ${
              pillar === p.name ? 'bg-gray-900 text-white ring-gray-900' : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {selectedPillar && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          {selectedPillar.metrics.map((m) => (
            <button
              key={m.id}
              onClick={() => setMetricId(m.id)}
              className={`bg-white rounded-xl border shadow-sm p-4 text-left transition ${
                metricId === m.id ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-xs text-gray-500 leading-tight">{m.name}</div>
              <div className="text-xl font-bold tabular-nums mt-1 text-gray-900">{m.formatted}</div>
              <div className="text-[11px] text-gray-400 mt-1">{m.decision}</div>
            </button>
          ))}
        </div>
      )}

      {selectedMetric && (
        <SectionCard title={`Drill-down: ${selectedMetric.name}`} hint={`${getDrillDownRows(selectedMetric).length} rows`}>
          {getDrillDownRows(selectedMetric).length === 0 && <EmptyRow text="No drill-down data available for this metric." />}
          {getDrillDownRows(selectedMetric).map((row, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-800">{row.label}</span>
              <span className="text-sm text-gray-500 tabular-nums">{row.value}</span>
            </div>
          ))}
        </SectionCard>
      )}
    </>
  )
}