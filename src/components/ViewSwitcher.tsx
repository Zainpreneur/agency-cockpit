import { useState } from 'react'

// Doc 25: table · list · board · cards · timeline · gallery · 360 (+ calendar
// overlay). Every entity picks its own subset; the choice persists locally.

export type ViewMode = 'table' | 'list' | 'board' | 'cards' | 'timeline' | 'gallery' | 'calendar'

const LABELS: Record<ViewMode, string> = {
  table: 'Table',
  list: 'List',
  board: 'Board',
  cards: 'Cards',
  timeline: 'Timeline',
  gallery: 'Gallery',
  calendar: 'Calendar',
}

const storageKey = (key: string) => `agencyos.view.${key}`

export function useViewMode(
  key: string,
  modes: ViewMode[],
  fallback: ViewMode,
): [ViewMode, (m: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(storageKey(key))
      if (saved && (modes as string[]).includes(saved)) return saved as ViewMode
    } catch {
      /* private mode etc. */
    }
    return modes.includes(fallback) ? fallback : modes[0]
  })
  const set = (next: ViewMode) => {
    setMode(next)
    try {
      localStorage.setItem(storageKey(key), next)
    } catch {
      /* ignore */
    }
  }
  return [mode, set]
}

export function ViewSwitcher({
  modes,
  value,
  onChange,
}: {
  modes: ViewMode[]
  value: ViewMode
  onChange: (m: ViewMode) => void
}) {
  if (modes.length < 2) return null
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1 w-fit" role="tablist" aria-label="View">
      {modes.map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={value === m}
          onClick={() => onChange(m)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            value === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {LABELS[m]}
        </button>
      ))}
    </div>
  )
}
