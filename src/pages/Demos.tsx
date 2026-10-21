import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { DataTable, exportToCSV } from '../components/PipelineBoard'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { useAppState, createDemo, updateDemo, deleteDemo, archiveDemo, sendDemoLink, incrementDemoViews } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'
import type { Demo, DemoStatus } from '../lib/types'

const MODES: ViewMode[] = ['gallery', 'table']

const STATUS_TONE: Record<DemoStatus, 'gray' | 'blue' | 'green' | 'amber' | 'red'> = {
  building: 'blue', live: 'green', archived: 'gray',
}

const DEMO_FIELDS: FieldDef[] = [
  { key: 'templateName', label: 'Template name', required: true },
  { key: 'forWhom', label: 'For whom', required: true, placeholder: 'Alnoor Hotel · Riyadh Cafe' },
  { key: 'clientName', label: 'Client (optional)' },
  { key: 'expiresAt', label: 'Expires', type: 'date' },
  { key: 'templateId', label: 'Template ID', type: 'number', min: 1 },
]

export function Demos() {
  const s = useAppState()
  const [mode, setMode] = useViewMode('demos', MODES, 'gallery')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Demo | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Demo | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const allSelected = s.demos.length > 0 && selectedIds.length === s.demos.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < s.demos.length
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? s.demos.map((d) => d.id) : [])
  const toggleRow = (id: number, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))

  const demoColumns = (d: Demo) => ({
    Template: d.templateName,
    'For whom': d.forWhom,
    Client: d.clientName ?? '—',
    Status: d.status,
    Views: d.views,
    'Short link': d.shortLink,
    Expires: dateShort(d.expiresAt),
  })

  const TABLE_COLUMNS = [
    { key: 'templateName', label: 'Template', render: (d: Demo) => (
      <div className="font-medium text-gray-900">{d.templateName}</div>
    ) },
    { key: 'forWhom', label: 'For whom', render: (d: Demo) => (
      <span className="text-gray-700">{d.forWhom}</span>
    ) },
    { key: 'clientName', label: 'Client', render: (d: Demo) => (
      <span className="text-gray-600">{d.clientName ?? '—'}</span>
    ) },
    { key: 'status', label: 'Status', render: (d: Demo) => (
      <StatusChip status={d.status} />
    ), groupable: true },
    { key: 'views', label: 'Views', render: (d: Demo) => (
      <span className="tabular-nums text-gray-600">{d.views}</span>
    ), sortable: true },
    { key: 'shortLink', label: 'Short link', render: (d: Demo) => (
      <a href={d.shortLink} target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline truncate max-w-[200px] block">{d.shortLink}</a>
    ) },
    { key: 'expiresAt', label: 'Expires', render: (d: Demo) => (
      <span className="text-gray-600">{dateShort(d.expiresAt)}</span>
    ), sortable: true },
    { key: 'action', label: 'Action', render: (d: Demo) => (
      <div className="flex gap-1.5">
        <button onClick={() => sendDemoLink(d.id)} className="rounded-lg bg-blue-600 text-white text-xs font-medium px-2.5 py-1 hover:bg-blue-700">Send L5</button>
        <button onClick={() => incrementDemoViews(d.id)} className="rounded-lg bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 hover:bg-gray-200">+View</button>
        <RowActions onEdit={() => { setEditing(d); setFormOpen(true) }} onDelete={() => setRemoveTarget(d)} />
      </div>
    ), align: 'right' as const },
  ]

  return (
    <>
      <PageHeader
        title="Demos"
        subtitle="Demo repos auto-built from templates — short links, view tracking, 30-day expiry (doc 04)"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <ViewSwitcher modes={MODES} value={mode} onChange={setMode} />
            <button
              onClick={() => { setEditing(null); setFormOpen(true) }}
              className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
            >
              + New demo
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total demos" value={String(s.demos.length)} />
        <Stat label="Live" value={String(s.demos.filter((d) => d.status === 'live').length)} tone="green" />
        <Stat label="Building" value={String(s.demos.filter((d) => d.status === 'building').length)} tone="blue" />
        <Stat label="Total views" value={String(s.demos.reduce((a, d) => a + d.views, 0))} />
      </div>

      {/* ── GALLERY ── */}
      {mode === 'gallery' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {s.demos.map((d) => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="h-36 flex items-end justify-between p-3" style={{ background: `linear-gradient(135deg, hsl(${d.id * 40 + 200} 70% 88%), hsl(${(d.id * 40 + 240) % 360} 70% 74%))` }}>
                <span className="text-xs font-semibold text-gray-700 bg-white/75 rounded px-2 py-0.5">{d.views} views</span>
                <span className="text-xs text-gray-500 bg-white/60 rounded px-2 py-0.5">{d.status}</span>
              </div>
              <div className="p-3">
                <div className="text-sm font-semibold text-gray-900">{d.templateName}</div>
                <div className="text-xs text-gray-500">{d.forWhom}{d.clientName ? ` · ${d.clientName}` : ''}</div>
                <div className="text-xs text-gray-400 mt-1">expires {dateShort(d.expiresAt)}</div>
                <div className="mt-2 flex gap-1.5">
                  <a href={d.shortLink} target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline">Open demo</a>
                  <button onClick={() => sendDemoLink(d.id)} className="text-xs text-gray-600 hover:text-gray-800">Send L5</button>
                  <button onClick={() => archiveDemo(d.id)} className="text-xs text-gray-400 hover:text-red-600">Archive</button>
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
          items={s.demos}
          getId={(d) => d.id}
          defaultSort={{ key: 'expiresAt', direction: 'asc' }}
          selection={{ selectedIds, onSelect: toggleRow, onSelectAll: toggleAll }}
          onExportCSV={(items) => exportToCSV(items, TABLE_COLUMNS, 'demos')}
          exportFilename="demos"
          rowClassName={(d) => d.status === 'archived' ? 'opacity-60' : ''}
        />
      )}

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.templateName}` : 'New demo'}
        fields={DEMO_FIELDS}
        submitLabel={editing ? 'Save changes' : 'Create demo'}
        initial={editing ? {
          templateName: editing.templateName, forWhom: editing.forWhom,
          clientName: editing.clientName, expiresAt: editing.expiresAt.slice(0, 10),
          templateId: editing.templateId,
        } : undefined}
        onSubmit={(vals) => (editing ? updateDemo(editing.id, vals) : createDemo(vals))}
      />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget ? `Delete ${removeTarget.templateName}?` : ''}
        danger
        confirmLabel="Delete demo"
        message="Archives the demo repo. Short link stops working."
        onConfirm={() => (removeTarget ? deleteDemo(removeTarget.id) : { ok: false, error: 'Nothing selected.' })}
      />
    </>
  )
}