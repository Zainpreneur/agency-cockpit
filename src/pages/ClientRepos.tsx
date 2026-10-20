import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { DataTable, exportToCSV } from '../components/PipelineBoard'
import { useAppState } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'
import type { RepoRow } from '../lib/types'

const MODES: ViewMode[] = ['table', 'list']

const TABLE_COLUMNS = [
  { key: 'name', label: 'Repo', render: (r: RepoRow) => (
    <div className="font-medium text-gray-900 font-mono">{r.name}</div>
  ) },
  { key: 'clientName', label: 'Client', render: (r: RepoRow) => (
    <span className="text-gray-700">{r.clientName}</span>
  ) },
  { key: 'version', label: 'Live tag', render: (r: RepoRow) => (
    <span className="text-gray-600 font-mono">{r.version}</span>
  ) },
  { key: 'behindBy', label: 'Behind by', render: (r: RepoRow) => (
    r.behindBy > 0
      ? <Chip tone={r.behindBy > 2 ? 'red' : 'amber'}>{r.behindBy} commits</Chip>
      : <Chip tone="green">up to date</Chip>
  ), sortable: true, groupable: true },
  { key: 'age', label: 'Age', render: (r: RepoRow) => (
    <span className="text-gray-600">{daysBetween(r.version)}d</span>
  ) },
]

export function ClientRepos() {
  const s = useAppState()
  const navigate = useNavigate()
  const [mode, setMode] = useViewMode('clientRepos', MODES, 'table')

  return (
    <>
      <PageHeader
        title="Client Repos"
        subtitle="One repo per client — deploy = tag (doc 11). Behind-by tracks drift from live tag."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total repos" value={String(s.repos.length)} />
        <Stat label="Behind >2" value={String(s.repos.filter((r) => r.behindBy > 2).length)} tone="red" />
        <Stat label="Behind 1-2" value={String(s.repos.filter((r) => r.behindBy > 0 && r.behindBy <= 2).length)} tone="amber" />
        <Stat label="Up to date" value={String(s.repos.filter((r) => r.behindBy === 0).length)} tone="green" />
      </div>

      {/* ── TABLE (sort, group, bulk-select, CSV) ── */}
      {mode === 'table' && (
        <DataTable
          columns={TABLE_COLUMNS}
          items={s.repos}
          getId={(r) => r.id}
          defaultSort={{ key: 'behindBy', direction: 'desc' }}
          onRowClick={(r) => navigate(`/client-repos/${r.id}`)}
          onExportCSV={(items) => exportToCSV(items, TABLE_COLUMNS, 'client-repos')}
          exportFilename="client-repos"
          rowClassName={(r) => r.behindBy > 2 ? 'bg-red-50' : r.behindBy > 0 ? 'bg-amber-50' : ''}
        />
      )}

      {/* ── LIST ── */}
      {mode === 'list' && (
        <SectionCard title="All Repos">
          {s.repos.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 cursor-pointer"
              onClick={() => navigate(`/client-repos/${r.id}`)}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900 font-mono">{r.name}</div>
                <div className="text-xs text-gray-500">{r.clientName} · {r.version}</div>
              </div>
              {r.behindBy > 0 ? <Chip tone={r.behindBy > 2 ? 'red' : 'amber'}>{r.behindBy} behind</Chip> : <Chip tone="green">up to date</Chip>}
              <span className="text-xs text-gray-400">behind by {r.behindBy}</span>
            </div>
          ))}
        </SectionCard>
      )}
    </>
  )
}