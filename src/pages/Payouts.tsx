import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { StatusChip, Chip } from '../components/StatusChip'
import { Modal } from '../components/Modal'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { useAppState, releasePayout } from '../lib/store'
import { money, dateShort } from '../lib/format'
import type { Payout } from '../lib/types'

const COLUMNS: { key: string; label: string; statuses: string[]; hint: string }[] = [
  { key: 'accrued', label: 'Accrued', statuses: ['accrued'], hint: 'earned, not yet triggered' },
  { key: 'blocked', label: 'Blocked', statuses: ['blocked'], hint: 'waiting on a client payment' },
  { key: 'payable', label: 'Payable', statuses: ['payable'], hint: 'money is in — release it' },
  { key: 'paid', label: 'Paid', statuses: ['paid'], hint: 'sent and logged' },
]

const MODES: ViewMode[] = ['board', 'table']

export function Payouts() {
  const s = useAppState()
  const [confirm, setConfirm] = useState<Payout | null>(null)
  const [scope, setScope] = useState<'all' | 'team' | 'investor'>('all')
  const [mode, setMode] = useViewMode('payouts', MODES, 'board')

  const visible = s.payouts.filter((p) => scope === 'all' || p.payeeRole === scope)
  const blockedTotal = visible.filter((p) => p.status === 'blocked').reduce((a, p) => a + p.amount, 0)
  const payableTotal = visible.filter((p) => p.status === 'payable').reduce((a, p) => a + p.amount, 0)

  const releaseBtn = (p: Payout) =>
    p.status === 'payable' ? (
      <button
        onClick={() => setConfirm(p)}
        className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700"
      >
        Release {money(p.amount)}
      </button>
    ) : p.status === 'paid' && p.paidAt ? (
      <span className="text-xs text-gray-400">released {dateShort(p.paidAt)}</span>
    ) : p.status === 'blocked' && s.invoices.find((i) => i.id === p.triggerInvoiceId) ? (
      <Chip tone="gray" title="Blocked until this invoice pays">
        waits on {s.invoices.find((i) => i.id === p.triggerInvoiceId)!.no}{' '}
        {s.invoices.find((i) => i.id === p.triggerInvoiceId)!.status === 'paid' ? '✓' : ''}
      </Chip>
    ) : null

  return (
    <>
      <PageHeader
        title="Payouts"
        subtitle="Blocked ⇄ payable is decided by guards, never by dragging a card — releases are deliberate"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <ViewSwitcher modes={MODES} value={mode} onChange={setMode} />
            <div className="flex rounded-lg overflow-hidden ring-1 ring-gray-300">
              {(['all', 'team', 'investor'] as const).map((x) => (
                <button
                  key={x}
                  onClick={() => setScope(x)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize ${scope === x ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  {x}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Stat label="Blocked" value={money(blockedTotal)} />
        <Stat label="Payable" value={money(payableTotal)} tone={payableTotal ? 'amber' : undefined} />
        <Stat label="Paid" value={money(visible.filter((p) => p.status === 'paid').reduce((a, p) => a + p.amount, 0))} tone="green" />
      </div>

      {mode === 'board' && (
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0">
        {COLUMNS.map((col) => {
          const items = visible.filter((p) => col.statuses.includes(p.status))
          return (
            <div key={col.key} className="w-72 shrink-0">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{col.label}</span>
                <span className="text-xs text-gray-400 tabular-nums">{items.length}</span>
              </div>
              <div className="text-[11px] text-gray-400 px-1 mb-2">{col.hint}</div>
              <div className="space-y-2">
                {items.map((p) => {
                  const invoice = s.invoices.find((i) => i.id === p.triggerInvoiceId)
                  return (
                    <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{p.payee}</div>
                          <div className="text-xs text-gray-500 capitalize">{p.kind.replace('_', ' ')}</div>
                        </div>
                        <StatusChip status={p.status} domain="payout" />
                      </div>
                      <div className="mt-2 text-lg font-semibold tabular-nums">{money(p.amount)}</div>
                      {p.note && <div className="text-xs text-gray-500 mt-1">{p.note}</div>}

                      <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-1.5 flex-wrap">
                        {p.status === 'blocked' && invoice && (
                          <Chip tone="gray" title="Blocked until this invoice pays">
                            waits on {invoice.no} {invoice.status === 'paid' ? '✓' : `(${invoice.status})`}
                          </Chip>
                        )}
                        {p.status === 'payable' && (
                          <button
                            onClick={() => setConfirm(p)}
                            className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700"
                          >
                            Release {money(p.amount)}
                          </button>
                        )}
                        {p.status === 'paid' && p.paidAt && (
                          <span className="text-xs text-gray-400">released {dateShort(p.paidAt)}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
                {items.length === 0 && <div className="rounded-xl border border-dashed border-gray-200 h-14" />}
              </div>
            </div>
          )
        })}
      </div>
      )}

      {/* ── TABLE ── */}
      {mode === 'table' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2.5 font-medium">Payee</th>
                <th className="px-4 py-2.5 font-medium">Kind</th>
                <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Trigger</th>
                <th className="px-4 py-2.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map((p) => {
                const invoice = s.invoices.find((i) => i.id === p.triggerInvoiceId)
                return (
                  <tr key={p.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.payee}</div>
                      {p.note && <div className="text-xs text-gray-400">{p.note}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{p.kind.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{money(p.amount)}</td>
                    <td className="px-4 py-3"><StatusChip status={p.status} domain="payout" /></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{invoice ? invoice.no : '—'}</td>
                    <td className="px-4 py-3"><div className="flex justify-end">{releaseBtn(p)}</div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4">
        <SectionCard title="Why blocked flips happen" hint="the guard, not the gesture">
          <div className="px-4 py-3 text-sm text-gray-600 leading-relaxed">
            A payout marked <em>blocked</em> waits on the invoice it names. When you mark that invoice paid,
            the cascade unlocks it automatically (you saw the preview). There is no way to drag a payout
            straight to <em>paid</em> — money leaving requires money arrived.
          </div>
        </SectionCard>
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Release payout">
        {confirm && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 px-3 py-2.5 flex items-center justify-between text-sm">
              <span>{confirm.payee} · {confirm.kind.replace('_', ' ')}</span>
              <span className="font-semibold tabular-nums">{money(confirm.amount)}</span>
            </div>
            <p className="text-sm text-gray-600">
              This records the payout as paid, writes an event, and queues the payout_released email.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { releasePayout(confirm.id); setConfirm(null) }}
                className="rounded-lg bg-emerald-600 text-white text-sm font-medium px-4 py-2 hover:bg-emerald-700"
              >
                Confirm release
              </button>
              <button onClick={() => setConfirm(null)} className="text-sm text-gray-500 px-3 py-2 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

      {visible.length === 0 && <EmptyRow text="No payouts in this scope." />}
    </>
  )
}
