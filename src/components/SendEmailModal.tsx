import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import type { OutboxItem } from '../lib/types'
import { sendOutboxItem } from '../lib/store'

/** "Copy + Send" — the email-only v1 send surface (doc 22): edit, copy,
 * open the mail client, or just record it as sent. */
export function SendEmailModal({
  item,
  onClose,
}: {
  item: OutboxItem | null
  onClose: () => void
}) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (item) {
      setSubject(item.subject)
      setBody(item.body)
      setCopied(false)
    }
  }, [item])

  if (!item) return null

  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = body
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const markSent = () => {
    sendOutboxItem(item.id)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`Send to ${item.contactableName}`} wide>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-mono bg-gray-100 rounded px-1.5 py-0.5">{item.templateCode}</span>
          <span>to</span>
          <span className="font-medium text-gray-700">{item.contactableName}</span>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-blue-500"
          />
        </label>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={copy}
            className="rounded-lg bg-gray-900 text-white text-sm font-medium px-4 py-2 hover:bg-gray-800"
          >
            {copied ? '✓ Copied' : 'Copy text'}
          </button>
          <a
            href={mailto}
            onClick={markSent}
            className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
          >
            Open mail app
          </a>
          <button
            onClick={markSent}
            className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-2 hover:bg-gray-50"
          >
            Mark as sent
          </button>
          <button onClick={onClose} className="text-sm text-gray-500 px-3 py-2 hover:text-gray-700">
            Cancel
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Sending happens outside the app (email-only v1). Marking as sent logs it and chains the
          follow-up automatically.
        </p>
      </div>
    </Modal>
  )
}
