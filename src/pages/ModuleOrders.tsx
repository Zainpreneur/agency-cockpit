import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { PipelineBoard, DataTable, exportToCSV } from '../components/PipelineBoard'
import { useAppState, createModuleOrder, updateModuleOrder, advanceModuleOrder, deleteModuleOrder, convertTicketToModuleOrder } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'
import type { ModuleOrder, ModuleOrderStatus, Ticket } from '../lib/types'

const MODULE_ORDER_COLUMNS: ModuleOrderStatus[] = [
  'requested', 'spec_approved', 'building', 'code_review', 'staging', 'deployed', 'invoiced',
]

const PIPELINE_COLUMNS = [
  { key: 'requested', label: 'Requested', statuses: ['requested'] as ModuleOrderStatus[] },
  { key: 'spec_approved', label: 'Spec Approved', statuses: ['spec_approved'] as ModuleOrderStatus[] },
  { key: 'building', label: 'Building', statuses: ['building'] as ModuleOrderStatus[] },
  { key: 'code_review', label: 'Code Review', statuses: ['code_review'] as ModuleOrderStatus[] },
  { key: 'staging', label: 'Staging', statuses: ['staging'] as ModuleOrderStatus[] },
  { key: 'deployed', label: 'Deployed', statuses: ['deployed'] as ModuleOrderStatus[] },
  { key: 'invoiced', label: 'Invoiced', statuses: ['invoiced'] as ModuleOrderStatus[] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] as ModuleOrderStatus[] },
]

const MODULE_ORDER_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Module name', required: true, placeholder: 'Booking module v2 · Loyalty add-on' },
  { key: 'projectName', label: 'Project', type: 'select', required: true, options: [] },
  { key: 'price', label: 'Price (SAR)', type: 'number', required: true, min: 0 },
  { key: 'fee', label: 'Team fee (SAR)', type: 'number', required: true, min: 0 },
  { key: 'assignee', label: 'Assignee', type: 'select', options: [] },
  { key: 'spec', label: 'Spec', type: 'textarea', rows: 3, hint: 'What this module covers' },
]

const TABLE_COLUMNS = [
  { key: 'name', label: 'Module', render: (mo: ModuleOrder) => (
    <div>
      <div className="font-medium text-gray-900">{mo.name}</div>
      <div className="text-xs text-gray-400">{mo.projectName}</div>
    </div>
  ) },
  { key: 'clientName', label: 'Client', render: (mo: ModuleOrder) => (
    <span className="text-gray-700">{mo.clientName}</span>
  ) },
  { key: 'price', label: 'Price', render: (mo: ModuleOrder) => (
    <span className="text-right tabular-nums font-medium">{money(mo.price)}</span>
  ), align: 'right' as const, sortable: true },
  { key: 'fee', label: 'Fee', render: (mo: ModuleOrder) => (
    <span className="text-right tabular-nums text-emerald-600">{money(mo.fee)}</span>
  ), align: 'right' as const },
  { key: 'assignee', label: 'Assignee', render: (mo: ModuleOrder) => (
    <span className="text-gray-600">{mo.assignee ?? '—'}</span>
  ) },
  { key: 'status', label: 'Status', render: (mo: ModuleOrder) => (
    <StatusChip status={mo.status} />
  ), groupable: true },
  { key: 'prUrl', label: 'PR', render: (mo: ModuleOrder) => (
    mo.prUrl ? <a href={mo.prUrl} target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline">View PR</a> : <span className="text-gray-400">—</span>
  ) },
]

