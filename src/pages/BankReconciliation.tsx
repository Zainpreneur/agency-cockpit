import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { useAppState } from '../lib/store'
import { money, dateShort } from '../lib/format'

const RECON_FIELDS: FieldDef[] = [
  { key: 'month', label: 'Month (YYYY-MM)', required: true, placeholder: '2026-10' },
  { key: 'statementBalance', label: 'Statement balance (SAR)', type: 'number', required: true, min: 0 },
  { key: 'recordedBalance', label: 'Recorded balance (SAR)', type: 'number', required: true, min: 0 },
  { key: 'note', label: 'Note', type: 'textarea', rows: 2 },
]

export function BankReconciliation() {
  const s = useAppState()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [removeTarget, setRemoveTarget] = useState<any>(null)

  // Mock reconciliation data
  const reconciliations = [
    { id: 1, month: '2026-10', statementBalance: 41200, recordedBalance: 40850, diff: 350, note: 'Pending transfer from Alnoor — cleared next day' },
    { id: 2, month: '2026-09', statementBalance: 38500, recordedBalance: 38500, diff: 0, note: 'Clean month' },
    { id: 3, month: '2026-08', statementBalance: 35200, recordedBalance: 35900, diff: -700, note: 'Bank fee not yet recorded — adjusted' },
  ]

  return (
    <>
      <PageHeader
        title="Bank Reconciliation"
        subtitle="Monthly bank truth vs recorded cash — one row per month (doc 24, schema v9)"
        action={
          <button
            onClick={() => { setEditing(null); setFormOpen(true) }}
            className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
          >
            + New reconciliation
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Stat label="Latest statement" value={money(reconciliations[0]?.statementBalance ?? 0)} />
        <Stat label="Latest recorded" value={money(reconciliations[0]?.recordedBalance ?? 0)} />
        <Stat label="Latest diff" value={money(reconciliations[0]?.diff ?? 0)} tone={reconciliations[0]?.diff !== 0 ? 'amber' : 'green'} />
      </div>

      <SectionCard title="Reconciliation History" hint="monthly — one row per month">
        {reconciliations.length === 0 && <EmptyRow text="No reconciliations yet." />}
        {reconciliations.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-900">{r.month}</div>
              <div className="text-xs text-gray-500">{r.note}</div>
            </div>
            <div className="text-right tabular-nums">
              <div className="text-sm font-medium text-gray-900">{money(r.statementBalance)}</div>
              <div className="text-xs text-gray-400">statement</div>
            </div>
            <div className="text-right tabular-nums">
              <div className="text-sm font-medium text-gray-900">{money(r.recordedBalance)}</div>
              <div className="text-xs text-gray-400">recorded</div>
            </div>
            <div className="text-right tabular-nums">
              <div className={`text-sm font-semibold ${r.diff === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>{money(r.diff)}</div>
              <div className="text-xs text-gray-400">diff</div>
            </div>
            <Chip tone={r.diff === 0 ? 'green' : 'amber'}>{r.diff === 0 ? 'Clean' : 'Variance'}</Chip>
            <RowActions onEdit={() => { setEditing(r); setFormOpen(true) }} onDelete={() => setRemoveTarget(r)} />
          </div>
        ))}
      </SectionCard>

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.month}` : 'New reconciliation'}
        fields={RECON_FIELDS}
        submitLabel={editing ? 'Save changes' : 'Create reconciliation'}
        initial={editing ? {
          month: editing.month, statementBalance: editing.statementBalance,
          recordedBalance: editing.recordedBalance, note: editing.note,
        } : undefined}
        onSubmit={() => ({ ok: true })}
      />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget ? `Delete ${removeTarget.month}?` : ''}
        danger
        confirmLabel="Delete reconciliation"
        message="Removes the reconciliation row. Re-add if needed."
        onConfirm={() => ({ ok: true })}
      />
    </>
  )
}