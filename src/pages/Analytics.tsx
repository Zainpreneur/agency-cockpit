import { useState, useMemo } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { useAppState } from '../lib/store'
import { computeAllMetrics, getTotalMetricCount } from '../lib/analytics'
import { money } from '../lib/format'
import type { Metric, MetricPillar } from '../lib/analytics'

const MODES: ViewMode[] = ['cards', 'table']

export function Analytics() {
  const s = useAppState()
  const [mode, setMode] = useViewMode('analytics', MODES, 'cards')
  const [selectedPillar, setSelectedPillar] = useState<string>('Money')

  const pillars = useMemo(() => computeAllMetrics(s), [s])
  const totalCount = useMemo(() => getTotalMetricCount(s), [s])

  const selectedPillarData = pillars.find((p) => p.name === selectedPillar)

  const TONE_COLORS: Record<string, string> = {
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    gray: 'text-gray-500',
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={`${totalCount} metrics computed from existing rows — nothing typed twice (doc 24)`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <ViewSwitcher modes={MODES} value={mode} onChange={setMode} />
          </div>
        }
      />

      {/* Pillar selector */}
      <div className="flex flex-wrap gap-2 mb-5">
        {pillars.map((p) => (
          <button
            key={p.name}
            onClick={() => setSelectedPillar(p.name)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-inset transition ${
              selectedPillar === p.name
                ? 'bg-gray-900 text-white ring-gray-900'
                : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50'
            }`}
          >
            {p.name} ({p.metrics.length})
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {pillars.map((p) => (
          <div key={p.name} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <div className="text-xs text-gray-500">{p.name}</div>
            <div className="text-lg font-semibold tabular-nums text-gray-900">{p.metrics.length}</div>
          </div>
        ))}
      </div>

      {/* Metrics display */}
      {mode === 'cards' && selectedPillarData && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {selectedPillarData.metrics.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-gray-500 leading-tight">{m.name}</div>
                <Chip tone={m.tone === 'green' ? 'green' : m.tone === 'red' ? 'red' : m.tone === 'amber' ? 'amber' : m.tone === 'blue' ? 'blue' : 'gray'}>
                  {m.trend === 'up' ? '▲' : m.trend === 'down' ? '▼' : '—'}
                </Chip>
              </div>
              <div className={`text-2xl font-bold tabular-nums mt-2 ${TONE_COLORS[m.tone || 'gray']}`}>
                {m.formatted}
              </div>
              <div className="text-[11px] text-gray-400 mt-2 leading-tight">
                {m.decision}
              </div>
              {m.drillDown && (
                <a href={m.drillDown} className="text-[11px] text-blue-600 hover:underline mt-1 block">
                  Drill down →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {mode === 'table' && selectedPillarData && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2.5 font-medium">Metric</th>
                <th className="px-4 py-2.5 font-medium text-right">Value</th>
                <th className="px-4 py-2.5 font-medium">Trend</th>
                <th className="px-4 py-2.5 font-medium">Decision</th>
                <th className="px-4 py-2.5 font-medium">Drill-down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {selectedPillarData.metrics.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3 text-gray-900">{m.name}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${TONE_COLORS[m.tone || 'gray']}`}>
                    {m.formatted}
                  </td>
                  <td className="px-4 py-3">
                    <span className={m.trend === 'up' ? 'text-emerald-600' : m.trend === 'down' ? 'text-red-600' : 'text-gray-400'}>
                      {m.trend === 'up' ? '▲' : m.trend === 'down' ? '▼' : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[300px]">{m.decision}</td>
                  <td className="px-4 py-3">
                    {m.drillDown && (
                      <a href={m.drillDown} className="text-xs text-blue-600 hover:underline">
                        {m.drillDown}
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}