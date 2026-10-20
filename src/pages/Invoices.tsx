import { useMemo, useState } from 'react'
import { PageHeader, Stat } from '../components/Layout'
import { StatusChip, Chip } from '../components/StatusChip'
import { SendEmailModal } from '../components/SendEmailModal'
import { CascadeConfirmModal } from '../components/CascadeConfirmModal'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { CalendarBoard } from '../components/CalendarBoard'
import { DataTable, exportToCSV } from '../components/PipelineBoard'
import {
  useAppState, cascadePreview, sendInvoice,
  createInvoice, updateInvoice, voidInvoice, deleteInvoice,
} from '../lib/store'
import { money, dateShort, dueLabel, dueTone, daysBetween } from '../lib/format'
import type { Invoice, OutboxItem } from '../lib/types'

const ORDER: Record<string, number> = { overdue: 0, sent: 1, viewed: 2, draft: 3, paid: 9, void: 9 }
const MODES: ViewMode[] = ['table', 'list', 'cards', 'calendar']

const INVOICE_FIELDS: FieldDef[] = [
  { key: 'clientName', label: 'Client', type: 'select', required: true, options: [] },
  { key: 'total', label: 'Total (SAR)', type: 'number', required: true, min: 1 },
  { key: 'dueIn', label: 'Due in (days)', type: 'number', min: 0, hint: 'defaults to 14' },
  { key: 'proposalNo', label: 'From proposal', type: 'select', options: [] },
]

function actionsFor(
  inv: Invoice,
  setPayInvoice: (i: Invoice) => void,
  setRemind: (o: OutboxItem) => void,
) {
  if (inv.status === 'draft') {
    return (
      <button
        onClick={() => sendInvoice(inv.id)}
        className="rounded-lg bg-blue-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-blue-700"
      >
        Send
      </button>
    )
  }
  if (inv.status === 'sent' || inv.status === 'viewed' || inv.status === 'overdue') {
    return (
      <div className="flex gap-1.5">
        <button
          onClick={() => setRemind({
            id: -100 - inv.id, contactableName: inv.clientName, stakeholder: 'client',
            templateCode: 'invoice_reminder_1', subject: `Friendly reminder — ${inv.no}`,
            body: `Hi,\n\nA quick reminder that ${inv.no} (${money(inv.total)}) was due on ${dateShort(inv.dueAt)}. Let me know if anything is blocking payment.\n\nThank you,\nZain`,
            dueAt: new Date().toISOString(), status: 'ready',
          })}
          className="rounded-lg bg-white text-gray-600 ring-1 ring-gray-300 text-xs font-medium px-3 py-1.5 hover:bg-gray-50"
        >
          Remind
        </button>
        <button
          onClick={() => setPayInvoice(inv)}
          className="rounded-lg bg-gray-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-gray-800"
        >
          Mark paid
        </button>
      </div>
    )
  }
  if (inv.status === 'paid') return <span className="text-xs text-gray-400">{dateShort(inv.paidAt)}</span>
  return null
}

