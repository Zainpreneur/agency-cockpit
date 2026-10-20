import { useState } from 'react'
import { Modal } from './Modal'
import type { Invoice } from '../lib/types'
import { cascadePreview, markInvoicePaid } from '../lib/store'
import { money } from '../lib/format'
import { Chip } from './StatusChip'

/** Mark paid + the cascade preview: before you confirm, you see exactly
 * which payouts flip blocked → payable. */
export function CascadeConfirmModal({
  invoice,
  onClose,
}: {
  invoice: Invoice | null
  onClose: () => void
}) {
  const [provider, setProvider] = useState<'tap' | 'moyasar' | 'bank'>('bank')
  const [reference, setReference] = useState('')

  if (!invoice) return null

  const unlocks = cascadePreview(invoice.id)

  const confirm = () => {
    markInvoicePaid(invoice.id, { provider, reference: reference || undefined })
    setReference('')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Mark ${invoice.no} as paid`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5">
          <span className="text-sm text-gray-600">
            {invoice.clientName} · {invoice.no}
          </span>
          <span className="text-sm font-semibold tabular-nums">{money(invoice.total)}</span>
        </div>

        <div>
          <span className="text-xs font-medium text-gray-600">Paid via</span>
          <div className="flex gap-2 mt-1.5">
            {(['bank', 'tap', 'moyasar'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset capitalize ${
                  provider === p
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          {provider === 'bank' && (
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transfer reference (optional)"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500"
            />
          )}
        </div>

        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 border-b border-gray-100">
            Cascade preview — confirming makes these payable:
          </div>
          {unlocks.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-400">Nothing unblocks — no payouts wait on this invoice.</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {unlocks.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{p.payee}</span>
                    <Chip tone="gray">{p.kind.replace('_', ' ')}</Chip>
                    <span className="text-gray-400 text-xs">{p.note}</span>
                  </div>
                  <span className="tabular-nums font-medium">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={confirm}
            className="rounded-lg bg-emerald-600 text-white text-sm font-medium px-4 py-2 hover:bg-emerald-700"
          >
            Confirm payment received
          </button>
          <button onClick={onClose} className="text-sm text-gray-500 px-3 py-2 hover:text-gray-700">
            Cancel
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Appends a payment record, flips this invoice to paid, unlocks the payouts above, and
          schedules the thank-you — one atomic action.
        </p>
      </div>
    </Modal>
  )
}
