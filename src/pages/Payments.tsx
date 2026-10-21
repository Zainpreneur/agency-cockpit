import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { StatusChip, Chip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { DataTable, exportToCSV } from '../components/PipelineBoard'
import { useAppState } from '../lib/store'
import { money, dateShort } from '../lib/format'
import type { Payment } from '../lib/types'

const MODES: ViewMode[] = ['table']

const TABLE_COLUMNS = [
  { key: 'id', label: 'Payment', render: (p: Payment) => (
    <span className="font-medium text-gray-900">#{p.id}</span>
  ) },
  { key: 'invoiceId', label: 'Invoice', render: (p: Payment) => (
    <span className="text-gray-700">INV-{p.invoiceId}</span>
  ) },
  { key: 'provider', label: 'Provider', render: (p: Payment) => (
    <Chip tone={p.provider === 'bank' ? 'gray' : p.provider === 'tap' ? 'blue' : 'amber'}>{p.provider}</Chip>
  ), groupable: true },
  { key: 'amount', label: 'Amount', render: (p: Payment) => (
    <span className="tabular-nums font-medium">{money(p.amount)}</span>
  ), align: 'right' as const, sortable: true },
  { key: 'paidAt', label: 'Paid at', render: (p: Payment) => (
    <span className="text-gray-600">{dateShort(p.paidAt)}</span>
  ), sortable: true },
  { key: 'reference', label: 'Reference', render: (p: Payment) => (
    <span className="text-gray-500 font-mono text-xs">{p.reference ?? '—'}</span>
  ) },
]

export function Payments() {
  const s = useAppState()

  // Mock payments from invoices
  const payments = s.invoices.filter((i) => i.status === 'paid' && i.paidAt).map((inv, idx) => ({
    id: idx + 1,
    invoiceId: inv.id,
    provider: (['bank', 'tap', 'moyasar'] as const)[idx % 3],
    amount: inv.total,
    paidAt: inv.paidAt!,
    reference: inv.paidVia === 'bank' ? `TRF-${1000 + idx}` : undefined,
  }))

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Read-only table — payments are written only by webhooks (doc 06)"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Stat label="Total payments" value={String(payments.length)} />
        <Stat label="Total collected" value={money(payments.reduce((a, p) => a + p.amount, 0))} tone="green" />
        <Stat label="By bank" value={String(payments.filter((p) => p.provider === 'bank').length)} />
      </div>

      <DataTable
        columns={TABLE_COLUMNS}
        items={payments}
        getId={(p) => p.id}
        defaultSort={{ key: 'paidAt', direction: 'desc' }}
        onExportCSV={(items) => exportToCSV(items, TABLE_COLUMNS, 'payments')}
        exportFilename="payments"
      />
    </>
  )
}