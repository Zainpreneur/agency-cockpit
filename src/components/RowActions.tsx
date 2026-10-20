import type { ReactNode } from 'react'

/** Consistent small edit/remove buttons for tables and rows. */
export function RowActions({
  onEdit,
  onDelete,
  extra,
}: {
  onEdit?: () => void
  onDelete?: () => void
  extra?: ReactNode
}) {
  return (
    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
      {extra}
      {onEdit && (
        <button onClick={onEdit} title="Edit" className="rounded-lg w-7 h-7 text-xs ring-1 ring-gray-300 text-gray-500 hover:bg-gray-50">
          ✎
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} title="Remove" className="rounded-lg w-7 h-7 text-xs ring-1 ring-gray-300 text-gray-500 hover:bg-red-50 hover:text-red-600">
          ✕
        </button>
      )}
    </div>
  )
}
