import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { DataTable, exportToCSV } from '../components/PipelineBoard'
import { useAppState } from '../lib/store'
import { money, dateShort } from '../lib/format'

const MODES: ViewMode[] = ['table', 'list']

type TemplateUpdatePR = {
  id: number
  repoName: string
  clientName: string
  templateName: string
  fromVersion: string
  toVersion: string
  prUrl: string
  status: 'open' | 'merged' | 'closed' | 'declined'
  createdAt: string
}

const MOCK_PRS: TemplateUpdatePR[] = [
  { id: 1, repoName: 'alnoor-pos', clientName: 'Alnoor Hotel', templateName: 'SaaS Starter Kit', fromVersion: 'v2.0', toVersion: 'v2.1', prUrl: 'https://github.com/Zainpreneur/alnoor-pos/pull/101', status: 'open', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 2, repoName: 'aqua-pets-site', clientName: 'Aqua Pets', templateName: 'Booking Engine', fromVersion: 'v1.3', toVersion: 'v1.4', prUrl: 'https://github.com/Zainpreneur/aqua-pets-site/pull/102', status: 'merged', createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 3, repoName: 'desert-carwash', clientName: 'Desert Carwash', templateName: 'Carwash Manager', fromVersion: 'v2.0', toVersion: 'v2.1', prUrl: 'https://github.com/Zainpreneur/desert-carwash/pull/103', status: 'open', createdAt: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: 4, repoName: 'gulf-spa-booking', clientName: 'Gulf Spa', templateName: 'Booking Engine', fromVersion: 'v1.2', toVersion: 'v1.4', prUrl: 'https://github.com/Zainpreneur/gulf-spa-booking/pull/104', status: 'closed', createdAt: new Date(Date.now() - 10 * 86400000).toISOString() },
  { id: 5, repoName: 'ocean-treats-menu', clientName: 'Ocean Treats', templateName: 'Menu Builder', fromVersion: 'v1.0', toVersion: 'v1.1', prUrl: 'https://github.com/Zainpreneur/ocean-treats-menu/pull/105', status: 'declined', createdAt: new Date(Date.now() - 15 * 86400000).toISOString() },
]

const STATUS_TONE: Record<string, 'blue' | 'green' | 'gray' | 'red'> = {
  open: 'blue', merged: 'green', closed: 'gray', declined: 'red',
}

const TABLE_COLUMNS = [
  { key: 'repoName', label: 'Repo', render: (p: TemplateUpdatePR) => <span className="font-mono text-gray-900">{p.repoName}</span> },
  { key: 'clientName', label: 'Client', render: (p: TemplateUpdatePR) => <span className="text-gray-700">{p.clientName}</span> },
  { key: 'templateName', label: 'Template', render: (p: TemplateUpdatePR) => <span className="text-gray-600">{p.templateName}</span> },
  { key: 'fromVersion', label: 'From', render: (p: TemplateUpdatePR) => <span className="text-gray-600 font-mono">{p.fromVersion}</span> },
  { key: 'toVersion', label: 'To', render: (p: TemplateUpdatePR) => <span className="text-gray-600 font-mono">{p.toVersion}</span> },
  { key: 'status', label: 'Status', render: (p: TemplateUpdatePR) => <Chip tone={STATUS_TONE[p.status]}>{p.status}</Chip>, groupable: true },
  { key: 'createdAt', label: 'Created', render: (p: TemplateUpdatePR) => <span className="text-gray-600">{dateShort(p.createdAt)}</span>, sortable: true },
  { key: 'prUrl', label: 'PR', render: (p: TemplateUpdatePR) => <a href={p.prUrl} target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline">View PR</a> },
]

export function TemplateUpdatePRs() {
  const [mode, setMode] = useViewMode('templateUpdatePRs', MODES, 'table')
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const allSelected = MOCK_PRS.length > 0 && selectedIds.length === MOCK_PRS.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < MOCK_PRS.length
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? MOCK_PRS.map((p) => p.id) : [])
  const toggleRow = (id: number, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))

  return (
    <>
      <PageHeader
        title="Template Update PRs"
        subtitle="Bulk template sync across client repos (doc 11, 17) — template release → all repos show behind-by → update PRs open"
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total PRs" value={String(MOCK_PRS.length)} />
        <Stat label="Open" value={String(MOCK_PRS.filter((p) => p.status === 'open').length)} tone="blue" />
        <Stat label="Merged" value={String(MOCK_PRS.filter((p) => p.status === 'merged').length)} tone="green" />
        <Stat label="Behind >2" value={String(MOCK_PRS.filter((p) => p.toVersion > p.fromVersion).length)} tone="amber" />
      </div>

      <DataTable
        columns={TABLE_COLUMNS}
        items={MOCK_PRS}
        getId={(p) => p.id}
        defaultSort={{ key: 'createdAt', direction: 'desc' }}
        selection={{ selectedIds, onSelect: toggleRow, onSelectAll: toggleAll }}
        onExportCSV={(items) => exportToCSV(items, TABLE_COLUMNS, 'template-update-prs')}
        exportFilename="template-update-prs"
      />
    </>
  )
}