export function ModuleOrders() {
  const s = useAppState()
  const navigate = useNavigate()
  const [mode, setMode] = useViewMode('moduleOrders', ['board', 'table'] as ViewMode[], 'board')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ModuleOrder | null>(null)
  const [removeTarget, setRemoveTarget] = useState<ModuleOrder | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  // ModuleOrderCard component - defined here to capture setEditing, setFormOpen, setRemoveTarget
  function ModuleOrderCard({ mo, onStatus }: { mo: ModuleOrder; onStatus: (s: string) => void }) {
    const nextStatus = MODULE_ORDER_COLUMNS.indexOf(mo.status) < MODULE_ORDER_COLUMNS.length - 1
      ? MODULE_ORDER_COLUMNS[MODULE_ORDER_COLUMNS.indexOf(mo.status) + 1]
      : null

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-gray-900 truncate">{mo.name}</div>
            <div className="text-xs text-gray-500">{mo.projectName} · {mo.clientName}</div>
          </div>
          <StatusChip status={mo.status} />
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-lg font-semibold tabular-nums">{money(mo.price)}</span>
          <span className="text-xs text-emerald-600 font-medium">+ {money(mo.fee)} fee</span>
        </div>

        {mo.assignee && (
          <div className="mt-1 text-xs text-gray-500">Assignee: {mo.assignee}</div>
        )}

        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <Chip tone="gray">{mo.clientName}</Chip>
          {mo.prUrl && (
            <a href={mo.prUrl} target="_blank" rel="noopener" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
              PR
            </a>
          )}
        </div>

        <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-1.5">
          <span className="text-[11px] text-gray-400 mr-auto">advance →</span>
          {nextStatus && (
            <button
              onClick={() => onStatus(nextStatus)}
              className="rounded-full bg-gray-50 text-gray-600 ring-1 ring-gray-200 px-2 py-0.5 text-[11px] hover:bg-gray-100"
              title={`Advance to ${nextStatus}`}
            >
              {nextStatus.replace('_', ' ')}
            </button>
          )}
          <RowActions
            onEdit={() => { setEditing(mo); setFormOpen(true) }}
            onDelete={() => { setRemoveTarget(mo) }}
          />
        </div>
      </div>
    )
  }

  // Build project options for form
  const projectOptions = s.projects.map((p) => ({ value: p.name, label: `${p.name} · ${p.clientName}` }))
  const assigneeOptions = s.team.filter((t) => t.status === 'active').map((t) => ({ value: t.name, label: t.name }))

  const moduleOrderFields = MODULE_ORDER_FIELDS.map((f) =>
    f.key === 'projectName' ? { ...f, options: projectOptions }
    : f.key === 'assignee' ? { ...f, options: assigneeOptions }
    : f
  )

  // Table selection helpers
  const allSelected = s.moduleOrders.length > 0 && selectedIds.length === s.moduleOrders.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < s.moduleOrders.length
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? s.moduleOrders.map((m) => m.id) : [])
  const toggleRow = (id: number, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))

  const moColumns = (mo: ModuleOrder) => ({
    Module: mo.name,
    Project: mo.projectName,
    Client: mo.clientName,
    Price: money(mo.price),
    Fee: money(mo.fee),
    Assignee: mo.assignee ?? '—',
    Status: mo.status,
    PR: mo.prUrl ?? '',
  })

  // Tickets that can be converted
  const convertibleTickets = s.tickets.filter((t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting_client')

  return (
    <>
      <PageHeader
        title="Module Orders"
        subtitle="Add-ons & custom builds — board: requested → spec_approved → building → code_review → staging → deployed → invoiced"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <ViewSwitcher modes={['board', 'table'] as ViewMode[]} value={mode} onChange={setMode} />
            <button
              onClick={() => { setEditing(null); setFormOpen(true) }}
              className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
            >
              + New module order
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total" value={String(s.moduleOrders.length)} />
        <Stat label="In build" value={String(s.moduleOrders.filter((m) => m.status === 'building').length)} />
        <Stat label="In review" value={String(s.moduleOrders.filter((m) => m.status === 'code_review').length)} />
        <Stat label="Deployed" value={String(s.moduleOrders.filter((m) => m.status === 'deployed').length)} tone="green" />
      </div>

      {/* ── BOARD (drag = status flip, event written on drop) ── */}
      {mode === 'board' && (
        <PipelineBoard
          columns={PIPELINE_COLUMNS}
          items={s.moduleOrders}
          renderCard={(mo, onStatus) => <ModuleOrderCard mo={mo} onStatus={onStatus} />}
          onMove={advanceModuleOrder}
          getId={(m) => m.id}
          getStatus={(m) => m.status}
          cardMinWidth={300}
          emptyColumnHeight={72}
          onCascadePreview={(mo, newStatus) => (
            <div className="px-3 py-2 text-sm text-gray-700">
              Advance <strong>{mo.name}</strong> to <span className="font-medium capitalize">{newStatus}</span>
              <br />
              <span className="text-xs text-gray-500">
                {newStatus === 'deployed' ? 'Schedules deploy target update' : newStatus === 'invoiced' ? 'Creates invoice from module price + fee' : 'Writes status event'}
              </span>
            </div>
          )}
        />
      )}

      {/* ── TABLE (sort, group, bulk-select, CSV) ── */}
      {mode === 'table' && (
        <DataTable
          columns={TABLE_COLUMNS}
          items={s.moduleOrders}
          getId={(m) => m.id}
          defaultSort={{ key: 'name', direction: 'asc' }}
          onRowClick={(m) => navigate(`/module-orders/${m.id}`)}
          selection={{
            selectedIds,
            onSelect: toggleRow,
            onSelectAll: toggleAll,
          }}
          onExportCSV={(items) => exportToCSV(items, TABLE_COLUMNS, 'module-orders')}
          exportFilename="module-orders"
        />
      )}

      {/* Convert ticket section */}
      {convertibleTickets.length > 0 && (
        <SectionCard title="Convert Ticket → Module Order" hint="Tickets in progress can become module orders">
          <div className="px-4 py-3 text-sm text-gray-600 leading-relaxed">
            {convertibleTickets.length} ticket{convertibleTickets.length === 1 ? '' : 's'} eligible. Open a ticket detail to convert.
          </div>
        </SectionCard>
      )}

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New module order'}
        fields={moduleOrderFields}
        submitLabel={editing ? 'Save changes' : 'Create module order'}
        initial={editing ? {
          name: editing.name, projectName: editing.projectName, price: editing.price,
          fee: editing.fee, assignee: editing.assignee, spec: editing.spec,
        } : undefined}
        onSubmit={(vals) => (editing ? updateModuleOrder(editing.id, vals) : createModuleOrder(vals))}
      />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget ? `Delete ${removeTarget.name}?` : ''}
        danger
        confirmLabel="Delete module order"
        message="Only requested or cancelled module orders can be deleted. Others must be moved to cancelled first."
        onConfirm={() => (removeTarget ? deleteModuleOrder(removeTarget.id) : { ok: false, error: 'Nothing selected.' })}
      />
    </>
  )
}