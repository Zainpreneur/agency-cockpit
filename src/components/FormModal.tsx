import { useEffect, useState } from 'react'
import { Modal } from './Modal'

// One generic form powers every create/edit in the app (doc 27): field
// descriptors in, values out, guards surfaced as inline errors.

export type FieldDef = {
  key: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox'
  options?: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
  hint?: string
  min?: number
  rows?: number
}

export type FormValues = Record<string, string | number | boolean>

export function FormModal({
  open,
  onClose,
  title,
  fields,
  initial,
  onSubmit,
  submitLabel = 'Save',
}: {
  open: boolean
  onClose: () => void
  title: string
  fields: FieldDef[]
  initial?: Partial<FormValues>
  onSubmit: (values: FormValues) => { ok: true; id?: number } | { ok: false; error: string } | Promise<{ ok: true; id?: number } | { ok: false; error: string }>
  submitLabel?: string
}) {
  const [vals, setVals] = useState<FormValues>({})
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const init: FormValues = {}
    for (const f of fields) {
      const v = initial?.[f.key]
      init[f.key] = v !== undefined && v !== null ? v : f.type === 'number' ? 0 : f.type === 'checkbox' ? false : ''
    }
    setVals(init)
    setErr(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = (key: string, v: string | number | boolean) =>
    setVals((p) => ({ ...p, [key]: v }))

  const submit = async () => {
    for (const f of fields) {
      const raw = vals[f.key]
      const empty = raw === '' || raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')
      if (f.required && empty) {
        setErr(`${f.label} is required.`)
        return
      }
      if (f.type === 'email' && raw && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(raw))) {
        setErr(`${f.label} needs a valid email address.`)
        return
      }
      if (f.type === 'number' && !empty) {
        const n = Number(raw)
        if (Number.isNaN(n)) { setErr(`${f.label} must be a number.`); return }
        if (f.min !== undefined && n < f.min) { setErr(`${f.label} must be at least ${f.min}.`); return }
      }
    }
    setBusy(true)
    const res = await onSubmit(vals)
    setBusy(false)
    if (!res.ok) setErr(res.error)
    else onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
        {fields.map((f) => {
          const t = f.type ?? 'text'
          const common =
            'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
          const label = (
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {f.label}
              {f.required && <span className="text-red-500"> *</span>}
            </label>
          )
          return (
            <div key={f.key} className={t === 'textarea' ? 'sm:col-span-2' : ''}>
              {t === 'checkbox' ? (
                <label className="flex items-center gap-2 text-sm text-gray-700 pt-5">
                  <input
                    type="checkbox"
                    checked={vals[f.key] === true}
                    onChange={(e) => set(f.key, e.target.checked)}
                    className="rounded border-gray-300 w-4 h-4"
                  />
                  {f.label}
                  {f.required && <span className="text-red-500">*</span>}
                </label>
              ) : (
                <>
                  {label}
                  {t === 'select' ? (
                    <select value={String(vals[f.key] ?? '')} onChange={(e) => set(f.key, e.target.value)} className={common}>
                      <option value="">Choose…</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : t === 'textarea' ? (
                    <textarea
                      rows={f.rows ?? 4}
                      value={String(vals[f.key] ?? '')}
                      placeholder={f.placeholder}
                      onChange={(e) => set(f.key, e.target.value)}
                      className={common + ' font-mono text-xs'}
                    />
                  ) : (
                    <input
                      type={t}
                      value={String(vals[f.key] ?? '')}
                      min={f.min}
                      placeholder={f.placeholder}
                      onChange={(e) => set(f.key, t === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                      className={common}
                    />
                  )}
                  {f.hint && <div className="text-[11px] text-gray-400 mt-0.5">{f.hint}</div>}
                </>
              )}
            </div>
          )
        })}
      </div>

      {err && (
        <div className="mt-3 rounded-lg bg-red-50 ring-1 ring-red-200 px-3 py-2 text-sm text-red-700">{err}</div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-gray-900 text-white text-sm font-medium px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button onClick={onClose} className="text-sm text-gray-500 px-3 py-2 hover:text-gray-700">
          Cancel
        </button>
      </div>
    </Modal>
  )
}
