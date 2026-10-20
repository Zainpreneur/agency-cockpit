import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { DataTable, exportToCSV } from '../components/PipelineBoard'
import { useAppState } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'
import type { RepoRow } from '../lib/types'
import type { Tone } from '../lib/statuses'

// UpdatePR type (from doc 25)
type UpdatePR = {
  id: number
  repoName: string
  clientName: string
  kind: 'template_sync' | 'security_patch' | 'feature' | 'dependency'
  title: string
  age: number // days
  status: 'open' | 'in_review' | 'approved' | 'merged' | 'declined'
  prUrl: string
  behindBy: number
}

const MODES: ViewMode[] = ['table', 'list']

// Mock data for update PRs (in real app this would come from GitHub API)
const MOCK_UPDATE_PRS: UpdatePR[] = [
  { id: 1, repoName: 'alnoor-pos', clientName: 'Alnoor Hotel', kind: 'template_sync', title: 'Sync template v2.1 → POS module', age: 2, status: 'in_review', prUrl: 'https://github.com/zainpreneur/alnoor-pos/pull/15', behindBy: 3 },
  { id: 2, repoName: 'aqua-pets-site', clientName: 'Aqua Pets', kind: 'security_patch', title: 'Update Next.js 14.2 → 14.3 (security)', age: 1, status: 'open', prUrl: 'https://github.com/zainpreneur/aqua-pets-site/pull/8', behindBy: 0 },
  { id: 3, repoName: 'desert-carwash', clientName: 'Desert Carwash', kind: 'feature', title: 'Add branch selector to mobile nav', age: 5, status: 'approved', prUrl: 'https://github.com/zainpreneur/desert-carwash/pull/22', behindBy: 4 },
  { id: 4, repoName: 'gulf-spa-booking', clientName: 'Gulf Spa', kind: 'dependency', title: 'Update Prisma ORM 5.12 → 5.14', age: 3, status: 'in_review', prUrl: 'https://github.com/zainpreneur/gulf-spa-booking/pull/11', behindBy: 1 },
  { id: 5, repoName: 'ocean-treats-menu', clientName: 'Ocean Treats', kind: 'template_sync', title: 'Sync template v2.1 → menu module', age: 7, status: 'declined', prUrl: 'https://github.com/zainpreneur/ocean-treats-menu/pull/5', behindBy: 6 },
  { id: 6, repoName: 'aqua-pets-site', clientName: 'Aqua Pets', kind: 'security_patch', title: 'Update React 18.3 → 18.3.1', age: 0, status: 'merged', prUrl: 'https://github.com/zainpreneur/aqua-pets-site/pull/9', behindBy: 0 },
]

const TABLE_COLUMNS = [
  { key: 'repoName', label: 'Repo', render: (r: UpdatePR) => (
    <span className="font-mono text-gray-900">{r.repoName}</span>
  ) },
  { key: 'clientName', label: 'Client', render: (r: UpdatePR) => (
    <span className="text-gray-700">{r.clientName}</span>
  ) },
  { key: 'kind', label: 'Kind', render: (r: UpdatePR) => {
    const tones: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'gray'> = {
      template_sync: 'blue', security_patch: 'red', feature: 'green', dependency: 'amber',
    }
    return <Chip tone={tones[r.kind] as Tone}>{r.kind.replace('_', ' ')}</Chip>
  }, groupable: true },
  { key: 'title', label: 'Title', render: (r: UpdatePR) => (
    <div className="font-medium text-gray-900 max-w-xs truncate" title={r.title}>{r.title}</div>
  ) },
  { key: 'age', label: 'Age', render: (r: UpdatePR) => (
    <span className="text-gray-600">{r.age}d</span>
  ), sortable: true },
  { key: 'status', label: 'Status', render: (r: UpdatePR) => {
    const tones: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'gray'> = {
      open: 'blue', in_review: 'amber', approved: 'green', merged: 'green', declined: 'red',
    }
    return <Chip tone={tones[r.status] as Tone}>{r.status.replace('_', ' ')}</Chip>
  }, groupable: true },
  { key: 'behindBy', label: 'Behind by', render: (r: UpdatePR) => (
    r.behindBy > 2 ? <Chip tone="red">{r.behindBy}</Chip>
      : r.behindBy > 0 ? <Chip tone="amber">{r.behindBy}</Chip>
      : <Chip tone="green">0</Chip>
  ), sortable: true },
]

export function UpdatePRs() {
  const s = useAppState()
  const navigate = useNavigate()
  const [mode, setMode] = useViewMode('updatePRs', MODES, 'table')

  // In real app, this would come from GitHub API / store
  const prs = MOCK_UPDATE_PRS

  // Table selection helpers
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const allSelected = prs.length > 0 && selectedIds.length === prs.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < prs.length
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? prs.map((p) => p.id) : [])
  const toggleRow = (id: number, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))

  const prColumns = (r: UpdatePR) => ({
    Repo: r.repoName,
    Client: r.clientName,
    Kind: r.kind,
    Title: r.title,
    Age: r.age + 'd',
    Status: r.status,
    Behind: r.behindBy,
  })

  return (
    <>
      <PageHeader
        title="Update PRs"
        subtitle="Template sync, security patches, and feature PRs across client repos (doc 11, 17). Open PRs with behind-by > 2 need attention."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Open PRs" value={String(prs.filter((p) => p.status === 'open' || p.status === 'in_review').length)} />
        <Stat label="Behind > 2" value={String(prs.filter((p) => p.behindBy > 2).length)} tone="red" />
        <Stat label="Approved" value={String(prs.filter((p) => p.status === 'approved').length)} tone="green" />
        <Stat label="Merged" value={String(prs.filter((p) => p.status === 'merged').length)} />
      </div>

      {/* ── TABLE (sort, group, bulk-select, CSV) ── */}
      {mode === 'table' && (
        <DataTable
          columns={TABLE_COLUMNS}
          items={prs}
          getId={(p) => p.id}
          defaultSort={{ key: 'behindBy', direction: 'desc' }}
          onRowClick={(p) => window.open(p.prUrl, '_blank')}
          selection={{
            selectedIds,
            onSelect: toggleRow,
            onSelectAll: toggleAll,
          }}
          onExportCSV={(items) => exportToCSV(items, TABLE_COLUMNS, 'update-prs')}
          exportFilename="update-prs"
          rowClassName={(p) => p.behindBy > 2 ? 'bg-red-50' : p.behindBy > 0 ? 'bg-amber-50' : ''}
        />
      )}

      {/* ── LIST ── */}
      {mode === 'list' && (
        <SectionCard title="All Update PRs">
          {prs.map((p) => (
            <a
              key={p.id}
              href={p.prUrl}
              target="_blank"
              rel="noopener"
              className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/50"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">{p.title}</div>
                <div className="text-xs text-gray-500">{p.repoName} · {p.clientName}</div>
              </div>
              <Chip tone={(p.kind === 'template_sync' ? 'blue' : p.kind === 'security_patch' ? 'red' : p.kind === 'feature' ? 'green' : 'amber') as Tone}>
                {p.kind.replace('_', ' ')}
              </Chip>
              <Chip tone={(p.status === 'open' ? 'blue' : p.status === 'in_review' ? 'amber' : p.status === 'approved' ? 'green' : p.status === 'merged' ? 'green' : 'red') as Tone}>
                {p.status.replace('_', ' ')}
              </Chip>
              {p.behindBy > 2 && <Chip tone="red">{p.behindBy} behind</Chip>}
              <span className="text-xs text-gray-400">{p.age}d</span>
            </a>
          ))}
        </SectionCard>
      )}
    </>
  )
}