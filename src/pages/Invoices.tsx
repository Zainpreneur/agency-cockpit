import { useMemo, useState } from 'react'
import { PageHeader, Stat } from '../components/Layout'
import { StatusChip, Chip } from '../components/StatusChip'
import { SendEmailModal } from '../components/SendEmailModal'
import { CascadeConfirmModal } from '../components/CascadeConfirmModal'
import { useAppState, cascadePreview, sendInvoice } from '../lib/store'
import { money, dateShort, dueLabel, daysBetween } from '../lib/format'
import type { Invoice, OutboxItem } from '../lib/types'

const ORDER: Record<string, number> = { overdue: 0, sent: 1, viewed: 2, draft: 3, paid: 9, void: 9 }

export function Invoices() {
  const s = useAppState()
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null)
  const [remind, setRemind] = useState<OutboxItem | null>(null)

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

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Overdue first · marking paid previews its cascade before anything flips"
        action={
          <button
            className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-2 hover:bg-gray-50"
            title="Comes from an accepted proposal or module order in the real build"
          >
            + New invoice
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Stat label="Outstanding" value={money(outstanding)} />
        <Stat label="Overdue" value={money(overdueTotal)} tone={overdueTotal ? 'red' : 'green'} />
        <Stat label="Paid (open set)" value={money(paidThisMonth)} tone="green" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-4 py-2.5 font-medium">Invoice</th>
              <th className="px-4 py-2.5 font-medium">Client</th>
              <th className="px-4 py-2.5 font-medium text-right">Total</th>
              <th className="px-4 py-2.5 font-medium">Aging</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Waits on / unlocks</th>
              <th className="px-4 py-2.5 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((inv) => {
              const unlocks = cascadePreview(inv.id)
              const agingDays = inv.status === 'paid' ? 0 : daysBetween(inv.dueAt)
              return (
                <tr key={inv.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{inv.no}</div>
                    {inv.proposalNo && <div className="text-xs text-gray-400">from {inv.proposalNo}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{inv.clientName}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{money(inv.total)}</td>
                  <td className="px-4 py-3">
                    <Chip tone={inv.status === 'paid' ? 'green' : agingDays > 0 ? 'red' : agingDays > -7 ? 'amber' : 'gray'}>
                      {dueLabel(inv.dueAt, inv.paidAt)}
                    </Chip>
                  </td>
                  <td className="px-4 py-3"><StatusChip status={inv.status} domain="invoice" /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {unlocks.length > 0 ? (
                      <>unlocks {unlocks.map((u) => `${u.payee} ${money(u.amount)}`).join(' · ')}</>
                    ) : inv.status === 'paid' ? (
                      <span className="text-emerald-600">cascade complete{inv.paidVia ? ` · ${inv.paidVia}` : ''}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {inv.status === 'draft' && (
                        <button
                          onClick={() => sendInvoice(inv.id)}
                          className="rounded-lg bg-blue-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-blue-700"
                        >
                          Send
                        </button>
                      )}
                      {(inv.status === 'sent' || inv.status === 'viewed' || inv.status === 'overdue') && (
                        <>
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
                        </>
                      )}
                      {inv.status === 'paid' && <span className="text-xs text-gray-400">{dateShort(inv.paidAt)}</span>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <SendEmailModal item={remind} onClose={() => setRemind(null)} />
      <CascadeConfirmModal invoice={payInvoice} onClose={() => setPayInvoice(null)} />
    </>
  )
}
