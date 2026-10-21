import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { DataTable, exportToCSV } from '../components/PipelineBoard'
import { useAppState } from '../lib/store'
import { money, dateShort } from '../lib/format'
import type { InvestorPayoutDetail } from '../lib/types'

const MODES: ViewMode[] = ['board', 'table']

const STATUS_TONE: Record<string, 'gray' | 'amber' | 'green' | 'red'> = {
  accrued: 'gray', blocked: 'gray', payable: 'amber', paid: 'green', cancelled: 'red',
}

export function InvestorPayouts() {
  const s = useAppState()
  const [mode, setMode] = useViewMode('investorPayouts', MODES, 'board')
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const allSelected = s.investorPayouts.length > 0 && selectedIds.length === s.investorPayouts.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < s.investorPayouts.length
  const toggleAll = (checked: boolean) => setSelectedIds(checked ? s.investorPayouts.map((p) => p.id) : [])
  const toggleRow = (id: number, checked: boolean) =>
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)))

  const TABLE_COLUMNS = [
    { key: 'investorName', label: 'Investor', render: (p: InvestorPayoutDetail) => <span className="font-medium text-gray-900">{p.investorName}</span> },
    { key: 'roundProject', label: 'Round', render: (p: InvestorPayoutDetail) => <span className="text-gray-700">{p.roundProject}</span> },
    { key: 'amount', label: 'Amount', render: (p: InvestorPayoutDetail) => <span className="tabular-nums font-medium">{money(p.amount)}</span>, align: 'right' as const, sortable: true },
    { key: 'tier', label: 'Tier', render: (p: InvestorPayoutDetail) => <Chip tone={p.tier === 'senior' ? 'blue' : 'gray'}>{p.tier}</Chip>, groupable: true },
    { key: 'status', label: 'Status', render: (p: InvestorPayoutDetail) => <StatusChip status={p.status} />, groupable: true },
    { key: 'triggerInvoiceId', label: 'Trigger', render: (p: InvestorPayoutDetail) => <span className="text-gray-600">{p.triggerInvoiceId ? `INV-${p.triggerInvoiceId}` : '—'}</span> },
    { key: 'paidAt', label: 'Paid at', render: (p: InvestorPayoutDetail) => <span className="text-gray-600">{p.paidAt ? dateShort(p.paidAt) : '—'}</span>, sortable: true },
  ]

  const COLUMNS = [
    { key: 'accrued', label: 'Accrued', statuses: ['accrued'] },
    { key: 'blocked', label: 'Blocked', statuses: ['blocked'] },
    { key: 'payable', label: 'Payable', statuses: ['payable'] },
    { key: 'paid', label: 'Paid', statuses: ['paid'] },
  ]

  return (
    <>
      <PageHeader
        title="Investor Payouts"
        subtitle="Board: accrued → blocked → payable → paid (doc 13, 25)"
        action={
          <ViewSwitcher modes={MODES} value={mode} onChange={setMode} />
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total" value={String(s.investorPayouts.length)} />
        <Stat label="Blocked" value={String(s.investorPayouts.filter((p) => p.status === 'blocked').length)} tone="amber" />
        <Stat label="Payable" value={String(s.investorPayouts.filter((p) => p.status === 'payable').length)} tone="amber" />
        <Stat label="Paid" value={String(s.investorPayouts.filter((p) => p.status === 'paid').length)} tone="green" />
      </div>

      {mode === 'board' && (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {COLUMNS.map((col) => {
            const items = s.investorPayouts.filter((p) => col.statuses.includes(p.status))
            return (
              <div key={col.key} className="w-72 shrink-0">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{col.label}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((p) => (
                    <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{p.investorName}</div>
                          <div className="text-xs text-gray-500">{p.roundProject}</div>
                        </div>
                        <Chip tone={p.tier === 'senior' ? 'blue' : 'gray'}>{p.tier}</Chip>
                      </div>
                      <div className="mt-2 text-lg font-semibold tabular-nums">{money(p.amount)}</div>
                      <div className="mt-1">
                        <StatusChip status={p.status} />
                      </div>
                      {p.status === 'payable' && (
                        <button className="mt-2 w-full rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700">
                          Release {money(p.amount)}
                        </button>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && <div className="rounded-xl border border-dashed border-gray-200 h-14" />}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {mode === 'table' && (
        <DataTable
          columns={TABLE_COLUMNS}
          items={s.investorPayouts}
          getId={(p) => p.id}
          defaultSort={{ key: 'amount', direction: 'desc' }}
          selection={{ selectedIds, onSelect: toggleRow, onSelectAll: toggleAll }}
          onExportCSV={(items) => exportToCSV(items, TABLE_COLUMNS, 'investor-payouts')}
          exportFilename="investor-payouts"
        />
      )}
    </>
  )
}