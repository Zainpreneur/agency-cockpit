import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { DataTable, exportToCSV } from '../components/PipelineBoard'
import { useAppState, createTicket, updateTicket, deleteTicket, convertTicketToModuleOrder } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'
import type { Ticket, TicketPriority, TicketStatus } from '../lib/types'

const PRIORITY_TONE: Record<TicketPriority, 'gray' | 'blue' | 'amber' | 'red'> = {
  low: 'gray', normal: 'blue', high: 'amber', urgent: 'red',
}

const STATUS_TONE: Record<TicketStatus, 'gray' | 'blue' | 'amber' | 'green' | 'red'> = {
  open: 'blue', in_progress: 'amber', waiting_client: 'gray', resolved: 'green', closed: 'gray',
}

const MODES: ViewMode[] = ['table', 'list']

const TICKET_FIELDS: FieldDef[] = [
  { key: 'subject', label: 'Subject', required: true },
  { key: 'clientName', label: 'Client', type: 'select', required: true, options: [] },
  { key: 'projectName', label: 'Project', type: 'select', options: [] },
  {
    key: 'priority', label: 'Priority', type: 'select',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'normal', label: 'Normal' },
      { value: 'high', label: 'High' },
      { value: 'urgent', label: 'Urgent' },
    ],
  },
  { key: 'assignee', label: 'Assignee', type: 'select', options: [] },
  { key: 'notes', label: 'Notes', type: 'textarea', rows: 3 },
]

const TABLE_COLUMNS = [
  { key: 'subject', label: 'Subject', render: (t: Ticket) => (
    <div className="font-medium text-gray-900">{t.subject}</div>
  ) },
  { key: 'clientName', label: 'Client', render: (t: Ticket) => (
    <span className="text-gray-700">{t.clientName}</span>
  ) },
  { key: 'projectName', label: 'Project', render: (t: Ticket) => (
    <span className="text-gray-600">{t.projectName ?? '—'}</span>
  ) },
  { key: 'priority', label: 'Priority', render: (t: Ticket) => (
    <Chip tone={PRIORITY_TONE[t.priority]}>{t.priority}</Chip>
  ), groupable: true },
  { key: 'status', label: 'Status', render: (t: Ticket) => (
    <StatusChip status={t.status} />
  ), groupable: true },
  { key: 'assignee', label: 'Assignee', render: (t: Ticket) => (
    <span className="text-gray-600">{t.assignee ?? '—'}</span>
  ) },
  { key: 'age', label: 'Age', render: (t: Ticket) => (
    <span className="text-gray-600">{daysBetween(t.createdAt)}d</span>
  ), sortable: true },
]

export function Tickets() {
  const s = useAppState()
  const navigate = useNavigate()
  const [mode, setMode] = useViewMode('tickets', MODES, 'table')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Ticket | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Ticket | null>(null)
  const [convertTarget, setConvertTarget] = useState<Ticket | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  // Build select options
  const clientOptions = s.clients.map((c) => ({ value: c.name, label: c.name }))
  const projectOptions = s.projects.map((p) => ({ value: p.name, label: `${p.name} · ${p.clientName}` }))
  const assigneeOptions = s.team.filter((t) => t.status === 'active').map((t) => ({ value: t.name, label: t.name }))

  const ticketFields = TICKET_FIELDS.map((f) =>
    f.key === 'clientName' ? { ...f, options: clientOptions }
    : f.key === 'projectName' ? { ...f, options: projectOptions }
    : f.key === 'assignee' ? { ...f, options: assigneeOptions }
    : f
  )

  // Table selection helpers
  const allSelected = s.tickets.length > 0 && selectedIds.length === s.tickets.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < s.tickets.length
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? s.tickets.map((t) => t.id) : [])
  const toggleRow = (id: number, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))

  const ticketColumns = (t: Ticket) => ({
    Subject: t.subject,
    Client: t.clientName,
    Project: t.projectName ?? '',
    Priority: t.priority,
    Status: t.status,
    Assignee: t.assignee ?? '',
    Age: daysBetween(t.createdAt) + 'd',
  })

  return (
    <>
      <PageHeader
        title="Tickets"
        subtitle="Support & delivery issues — convert to module order when scope grows"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <ViewSwitcher modes={MODES} value={mode} onChange={setMode} />
            <button
              onClick={() => { setEditing(null); setFormOpen(true) }}
              className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
            >
              + New ticket
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Open" value={String(s.tickets.filter((t) => t.status === 'open').length)} />
        <Stat label="In progress" value={String(s.tickets.filter((t) => t.status === 'in_progress').length)} tone="amber" />
        <Stat label="Waiting on client" value={String(s.tickets.filter((t) => t.status === 'waiting_client').length)} tone="amber" />
        <Stat label="Resolved" value={String(s.tickets.filter((t) => t.status === 'resolved').length)} tone="green" />
      </div>

      {/* ── TABLE (sort, group, bulk-select, CSV) ── */}
      {mode === 'table' && (
        <DataTable
          columns={TABLE_COLUMNS}
          items={s.tickets}
          getId={(t) => t.id}
          defaultSort={{ key: 'createdAt', direction: 'desc' }}
          onRowClick={(t) => navigate(`/tickets/${t.id}`)}
          selection={{
            selectedIds,
            onSelect: toggleRow,
            onSelectAll: toggleAll,
          }}
          onExportCSV={(items) => exportToCSV(items, TABLE_COLUMNS, 'tickets')}
          exportFilename="tickets"
          rowClassName={(t) => t.status === 'resolved' || t.status === 'closed' ? 'opacity-60' : ''}
        />
      )}

      {/* ── LIST ── */}
      {mode === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-50">
          {s.tickets.map((t) => (
            <Link key={t.id} to={`/tickets/${t.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-gray-50/70">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">{t.subject}</div>
                <div className="text-xs text-gray-500">{t.clientName} · {t.projectName ?? 'no project'}</div>
              </div>
              <Chip tone={PRIORITY_TONE[t.priority]}>{t.priority}</Chip>
              <StatusChip status={t.status} />
              <span className="text-xs text-gray-400 w-16 text-right">{daysBetween(t.createdAt)}d</span>
            </Link>
          ))}
        </div>
      )}

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.subject}` : 'New ticket'}
        fields={ticketFields}
        submitLabel={editing ? 'Save changes' : 'Create ticket'}
        initial={editing ? {
          subject: editing.subject, clientName: editing.clientName, projectName: editing.projectName,
          priority: editing.priority, assignee: editing.assignee, notes: editing.notes,
        } : { priority: 'normal' }}
        onSubmit={(vals) => (editing ? updateTicket(editing.id, vals) : createTicket(vals))}
      />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget ? `Delete ${removeTarget.subject}?` : ''}
        danger
        confirmLabel="Delete ticket"
        message="Permanently removes the ticket. Convert to module order first if it represents billable work."
        onConfirm={() => (removeTarget ? deleteTicket(removeTarget.id) : { ok: false, error: 'Nothing selected.' })}
      />
    </>
  )
}