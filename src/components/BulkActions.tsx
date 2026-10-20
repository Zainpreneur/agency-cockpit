import { useState } from 'react'
import { money } from '../lib/format'

/**
 * Bulk actions bar that appears when rows are selected.
 * Includes CSV export of selected (or all) rows.
 */
export function BulkActionsBar<T extends { id: number }>({
  selectedIds,
  allItems,
  onClearSelection,
  getColumns,
  filename = 'export',
}: {
  selectedIds: number[]
  allItems: T[]
  onClearSelection: () => void
  getColumns: (item: T) => Record<string, string | number>
  filename?: string
}) {
  const [exporting, setExporting] = useState(false)

  const exportCSV = (items: T[]) => {
    setExporting(true)
    try {
      const columns = Object.keys(getColumns(items[0] ?? {}))
      const headers = columns.join(',')
      const rows = items.map((item) => {
        const cols = getColumns(item)
        return columns.map((c) => {
          const val = cols[c]
          // Escape quotes and wrap in quotes if contains comma/quote/newline
          const str = String(val ?? '')
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        }).join(',')
      })
      const csv = [headers, ...rows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
    } finally {
      setExporting(false)
    }
  }

  if (selectedIds.length === 0) return null

  const selectedItems = allItems.filter((i) => selectedIds.includes(i.id))

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-3 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">
          {selectedIds.length} selected
        </span>
        <button
          onClick={() => exportCSV(selectedItems)}
          disabled={exporting}
          className="rounded-lg bg-blue-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Export CSV (selected)'}
        </button>
        <button
          onClick={() => exportCSV(allItems)}
          disabled={exporting}
          className="rounded-lg bg-gray-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-gray-800 disabled:opacity-50"
        >
          Export CSV (all)
        </button>
        <button
          onClick={onClearSelection}
          className="ml-auto text-xs text-gray-500 hover:text-gray-700"
        >
          Clear selection
        </button>
      </div>
    </div>
  )
}

/**
 * Checkbox column header for tables - handles select all / select none.
 */
export function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled = false,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      aria-label={indeterminate ? 'Some selected' : checked ? 'All selected' : 'None selected'}
      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
    />
  )
}

/**
 * Row checkbox for tables.
 */
export function RowCheckbox({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
    />
  )
}