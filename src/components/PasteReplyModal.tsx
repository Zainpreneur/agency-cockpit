import { useState } from 'react'
import { Modal } from './Modal'
import { pasteInboundReply, pendingOutboxFor } from '../lib/store'

/** Paste what the other side actually replied → logs it, flips status,
 * cancels pending outbound (reply-cancels-pending, doc 22). */
export function PasteReplyModal({
  lead,
  onClose,
}: {
  lead: { businessName: string } | null
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [flipTo, setFlipTo] = useState('')

  if (!lead) return null

  const pending = pendingOutboxFor(lead.businessName)
  const canned = [
    { label: 'Accepted — proceed', flip: 'negotiating' },
    { label: 'Asked a question', flip: 'negotiating' },
    { label: 'Wants changes', flip: 'negotiating' },
    { label: 'Said no', flip: 'lost' },
    { label: 'Wants a demo', flip: 'demo_shared' },
  ]

  const save = () => {
    if (!text.trim()) return
    pasteInboundReply(lead.businessName, text.trim(), flipTo || undefined)
    setText('')
    setFlipTo('')
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Paste reply — ${lead.businessName}`} wide>
      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">What did they say? (paste it)</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            autoFocus
            placeholder="Looks good — send us the invoice…"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-blue-500"
          />
        </label>

        <div>
          <span className="text-xs font-medium text-gray-600">Result (optional — flips their status)</span>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {canned.map((c) => (
              <button
                key={c.flip + c.label}
                onClick={() => setFlipTo(flipTo === c.flip ? '' : c.flip)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${
                  flipTo === c.flip
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {pending.length > 0 && (
          <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 px-3 py-2 text-xs text-amber-800">
            This cancels {pending.length} pending outgoing message{pending.length > 1 ? 's' : ''}:{' '}
            {pending.map((p) => p.templateCode).join(', ')} (their reply wins).
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={save}
            disabled={!text.trim()}
            className="rounded-lg bg-gray-900 text-white text-sm font-medium px-4 py-2 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Record reply
          </button>
          <button onClick={onClose} className="text-sm text-gray-500 px-3 py-2 hover:text-gray-700">
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}
