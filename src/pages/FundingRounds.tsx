import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { DataTable, exportToCSV } from '../components/PipelineBoard'
import { useAppState } from '../lib/store'
import { money, dateShort } from '../lib/format'
import type { FundingRound } from '../lib/types'

const ROUND_FIELDS: FieldDef[] = [
  { key: 'project', label: 'Project', required: true },
  { key: 'target', label: 'Target (SAR)', type: 'number', required: true, min: 1 },
  { key: 'rule', label: 'Return rule', type: 'select', options: [
    { value: 'fixed', label: 'Fixed return' },
    { value: 'multiple', label: '× multiple' },
    { value: 'revenue_share', label: 'Revenue share' },
  ]},
  { key: 'sourceKind', label: 'Capital source', type: 'select', options: [
    { value: 'new_capital', label: 'New capital' },
    { value: 'salvage_round', label: 'Salvage round' },
    { value: 'investor_advance', label: 'Investor advance' },
  ]},
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'seeking', label: 'Seeking' },
    { value: 'committed', label: 'Committed' },
    { value: 'funded', label: 'Funded' },
    { value: 'returned', label: 'Returned' },
    { value: 'closed', label: 'Closed' },
  ]},
  { key: 'raised', label: 'Raised so far (SAR)', type: 'number', min: 0 },
]

const TABLE_COLUMNS = [
  { key: 'project', label: 'Project', render: (r: FundingRound) => (
    <div className="font-medium text-gray-900">{r.project}</div>
  ) },
  { key: 'target', label: 'Target', render: (r: FundingRound) => (
    <span className="tabular-nums">{money(r.target)}</span>
  ), align: 'right' as const, sortable: true },
  { key: 'raised', label: 'Raised', render: (r: FundingRound) => (
    <span className="tabular-nums font-medium">{money(r.raised)}</span>
  ), align: 'right' as const, sortable: true },
  { key: 'progress', label: 'Progress', render: (r: FundingRound) => {
    const pct = r.target ? Math.round((r.raised / r.target) * 100) : 0
    return (
      <div className="flex items-center gap-2">
        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <span className="text-xs text-gray-500">{pct}%</span>
      </div>
    )
  } },
  { key: 'rule', label: 'Rule', render: (r: FundingRound) => (
    <Chip tone="gray">{r.rule === 'fixed' ? 'fixed' : r.rule === 'multiple' ? '× multiple' : 'revenue share'}</Chip>
  ), groupable: true },
  { key: 'sourceKind', label: 'Source', render: (r: FundingRound) => (
    <span className="text-gray-600 capitalize">{r.sourceKind.replace('_', ' ')}</span>
  ), groupable: true },
  { key: 'status', label: 'Status', render: (r: FundingRound) => (
    <StatusChip status={r.status} />
  ), groupable: true },
]

export function FundingRounds() {
  const s = useAppState()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FundingRound | null>(null)
  const [removeTarget, setRemoveTarget] = useState<FundingRound | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const allSelected = s.fundingRounds.length > 0 && selectedIds.length === s.fundingRounds.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < s.fundingRounds.length
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? s.fundingRounds.map((r) => r.id) : [])
  const toggleRow = (id: number, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))

  const roundColumns = (r: FundingRound) => ({
    Project: r.project,
    Target: money(r.target),
    Raised: money(r.raised),
    Rule: r.rule,
    Source: r.sourceKind,
    Status: r.status,
  })

  return (
    <>
      <PageHeader
        title="Funding Rounds"
        subtitle="Investor capital — seeking → committed → funded → returned → closed (doc 13)"
        action={
          <button
            onClick={() => { setEditing(null); setFormOpen(true) }}
            className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
          >
            + Open round
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total rounds" value={String(s.fundingRounds.length)} />
        <Stat label="Seeking" value={String(s.fundingRounds.filter((r) => r.status === 'seeking').length)} tone="amber" />
        <Stat label="Funded" value={String(s.fundingRounds.filter((r) => r.status === 'funded').length)} tone="green" />
        <Stat label="Total raised" value={money(s.fundingRounds.reduce((a, r) => a + r.raised, 0))} />
      </div>

      <DataTable
        columns={TABLE_COLUMNS}
        items={s.fundingRounds}
        getId={(r) => r.id}
        defaultSort={{ key: 'raised', direction: 'desc' }}
        selection={{ selectedIds, onSelect: toggleRow, onSelectAll: toggleAll }}
        onExportCSV={(items) => exportToCSV(items, TABLE_COLUMNS, 'funding-rounds')}
        exportFilename="funding-rounds"
      />

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit round — ${editing.project}` : 'New funding round'}
        fields={ROUND_FIELDS}
        submitLabel={editing ? 'Save changes' : 'Open round'}
        initial={editing ? {
          project: editing.project, target: editing.target, rule: editing.rule,
          sourceKind: editing.sourceKind, status: editing.status, raised: editing.raised,
        } : { rule: 'fixed', sourceKind: 'new_capital', status: 'seeking', raised: 0 }}
        onSubmit={(vals) => (editing
          ? { ok: true }
          : { ok: true })}
      />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget ? `Delete round — ${removeTarget.project}?` : ''}
        danger
        confirmLabel="Delete round"
        message="Only rounds nobody has funded can be deleted — once capital lands, close the round instead."
        onConfirm={() => ({ ok: false, error: 'Not implemented in mock' })}
      />
    </>
  )
}