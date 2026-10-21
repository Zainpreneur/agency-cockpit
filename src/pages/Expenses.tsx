import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { DataTable, exportToCSV } from '../components/PipelineBoard'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { useAppState, createExpense, updateExpense, deleteExpense, createToolCost, updateToolCost, deleteToolCost } from '../lib/store'
import { money, dateShort } from '../lib/format'
import type { Expense, ExpenseCategory, ToolCost } from '../lib/types'

const MODES: ViewMode[] = ['table', 'list']

const EXPENSE_FIELDS: FieldDef[] = [
  { key: 'date', label: 'Date', type: 'date', required: true },
  {
    key: 'category', label: 'Category', type: 'select',
    options: [
      { value: 'tools', label: 'Tools' },
      { value: 'utilities', label: 'Utilities' },
      { value: 'ads', label: 'Ads' },
      { value: 'hosting', label: 'Hosting' },
      { value: 'travel', label: 'Travel' },
      { value: 'other', label: 'Other' },
    ],
  },
  { key: 'amount', label: 'Amount', type: 'number', required: true, min: 0 },
  { key: 'currency', label: 'Currency', placeholder: 'SAR' },
  { key: 'sarAmount', label: 'SAR Amount', type: 'number', min: 0 },
  { key: 'allocation', label: 'Allocation', type: 'select', options: [
    { value: 'hours', label: 'By hours' },
    { value: 'flat', label: 'Flat' },
    { value: 'equal', label: 'Equal' },
  ]},
  { key: 'projectName', label: 'Project' },
  { key: 'clientName', label: 'Client' },
  { key: 'note', label: 'Note', type: 'textarea', rows: 2 },
]

const TOOL_COST_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Tool name', required: true },
  { key: 'vendorName', label: 'Vendor' },
  { key: 'plan', label: 'Plan' },
  { key: 'seats', label: 'Seats', type: 'number', min: 1 },
  { key: 'amount', label: 'Amount', type: 'number', required: true, min: 0 },
  { key: 'currency', label: 'Currency', placeholder: 'USD' },
  { key: 'sarAmount', label: 'SAR Amount', type: 'number', min: 0 },
  { key: 'interval', label: 'Interval', type: 'select', options: [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
    { value: 'one_time', label: 'One-time' },
  ]},
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'trial', label: 'Trial' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'cancelled', label: 'Cancelled' },
  ]},
  { key: 'allocatedBy', label: 'Allocated by', type: 'select', options: [
    { value: 'hours', label: 'By hours' },
    { value: 'flat', label: 'Flat' },
    { value: 'equal', label: 'Equal' },
  ]},
]

const CATEGORY_TONE: Record<ExpenseCategory, 'blue' | 'amber' | 'red' | 'green' | 'gray'> = {
  tools: 'blue', utilities: 'amber', ads: 'red', hosting: 'green', travel: 'gray', other: 'gray',
}

