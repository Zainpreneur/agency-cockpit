import { useState, useMemo, useCallback } from 'react'
import { StatusChip, Chip } from './StatusChip'
import { money, dateShort } from '../lib/format'
import type { Lead, Proposal, Invoice, Payout, Project, PurchaseOrder } from '../lib/types'
import { metaFor } from '../lib/statuses'
import { StatusEvent } from '../lib/types'

/**
 * Column definition for PipelineBoard (kanban) — needs statuses for grouping
 */
export interface PipelineColumnDef<T> {
  key: string
  label: string
  statuses: string[]
  color?: string
}

export interface PipelineBoardProps<T extends { id: number; status: string }> {
  columns: PipelineColumnDef<T>[]
  items: T[]
  renderCard: (item: T, onStatusChange: (newStatus: string) => void) => React.ReactElement
  onMove: (itemId: number, newStatus: string) => void
  getId: (item: T) => number
  getStatus: (item: T) => string
  emptyColumnHeight?: number
  cardMinWidth?: number
  onCascadePreview?: (item: T, newStatus: string) => React.ReactElement | null
}

export function PipelineBoard<T extends { id: number; status: string }>({
  columns,
  items,
  renderCard,
  onMove,
  getId,
  getStatus,
  emptyColumnHeight = 96,
  cardMinWidth = 256,
  onCascadePreview,
}: PipelineBoardProps<T>) {
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [cascadePreview, setCascadePreview] = useState<React.ReactElement | null>(null)
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, id: number) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(id))
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedId(null)
    setDragOverColumn(null)
    setCascadePreview(null)
    setPreviewPosition(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnKey)

    const id = Number(e.dataTransfer.getData('text/plain'))
    const targetColumn = columns.find((c) => c.key === columnKey)
    if (targetColumn && onCascadePreview) {
      const item = items.find((i) => getId(i) === id)
      if (item && getStatus(item) !== targetColumn.statuses[0]) {
        const preview = onCascadePreview(item, targetColumn.statuses[0])
        setCascadePreview(preview)
        setPreviewPosition({ x: e.clientX, y: e.clientY })
      }
    }
  }, [columns, items, onCascadePreview, getId, getStatus])

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null)
    setCascadePreview(null)
    setPreviewPosition(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault()
    const id = Number(e.dataTransfer.getData('text/plain'))
    const targetColumn = columns.find((c) => c.key === columnKey)
    if (!targetColumn || !id) {
      setDragOverColumn(null)
      setCascadePreview(null)
      setPreviewPosition(null)
      setDraggedId(null)
      return
    }
    const newStatus = targetColumn.statuses[0]
    const item = items.find((i) => getId(i) === id)
    if (item && getStatus(item) !== newStatus) {
      onMove(id, newStatus)
    }
    setDragOverColumn(null)
    setCascadePreview(null)
    setPreviewPosition(null)
    setDraggedId(null)
  }, [columns, items, onMove, getId, getStatus])

  return (
    <>
      <div
        className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0"
        role="list"
        aria-label="Pipeline board"
      >
        {columns.map((col) => {
          const columnItems = items.filter((i) => col.statuses.includes(getStatus(i)))
          const isDragOver = dragOverColumn === col.key

          return (
            <div
              key={col.key}
              className={`w-64 shrink-0 ${isDragOver ? 'ring-2 ring-blue-500/50 rounded-xl bg-blue-50/50' : ''}`}
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.key)}
              role="listitem"
              aria-label={`${col.label} column, ${columnItems.length} items`}
            >
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{col.label}</span>
                <span className="text-xs text-gray-400 tabular-nums">{columnItems.length}</span>
              </div>
              <div
                className="space-y-2 min-h-8"
                style={{ minHeight: emptyColumnHeight }}
                role="list"
              >
                {columnItems.map((item) => (
                  <div
                    key={getId(item)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, getId(item))}
                    onDragEnd={handleDragEnd}
                    className={draggedId === getId(item) ? 'opacity-50' : 'opacity-100'}
                    role="listitem"
                  >
                    {renderCard(item, (newStatus) => onMove(getId(item), newStatus))}
                  </div>
                ))}
                {columnItems.length === 0 && (
                  <div
                    className={`rounded-xl border-2 border-dashed border-gray-200 transition-colors ${
                      isDragOver ? 'border-blue-400 bg-blue-50' : ''
                    }`}
                    style={{ height: emptyColumnHeight }}
                    aria-label={`${col.label} is empty, drop items here`}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {cascadePreview && previewPosition && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: previewPosition.x + 16,
            top: previewPosition.y - 8,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="bg-white rounded-lg border border-gray-200 shadow-lg p-3 min-w-[280px] animate-fade-in">
            {cascadePreview}
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Enhanced DataTable with sort, group, bulk-select, CSV export (doc 23 DataTable).
 */
export interface TableColumnDef<T> {
  key: string
  label: string
  render: (item: T) => React.ReactNode
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  groupable?: boolean
}

export interface DataTableProps<T extends { id: number }> {
  columns: TableColumnDef<T>[]
  items: T[]
  getId: (item: T) => number
  defaultSort?: { key: string; direction: 'asc' | 'desc' }
  onRowClick?: (item: T) => void
  selection?: {
    selectedIds: number[]
    onSelect: (id: number, checked: boolean) => void
    onSelectAll: (checked: boolean) => void
  }
  onExportCSV?: (items: T[]) => void
  exportFilename?: string
  emptyMessage?: string
  rowClassName?: (item: T) => string
}

export function DataTable<T extends { id: number }>({
  columns,
  items,
  getId,
  defaultSort,
  onRowClick,
  selection,
  onExportCSV,
  exportFilename = 'export',
  emptyMessage = 'No records found.',
  rowClassName,
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(defaultSort ?? null)
  const [groupBy, setGroupBy] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const sortedItems = useMemo(() => {
    if (!sortConfig) return items
    return [...items].sort((a, b) => {
      const aVal = (a as any)[sortConfig.key]
      const bVal = (b as any)[sortConfig.key]
      if (aVal === bVal) return 0
      const dir = sortConfig.direction === 'asc' ? 1 : -1
      return aVal < bVal ? -dir : dir
    })
  }, [items, sortConfig])

  const groupedItems = useMemo(() => {
    if (!groupBy) return null
    const groups = new Map<string, T[]>()
    sortedItems.forEach((item) => {
      const key = String((item as any)[groupBy] ?? '—')
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    })
    return Array.from(groups.entries()).map(([key, items]) => ({ key, items }))
  }, [sortedItems, groupBy])

  const handleSort = (key: string) => {
    const col = columns.find((c) => c.key === key)
    if (!col?.sortable) return
    setSortConfig((prev) => ({
      key,
      direction: prev?.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleToggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }

  const allSelected = selection && items.length > 0 && selection.selectedIds.length === items.length
  const someSelected = Boolean(selection && selection.selectedIds.length > 0 && selection.selectedIds.length < items.length)

  if (items.length === 0) {
    return <div className="px-4 py-8 text-center text-gray-400">{emptyMessage}</div>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2 flex-1">
          <label className="text-xs text-gray-500">Group by</label>
          <select
            value={groupBy ?? ''}
            onChange={(e) => setGroupBy(e.target.value || null)}
            className="rounded-lg border border-gray-300 px-2 py-1 text-sm bg-white"
          >
            <option value="">None</option>
            {columns.filter((c) => c.groupable).map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
        {onExportCSV && (
          <button
            onClick={() => onExportCSV(items)}
            className="rounded-lg bg-gray-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-gray-800"
          >
            Export CSV
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
              {selection && (
                <th className="px-4 py-2.5 font-medium w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected }}
                    onChange={(e) => selection.onSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 font-medium ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} cursor-pointer select-none`}
                  onClick={() => handleSort(col.key)}
                  style={col.sortable ? { userSelect: 'none' } : undefined}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortConfig?.key === col.key && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {groupBy && groupedItems ? (
              groupedItems.map(({ key, items: groupItems }) => {
                const isExpanded = expandedGroups.has(key)
                return (
                  <>
                    <tr className="bg-gray-50">
                      {selection && <th className="px-4 py-2" />}
                      <th
                        colSpan={columns.length + (selection ? 1 : 0)}
                        className="px-4 py-2 font-medium text-gray-700 flex items-center gap-2"
                        onClick={() => handleToggleGroup(key)}
                      >
                        <span>{isExpanded ? '▼' : '▶'}</span>
                        <span>{key}</span>
                        <span className="text-xs text-gray-400 ml-2">({groupItems.length})</span>
                      </th>
                    </tr>
                    {isExpanded && groupItems.map((item) => (
                      <tr
                        key={getId(item)}
                        className={`hover:bg-gray-50/70 ${rowClassName?.(item) ?? ''} ${selection?.selectedIds.includes(getId(item)) ? 'bg-blue-50' : ''}`}
                        onClick={() => onRowClick?.(item)}
                      >
                        {selection && (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selection.selectedIds.includes(getId(item))}
                              onChange={(e) => selection.onSelect(getId(item), e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                        )}
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                          >
                            {col.render(item)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                )
              })
            ) : (
              sortedItems.map((item) => (
                <tr
                  key={getId(item)}
                  className={`hover:bg-gray-50/70 ${rowClassName?.(item) ?? ''} ${selection?.selectedIds.includes(getId(item)) ? 'bg-blue-50' : ''}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {selection && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selection.selectedIds.includes(getId(item))}
                        onChange={(e) => selection.onSelect(getId(item), e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                    >
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * CSV export helper
 */
export function exportToCSV<T>(items: T[], columns: TableColumnDef<T>[], filename: string) {
  const headers = columns.map((c) => c.label).join(',')
  const rows = items.map((item) =>
    columns.map((c) => {
      const val = c.render(item)
      const str = typeof val === 'string' ? val : String(val ?? '')
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(',')
  )
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}