export function Invoices() {
  const s = useAppState()
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null)
  const [remind, setRemind] = useState<OutboxItem | null>(null)
  const [mode, setMode] = useViewMode('invoices', MODES, 'table')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)
  const [voidTarget, setVoidTarget] = useState<Invoice | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Invoice | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const invoiceFields: FieldDef[] = INVOICE_FIELDS.map((f) =>
    f.key === 'clientName'
      ? { ...f, options: s.clients.map((c) => ({ value: c.name, label: c.name })) }
      : f.key === 'proposalNo'
        ? { ...f, options: s.proposals.map((p) => ({ value: p.no, label: `${p.no} · ${p.leadName}` })) }
        : f,
  )

  const rows = useMemo(() => {
    return [...s.invoices].sort((a, b) => {
      const oa = ORDER[a.status] ?? 5
      const ob = ORDER[b.status] ?? 5
      if (oa !== ob) return oa - ob
      return a.dueAt.localeCompare(b.dueAt)
    })
  }, [s.invoices])

  const open = s.invoices.filter((i) => i.status !== 'paid' && i.status !== 'void')
  const outstanding = open.reduce((a, i) => a + i.total, 0)
  const overdueTotal = s.invoices.filter((i) => i.status === 'overdue').reduce((a, i) => a + i.total, 0)
  const paidThisMonth = s.invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + i.total, 0)

  // Selection helpers
  const allSelected = rows.length > 0 && selectedIds.length === rows.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < rows.length
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? rows.map((r) => r.id) : [])
  const toggleRow = (id: number, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))

  const invoiceColumns = (inv: Invoice) => ({
    Invoice: inv.no,
    Client: inv.clientName,
    Total: inv.total,
    Aging: dueLabel(inv.dueAt, inv.paidAt),
    Status: inv.status,
    Proposal: inv.proposalNo ?? '',
  })

  // DataTable columns for invoices (with custom actions column)
  const TABLE_COLUMNS = [
    { key: 'no', label: 'Invoice', render: (inv: Invoice) => (
      <div>
        <div className="font-medium text-gray-900">{inv.no}</div>
        {inv.proposalNo && <div className="text-xs text-gray-400">from {inv.proposalNo}</div>}
      </div>
    ) },
    { key: 'clientName', label: 'Client', render: (inv: Invoice) => (
      <span className="text-gray-700">{inv.clientName}</span>
    ) },
    { key: 'total', label: 'Total', render: (inv: Invoice) => (
      <span className="text-right tabular-nums font-semibold">{money(inv.total)}</span>
    ), align: 'right' as const },
    { key: 'aging', label: 'Aging', render: (inv: Invoice) => (
      <Chip tone={dueTone(inv.dueAt, inv.paidAt) as 'green' | 'amber' | 'red' | 'gray'}>
        {dueLabel(inv.dueAt, inv.paidAt)}
      </Chip>
    ) },
    { key: 'status', label: 'Status', render: (inv: Invoice) => (
      <StatusChip status={inv.status} domain="invoice" />
    ), groupable: true },
    { key: 'unlocks', label: 'Waits on / unlocks', render: (inv: Invoice) => {
      const unlocks = cascadePreview(inv.id)
      return unlocks.length > 0 ? (
        <>unlocks {unlocks.map((u) => `${u.payee} ${money(u.amount)}`).join(' · ')}</>
      ) : inv.status === 'paid' ? (
        <span className="text-emerald-600">cascade complete{inv.paidVia ? ` · ${inv.paidVia}` : ''}</span>
      ) : '—'
    } },
    { key: 'action', label: 'Action', render: (inv: Invoice) => (
      <div className="flex justify-end items-center gap-1.5">
        {actionsFor(inv, setPayInvoice, setRemind)}
        <RowActions
          onEdit={inv.status === 'draft' ? () => { setEditing(inv); setFormOpen(true) } : undefined}
          extra={inv.status === 'paid' || inv.status === 'void' ? undefined : (
            <button
              onClick={() => (inv.status === 'draft' ? setRemoveTarget(inv) : setVoidTarget(inv))}
              title={inv.status === 'draft' ? 'Delete draft' : 'Void invoice'}
              className="rounded-lg w-7 h-7 text-xs ring-1 ring-gray-300 text-gray-500 hover:bg-red-50 hover:text-red-600"
            >
              ✕
            </button>
          )}
        />
      </div>
    ), align: 'right' as const },
  ]

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Overdue first · marking paid previews its cascade before anything flips"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <ViewSwitcher modes={MODES} value={mode} onChange={setMode} />
            <button
              onClick={() => { setEditing(null); setFormOpen(true) }}
              className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
            >
              + New invoice
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Stat label="Outstanding" value={money(outstanding)} />
        <Stat label="Overdue" value={money(overdueTotal)} tone={overdueTotal ? 'red' : 'green'} />
        <Stat label="Paid (open set)" value={money(paidThisMonth)} tone="green" />
      </div>

      {/* ── TABLE (sort, group, bulk-select, CSV) ── */}
      {mode === 'table' && (
        <DataTable
          columns={TABLE_COLUMNS}
          items={rows}
          getId={(inv) => inv.id}
          defaultSort={{ key: 'no', direction: 'asc' }}
          selection={{
            selectedIds,
            onSelect: toggleRow,
            onSelectAll: toggleAll,
          }}
          onExportCSV={(items) => exportToCSV(items, TABLE_COLUMNS, 'invoices')}
          exportFilename="invoices"
          rowClassName={(inv) => inv.status === 'paid' || inv.status === 'void' ? 'opacity-60' : ''}
        />
      )}

      {/* ── LIST ── */}
      {mode === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-50">
          {rows.map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">
                  {inv.no} <span className="text-gray-400 font-normal">· {inv.clientName}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {dueLabel(inv.dueAt, inv.paidAt)}
                  {inv.proposalNo && ` · from ${inv.proposalNo}`}
                </div>
              </div>
              <span className="text-sm font-semibold tabular-nums">{money(inv.total)}</span>
              <StatusChip status={inv.status} domain="invoice" />
              {actionsFor(inv, setPayInvoice, setRemind)}
              <RowActions
                onEdit={inv.status === 'draft' ? () => { setEditing(inv); setFormOpen(true) } : undefined}
                extra={inv.status === 'paid' || inv.status === 'void' ? undefined : (
                  <button
                    onClick={() => (inv.status === 'draft' ? setRemoveTarget(inv) : setVoidTarget(inv))}
                    title={inv.status === 'draft' ? 'Delete draft' : 'Void invoice'}
                    className="rounded-lg w-7 h-7 text-xs ring-1 ring-gray-300 text-gray-500 hover:bg-red-50 hover:text-red-600"
                  >
                    ✕
                  </button>
                )}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── CARDS ── */}
      {mode === 'cards' && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((inv) => {
            const unlocks = cascadePreview(inv.id)
            return (
              <div key={inv.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{inv.no}</div>
                    <div className="text-xs text-gray-500">{inv.clientName}</div>
                  </div>
                  <StatusChip status={inv.status} domain="invoice" />
                </div>
                <div className="mt-3 text-xl font-bold tabular-nums">{money(inv.total)}</div>
                <div className="mt-1">
                  <Chip tone={dueTone(inv.dueAt, inv.paidAt) as 'green' | 'amber' | 'red' | 'gray'}>
                    {dueLabel(inv.dueAt, inv.paidAt)}
                  </Chip>
                </div>
                {unlocks.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    unlocks: {unlocks.map((u) => u.payee).join(', ')}
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-gray-50 flex flex-wrap gap-1.5 items-center">
                  {actionsFor(inv, setPayInvoice, setRemind)}
                  <span className="ml-auto">
                    <RowActions
                      onEdit={inv.status === 'draft' ? () => { setEditing(inv); setFormOpen(true) } : undefined}
                      extra={inv.status === 'paid' || inv.status === 'void' ? undefined : (
                        <button
                          onClick={() => (inv.status === 'draft' ? setRemoveTarget(inv) : setVoidTarget(inv))}
                          title={inv.status === 'draft' ? 'Delete draft' : 'Void invoice'}
                          className="rounded-lg w-7 h-7 text-xs ring-1 ring-gray-300 text-gray-500 hover:bg-red-50 hover:text-red-600"
                        >
                          ✕
                        </button>
                      )}
                    />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── CALENDAR (due dates) ── */}
      {mode === 'calendar' && (
        <CalendarBoard
          events={rows
            .filter((i) => i.status !== 'paid' && i.status !== 'void')
            .map((inv) => ({
              key: `inv-${inv.id}`,
              date: inv.dueAt,
              label: `${inv.no} due · ${inv.clientName}`,
              kind: 'money',
              tone: dueTone(inv.dueAt) as 'green' | 'amber' | 'red' | 'gray',
              onClick: inv.status === 'draft' || inv.status === 'paid' || inv.status === 'void'
                ? undefined
                : () => setPayInvoice(inv),
            }))}
        />
      )}

      <SendEmailModal item={remind} onClose={() => setRemind(null)} />
      <CascadeConfirmModal invoice={payInvoice} onClose={() => setPayInvoice(null)} />

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.no}` : 'New invoice'}
        fields={editing ? invoiceFields.filter((f) => f.key !== 'clientName') : invoiceFields}
        submitLabel={editing ? 'Save draft' : 'Create draft'}
        initial={editing ? {
          clientName: editing.clientName, total: editing.total,
          dueIn: Math.max(0, Math.round(-daysBetween(editing.dueAt))),
        } : { dueIn: 14, total: 0 }}
        onSubmit={(vals) => (editing ? updateInvoice(editing.id, vals) : createInvoice(vals))}
      />
      <ConfirmModal
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        title={voidTarget ? `Void ${voidTarget.no}?` : ''}
        danger
        confirmLabel="Void invoice"
        message="Voiding keeps the number in the books with a void status — drafts get deleted, sent paperwork gets voided, paid rows never move. Issue a replacement invoice if the amount was wrong."
        onConfirm={() => (voidTarget ? voidInvoice(voidTarget.id) : { ok: false, error: 'Nothing selected.' })}
      />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget ? `Delete ${removeTarget.no}?` : ''}
        danger
        confirmLabel="Delete draft"
        message="Drafts were never sent, so deleting is safe. Nothing in the books changes."
        onConfirm={() => (removeTarget ? deleteInvoice(removeTarget.id) : { ok: false, error: 'Nothing selected.' })}
      />
    </>
  )
}