export function Expenses() {
  const s = useAppState()
  const [tab, setTab] = useState<'expenses' | 'tools'>('expenses')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | ToolCost | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Expense | ToolCost | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const totalExpenses = s.expenses.reduce((a, e) => a + e.sarAmount, 0)
  const totalToolCosts = s.toolCosts.reduce((a, t) => a + t.sarAmount, 0)

  const allSelected = (tab === 'expenses' ? s.expenses : s.toolCosts).length > 0 && selectedIds.length === (tab === 'expenses' ? s.expenses : s.toolCosts).length
  const someSelected = selectedIds.length > 0 && selectedIds.length < (tab === 'expenses' ? s.expenses : s.toolCosts).length
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? (tab === 'expenses' ? s.expenses : s.toolCosts).map((x) => x.id) : [])
  const toggleRow = (id: number, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))

  const EXPENSE_TABLE_COLUMNS = [
    { key: 'date', label: 'Date', render: (e: Expense) => <span className="text-gray-600">{dateShort(e.date)}</span>, sortable: true },
    { key: 'category', label: 'Category', render: (e: Expense) => <Chip tone={CATEGORY_TONE[e.category]}>{e.category}</Chip>, groupable: true },
    { key: 'amount', label: 'Amount', render: (e: Expense) => <span className="tabular-nums">{money(e.amount)} {e.currency}</span>, align: 'right' as const },
    { key: 'sarAmount', label: 'SAR', render: (e: Expense) => <span className="tabular-nums font-medium">{money(e.sarAmount)}</span>, align: 'right' as const, sortable: true },
    { key: 'allocation', label: 'Allocation', render: (e: Expense) => <span className="text-gray-600 capitalize">{e.allocation}</span> },
    { key: 'projectName', label: 'Project', render: (e: Expense) => <span className="text-gray-600">{e.projectName ?? '—'}</span> },
    { key: 'clientName', label: 'Client', render: (e: Expense) => <span className="text-gray-600">{e.clientName ?? '—'}</span> },
    { key: 'note', label: 'Note', render: (e: Expense) => <span className="text-gray-500 truncate max-w-[200px] block">{e.note ?? '—'}</span> },
    { key: 'action', label: 'Action', render: (e: Expense) => <RowActions onEdit={() => { setEditing(e); setFormOpen(true) }} onDelete={() => setRemoveTarget(e)} />, align: 'right' as const },
  ]

  const TOOL_TABLE_COLUMNS = [
    { key: 'name', label: 'Tool', render: (t: ToolCost) => <div className="font-medium text-gray-900">{t.name}</div> },
    { key: 'vendorName', label: 'Vendor', render: (t: ToolCost) => <span className="text-gray-600">{t.vendorName ?? '—'}</span> },
    { key: 'plan', label: 'Plan', render: (t: ToolCost) => <span className="text-gray-600">{t.plan ?? '—'}</span> },
    { key: 'seats', label: 'Seats', render: (t: ToolCost) => <span className="tabular-nums text-gray-600">{t.seats ?? '—'}</span>, align: 'right' as const },
    { key: 'amount', label: 'Amount', render: (t: ToolCost) => <span className="tabular-nums">{money(t.amount)} {t.currency}</span>, align: 'right' as const },
    { key: 'sarAmount', label: 'SAR', render: (t: ToolCost) => <span className="tabular-nums font-medium">{money(t.sarAmount)}</span>, align: 'right' as const, sortable: true },
    { key: 'interval', label: 'Interval', render: (t: ToolCost) => <Chip tone="gray">{t.interval.replace('_', ' ')}</Chip> },
    { key: 'status', label: 'Status', render: (t: ToolCost) => <StatusChip status={t.status} />, groupable: true },
    { key: 'nextRenewalAt', label: 'Next renewal', render: (t: ToolCost) => <span className="text-gray-600">{dateShort(t.nextRenewalAt)}</span>, sortable: true },
    { key: 'allocatedBy', label: 'Allocated by', render: (t: ToolCost) => <span className="text-gray-600 capitalize">{t.allocatedBy}</span> },
    { key: 'action', label: 'Action', render: (t: ToolCost) => <RowActions onEdit={() => { setEditing(t); setFormOpen(true) }} onDelete={() => setRemoveTarget(t)} />, align: 'right' as const },
  ]

  return (
    <>
      <PageHeader
        title="Expenses & Tool Costs"
        subtitle="True margin: every cost allocated to projects (doc 10) — hours, flat, or equal"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg overflow-hidden ring-1 ring-gray-300">
              <button
                onClick={() => setTab('expenses')}
                className={`px-3 py-1.5 text-xs font-medium capitalize ${tab === 'expenses' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Expenses
              </button>
              <button
                onClick={() => setTab('tools')}
                className={`px-3 py-1.5 text-xs font-medium capitalize ${tab === 'tools' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Tool Costs
              </button>
            </div>
            <button
              onClick={() => { setEditing(null); setFormOpen(true) }}
              className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
            >
              + New {tab === 'expenses' ? 'expense' : 'tool cost'}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total expenses" value={money(totalExpenses)} tone="red" />
        <Stat label="Tool costs (monthly)" value={money(totalToolCosts)} tone="red" />
        <Stat label="Combined" value={money(totalExpenses + totalToolCosts)} tone="red" />
        <Stat label="Expenses count" value={String(s.expenses.length + s.toolCosts.length)} />
      </div>

      {tab === 'expenses' && (
        <DataTable
          columns={EXPENSE_TABLE_COLUMNS}
          items={s.expenses}
          getId={(e) => e.id}
          defaultSort={{ key: 'date', direction: 'desc' }}
          selection={{ selectedIds, onSelect: toggleRow, onSelectAll: toggleAll }}
          onExportCSV={(items) => exportToCSV(items, EXPENSE_TABLE_COLUMNS, 'expenses')}
          exportFilename="expenses"
        />
      )}

      {tab === 'tools' && (
        <DataTable
          columns={TOOL_TABLE_COLUMNS}
          items={s.toolCosts}
          getId={(t) => t.id}
          defaultSort={{ key: 'sarAmount', direction: 'desc' }}
          selection={{ selectedIds, onSelect: toggleRow, onSelectAll: toggleAll }}
          onExportCSV={(items) => exportToCSV(items, TOOL_TABLE_COLUMNS, 'tool-costs')}
          exportFilename="tool-costs"
        />
      )}

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${tab === 'expenses' ? 'expense' : 'tool cost'}` : `New ${tab === 'expenses' ? 'expense' : 'tool cost'}`}
        fields={tab === 'expenses' ? EXPENSE_FIELDS : TOOL_COST_FIELDS}
        submitLabel={editing ? 'Save changes' : `Create ${tab === 'expenses' ? 'expense' : 'tool cost'}`}
        initial={editing ? (tab === 'expenses'
          ? { date: (editing as Expense).date.slice(0, 10), category: (editing as Expense).category, amount: (editing as Expense).amount, currency: (editing as Expense).currency, sarAmount: (editing as Expense).sarAmount, allocation: (editing as Expense).allocation, projectName: (editing as Expense).projectName, clientName: (editing as Expense).clientName, note: (editing as Expense).note }
          : { name: (editing as ToolCost).name, vendorName: (editing as ToolCost).vendorName, plan: (editing as ToolCost).plan, seats: (editing as ToolCost).seats, amount: (editing as ToolCost).amount, currency: (editing as ToolCost).currency, sarAmount: (editing as ToolCost).sarAmount, interval: (editing as ToolCost).interval, status: (editing as ToolCost).status, allocatedBy: (editing as ToolCost).allocatedBy }
        ) : undefined}
        onSubmit={(vals) => (editing
          ? (tab === 'expenses' ? updateExpense(editing.id, vals) : updateToolCost(editing.id, vals))
          : (tab === 'expenses' ? createExpense(vals) : createToolCost(vals)))}
      />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget ? `Delete ${tab === 'expenses' ? (removeTarget as Expense).note || 'expense' : (removeTarget as ToolCost).name}?` : ''}
        danger
        confirmLabel={`Delete ${tab === 'expenses' ? 'expense' : 'tool cost'}`}
        message="Removes the cost row. True margin recalculates."
        onConfirm={() => (removeTarget
          ? (tab === 'expenses' ? deleteExpense(removeTarget.id) : deleteToolCost(removeTarget.id))
          : { ok: false, error: 'Nothing selected.' })}
      />
    </>
  )
}