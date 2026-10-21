import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { DataTable, exportToCSV } from '../components/PipelineBoard'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { useAppState, createAgencyAsset, updateAgencyAsset, deleteAgencyAsset, assignAgencyAsset, unassignAgencyAsset } from '../lib/store'
import { money, dateShort } from '../lib/format'
import type { AgencyAsset, AssetStatus } from '../lib/types'

const MODES: ViewMode[] = ['gallery', 'table']

const ASSET_FIELDS: FieldDef[] = [
  { key: 'tag', label: 'Tag', required: true, placeholder: 'AST-001' },
  { key: 'name', label: 'Name', required: true },
  { key: 'kind', label: 'Kind', required: true, placeholder: 'laptop · phone · tablet · monitor' },
  { key: 'holder', label: 'Holder' },
  { key: 'clientName', label: 'Client (if assigned)' },
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'available', label: 'Available' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'retired', label: 'Retired' },
  ]},
  { key: 'condition', label: 'Condition', type: 'select', options: [
    { value: 'new', label: 'New' },
    { value: 'good', label: 'Good' },
    { value: 'fair', label: 'Fair' },
    { value: 'poor', label: 'Poor' },
  ]},
  { key: 'cost', label: 'Cost (SAR)', type: 'number', min: 0 },
  { key: 'imageHue', label: 'Card hue (0-360)', type: 'number', min: 0 },
  { key: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
]

const CONDITION_TONE: Record<string, 'green' | 'blue' | 'amber' | 'red'> = {
  new: 'green', good: 'blue', fair: 'amber', poor: 'red',
}

const STATUS_TONE: Record<AssetStatus, 'green' | 'blue' | 'amber' | 'gray'> = {
  available: 'green', assigned: 'blue', maintenance: 'amber', retired: 'gray',
}

