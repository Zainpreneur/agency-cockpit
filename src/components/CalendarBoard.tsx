import { useState } from 'react'
import { toneCls, type Tone } from '../lib/statuses'

// The calendar overlay (doc 25): NO new table — events are the existing
// due_at family (follow-ups, valid_until, invoice due, outbox sends,
// credential expiry) projected into a month grid.

export type CalEvent = {
  key: string
  date: string // ISO
  label: string
  kind: string
  tone: Tone
  onClick?: () => void
}

export function dayKey(iso: string): string {
  const dt = new Date(iso)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarBoard({ events }: { events: CalEvent[] }) {
  const now = new Date()
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [selected, setSelected] = useState<string | null>(null)

  const byDay = new Map<string, CalEvent[]>()
  for (const e of events) {
    const k = dayKey(e.date)
    const arr = byDay.get(k) ?? []
    arr.push(e)
    byDay.set(k, arr)
  }

  const first = new Date(cursor.y, cursor.m, 1)
  const lead = first.getDay()
  const days = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const todayKey = dayKey(now.toISOString())

  const shift = (delta: number) => {
    const next = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: next.getFullYear(), m: next.getMonth() })
    setSelected(null)
  }

  const goToday = () => {
    setCursor({ y: now.getFullYear(), m: now.getMonth() })
    setSelected(todayKey)
  }

  const keyOf = (d: number) =>
    `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const selectedEvents = selected
    ? (byDay.get(selected) ?? [])
    : (byDay.get(todayKey) ?? [])

  const selectedLabel = selected
    ? new Date(selected + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'Today'

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button onClick={() => shift(-1)} className="rounded-lg w-7 h-7 text-gray-500 hover:bg-gray-100" aria-label="Previous month">‹</button>
            <span className="text-sm font-semibold text-gray-900">{monthLabel}</span>
            <button onClick={() => shift(1)} className="rounded-lg w-7 h-7 text-gray-500 hover:bg-gray-100" aria-label="Next month">›</button>
          </div>
          <button onClick={goToday} className="rounded-lg border border-gray-300 text-xs font-medium px-2.5 py-1 hover:bg-gray-50">
            Today
          </button>
        </div>

        <div className="grid grid-cols-7 text-[11px] font-medium text-gray-400 border-b border-gray-100">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-1.5 text-center">{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const k = d ? keyOf(d) : null
            const dayEvents = k ? (byDay.get(k) ?? []) : []
            const isToday = k === todayKey
            const isSelected = k === selected
            return (
              <button
                key={i}
                disabled={!d}
                onClick={() => d && setSelected(k)}
                className={`min-h-24 border-r border-b border-gray-50 p-1.5 text-left align-top transition ${
                  !d ? 'bg-gray-50/50' : isSelected ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                }`}
              >
                {d && (
                  <>
                    <span className={`inline-flex items-center justify-center w-5 h-5 text-xs tabular-nums rounded-full ${
                      isToday ? 'bg-gray-900 text-white font-semibold' : 'text-gray-600'
                    }`}>
                      {d}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 2).map((e) => (
                        <span
                          key={e.key}
                          className={`block rounded px-1 py-0.5 text-[10px] leading-tight ring-1 ring-inset truncate ${toneCls(e.tone)}`}
                          title={`${e.kind} · ${e.label}`}
                        >
                          {e.label}
                        </span>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="block text-[10px] text-gray-400">+{dayEvents.length - 2} more</span>
                      )}
                    </div>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm h-fit">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-900">{selectedLabel}</div>
          <div className="text-xs text-gray-400">{selectedEvents.length} event{selectedEvents.length === 1 ? '' : 's'}</div>
        </div>
        <div className="divide-y divide-gray-50">
          {selectedEvents.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-400 text-center">Nothing due.</div>
          )}
          {selectedEvents.map((e) => (
            <button
              key={e.key}
              onClick={e.onClick}
              disabled={!e.onClick}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 disabled:hover:bg-transparent group"
            >
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${toneCls(e.tone)}`}>
                  {e.kind}
                </span>
                <span className="text-sm text-gray-800 truncate group-hover:text-blue-700">{e.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
