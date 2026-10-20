import { useState, type ReactNode } from 'react'
import { Modal } from './Modal'

// Delete/archive confirm with guard errors surfaced inline — store guards
// return { ok: false, error } and the reason shows right here (doc 27).
export function ConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => { ok: true; id?: number } | { ok: false; error: string }
}) {
  const [err, setErr] = useState<string | null>(null)

  const confirm = () => {
    const res = onConfirm()
    if (!res.ok) setErr(res.error)
    else { setErr(null); onClose() }
  }

  return (
    <Modal open={open} onClose={() => { setErr(null); onClose() }} title={title}>
      <div className="text-sm text-gray-600 leading-relaxed">{message}</div>
      {err && (
        <div className="mt-3 rounded-lg bg-red-50 ring-1 ring-red-200 px-3 py-2 text-sm text-red-700">{err}</div>
      )}
      <div className="mt-4 flex gap-2">
        <button
          onClick={confirm}
          className={`rounded-lg text-white text-sm font-medium px-4 py-2 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-900 hover:bg-gray-800'}`}
        >
          {confirmLabel}
        </button>
        <button onClick={() => { setErr(null); onClose() }} className="text-sm text-gray-500 px-3 py-2 hover:text-gray-700">
          Cancel
        </button>
      </div>
    </Modal>
  )
}
