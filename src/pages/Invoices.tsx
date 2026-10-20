import { useMemo, useState } from 'react'
import { PageHeader, Stat } from '../components/Layout'
import { StatusChip, Chip } from '../components/StatusChip'
import { SendEmailModal } from '../components/SendEmailModal'
import { CascadeConfirmModal } from '../components/CascadeConfirmModal'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { CalendarBoard } from '../components/CalendarBoard'
import { useAppState, cascadePreview, sendInvoice } from '../lib/store'
import { money, dateShort, dueLabel, dueTone, daysBetween } from '../lib/format'
import type { Invoice, OutboxItem } from '../lib/types'

const ORDER: Record<string, number> = { overdue: 0, sent: 1, viewed: 2, draft: 3, paid: 9, void: 9 }
const MODES: ViewMode[] = ['table', 'list', 'cards', 'calendar']

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
          <div className="flex flex-wrap items-center gap-3">
            <ViewSwitcher modes={MODES} value={mode} onChange={setMode} />
            <button
              className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-2 hover:bg-gray-50"
              title="Comes from an accepted proposal or module order in the real build"
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

      {/* ── TABLE ── */}
      {mode === 'table' && (
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
                      <Chip tone={dueTone(inv.dueAt, inv.paidAt) as 'green' | 'amber' | 'red' | 'gray'}>
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
                      <div className="flex justify-end gap-1.5">{actionsFor(inv, setPayInvoice, setRemind)}</div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
                <div className="mt-3 pt-3 border-t border-gray-50 flex flex-wrap gap-1.5">
                  {actionsFor(inv, setPayInvoice, setRemind)}
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
    </>
  )
}