export function AgencyAssets() {
  const s = useAppState()
  const [mode, setMode] = useViewMode('agencyAssets', MODES, 'gallery')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AgencyAsset | null>(null)
  const [removeTarget, setRemoveTarget] = useState<AgencyAsset | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const TABLE_COLUMNS = [
    { key: 'tag', label: 'Tag', render: (a: AgencyAsset) => <span className="font-mono text-gray-900">{a.tag}</span> },
    { key: 'name', label: 'Name', render: (a: AgencyAsset) => <div className="font-medium text-gray-900">{a.name}</div> },
    { key: 'kind', label: 'Kind', render: (a: AgencyAsset) => <span className="text-gray-600">{a.kind}</span> },
    { key: 'holder', label: 'Holder', render: (a: AgencyAsset) => <span className="text-gray-600">{a.holder ?? '—'}</span> },
    { key: 'clientName', label: 'Client', render: (a: AgencyAsset) => <span className="text-gray-600">{a.clientName ?? '—'}</span> },
    { key: 'status', label: 'Status', render: (a: AgencyAsset) => <StatusChip status={a.status} />, groupable: true },
    { key: 'condition', label: 'Condition', render: (a: AgencyAsset) => <Chip tone={CONDITION_TONE[a.condition]}>{a.condition}</Chip> },
    { key: 'cost', label: 'Cost', render: (a: AgencyAsset) => <span className="tabular-nums">{money(a.cost)}</span>, align: 'right' as const, sortable: true },
    { key: 'action', label: 'Action', render: (a: AgencyAsset) => <RowActions onEdit={() => { setEditing(a); setFormOpen(true) }} onDelete={() => setRemoveTarget(a)} />, align: 'right' as const },
  ]

  const allSelected = s.agencyAssets.length > 0 && selectedIds.length === s.agencyAssets.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < s.agencyAssets.length
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? s.agencyAssets.map((a) => a.id) : [])
  const toggleRow = (id: number, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))

  const assetColumns = (a: AgencyAsset) => ({
    Tag: a.tag, Name: a.name, Kind: a.kind, Holder: a.holder ?? '—',
    Client: a.clientName ?? '—', Status: a.status, Condition: a.condition, Cost: money(a.cost),
  })

  return (
    <>
      <PageHeader
        title="Agency Assets"
        subtitle="Agency-owned devices — laptops, phones, tablets, monitors (doc 08, 25)"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <ViewSwitcher modes={MODES} value={mode} onChange={setMode} />
            <button
              onClick={() => { setEditing(null); setFormOpen(true) }}
              className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
            >
              + New asset
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total assets" value={String(s.agencyAssets.length)} />
        <Stat label="Assigned" value={String(s.agencyAssets.filter((a) => a.status === 'assigned').length)} tone="blue" />
        <Stat label="Available" value={String(s.agencyAssets.filter((a) => a.status === 'available').length)} tone="green" />
        <Stat label="Total value" value={money(s.agencyAssets.reduce((a, x) => a + x.cost, 0))} />
      </div>

      {/* ── GALLERY ── */}
      {mode === 'gallery' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {s.agencyAssets.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="h-28 flex items-center justify-center text-3xl" style={{ background: `linear-gradient(135deg, hsl(${a.imageHue} 65% 90%), hsl(${(a.imageHue + 30) % 360} 65% 80%))` }}>
                {a.kind === 'laptop' ? '💻' : a.kind === 'phone' ? '📱' : a.kind === 'tablet' ? '📱' : a.kind === 'monitor' ? '🖥️' : '📦'}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{a.name}</div>
                    <div className="text-xs text-gray-500">{a.tag} · {a.kind}</div>
                  </div>
                  <Chip tone={STATUS_TONE[a.status]}>{a.status}</Chip>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {a.holder ? `Holder: ${a.holder}` : 'Unassigned'}
                  {a.clientName && ` · ${a.clientName}`}
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {money(a.cost)} · {a.condition} · {a.notes}
                </div>
                <div className="mt-2 flex gap-1.5">
                  {a.status === 'available' && (
                    <button onClick={() => assignAgencyAsset(a.id, 'Zain')} className="text-xs text-blue-600 hover:underline">Assign</button>
                  )}
                  {a.status === 'assigned' && (
                    <button onClick={() => unassignAgencyAsset(a.id)} className="text-xs text-gray-600 hover:underline">Unassign</button>
                  )}
                  <RowActions onEdit={() => { setEditing(a); setFormOpen(true) }} onDelete={() => setRemoveTarget(a)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TABLE (sort, group, bulk-select, CSV) ── */}
      {mode === 'table' && (
        <DataTable
          columns={TABLE_COLUMNS}
          items={s.agencyAssets}
          getId={(a) => a.id}
          defaultSort={{ key: 'cost', direction: 'desc' }}
          selection={{ selectedIds, onSelect: toggleRow, onSelectAll: toggleAll }}
          onExportCSV={(items) => exportToCSV(items, TABLE_COLUMNS, 'agency-assets')}
          exportFilename="agency-assets"
        />
      )}

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New agency asset'}
        fields={ASSET_FIELDS}
        submitLabel={editing ? 'Save changes' : 'Register asset'}
        initial={editing ? {
          tag: editing.tag, name: editing.name, kind: editing.kind, holder: editing.holder,
          clientName: editing.clientName, status: editing.status, condition: editing.condition,
          cost: editing.cost, imageHue: editing.imageHue, notes: editing.notes,
        } : { status: 'available', condition: 'new', imageHue: 200 }}
        onSubmit={(vals) => (editing ? updateAgencyAsset(editing.id, vals) : createAgencyAsset(vals))}
      />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget ? `Delete ${removeTarget.name}?` : ''}
        danger
        confirmLabel="Delete asset"
        message="Removes the asset from the register. Purchase history stays in the books."
        onConfirm={() => (removeTarget ? deleteAgencyAsset(removeTarget.id) : { ok: false, error: 'Nothing selected.' })}
      />
    </>
  )
}