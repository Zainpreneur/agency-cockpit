import { useState, useRef, useCallback } from 'react'
import { Chip } from './StatusChip'
import { money, dateShort } from '../lib/format'
import type { PurchaseOrder } from '../lib/types'

/**
 * ReceiptUploader — camera → receipt photo → attach to PO (doc 19 S8, doc 23 component inventory).
 * Works on mobile (camera) and desktop (file picker).
 */
export function ReceiptUploader({
  po,
  onUpload,
  maxSizeMB = 5,
}: {
  po: PurchaseOrder
  onUpload: (poId: number, file: File, preview: string) => void
  maxSizeMB?: number
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File too large (max ${maxSizeMB}MB)`)
      return
    }
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Please select an image or PDF')
      return
    }

    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }, [maxSizeMB])

  const handleCameraCapture = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }, [])

  const handleRemove = useCallback(() => {
    setPreview(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleConfirm = useCallback(async () => {
    if (!preview || !fileInputRef.current?.files?.[0]) return
    setUploading(true)
    try {
      await onUpload(po.id, fileInputRef.current.files[0], preview)
      setPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }, [preview, onUpload, po.id])

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        id={`receipt-upload-${po.id}`}
      />

      {preview ? (
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="relative aspect-video bg-gray-100">
            {preview.startsWith('data:image') ? (
              <img src={preview} alt="Receipt preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17a.003.003 0 01-.003.003h-.003" />
                </svg>
              </div>
            )}
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                onClick={handleRemove}
                className="rounded-full bg-black/50 text-white p-1.5 hover:bg-black/70"
                aria-label="Remove"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="px-3 py-2 flex items-center justify-between border-t border-gray-100">
            <span className="text-xs text-gray-500 truncate max-w-[200px]">
              {fileInputRef.current?.files?.[0]?.name ?? 'receipt'}
            </span>
            <button
              onClick={handleConfirm}
              disabled={uploading}
              className="rounded-lg bg-blue-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Attaching…' : 'Attach receipt'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleCameraCapture}
          className="w-full aspect-video rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition"
          aria-label="Attach receipt photo"
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-medium">Tap to attach receipt</span>
          <span className="text-xs text-gray-400">Camera or file • max {maxSizeMB}MB</span>
        </button>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}
    </div>
  )
}

/**
 * PO Receipts Gallery — doc 25: "Gallery (receipts)" for Purchase Orders.
 */
export function POReceiptsGallery({
  pos,
  onAttachReceipt,
}: {
  pos: PurchaseOrder[]
  onAttachReceipt: (poId: number, file: File, preview: string) => void
}) {
  const posWithReceipts = pos.filter((po) => po.items.some((i) => i.description.includes('receipt:')))

  if (posWithReceipts.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-gray-400">
        No receipts uploaded yet. Attach from the PO detail.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {posWithReceipts.map((po) => (
        <div key={po.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="aspect-video bg-gray-100 relative">
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17a.003.003 0 01-.003.003h-.003" />
              </svg>
            </div>
            <div className="absolute top-2 left-2 flex gap-1">
              <Chip tone="gray" className="text-[10px] px-1.5 py-0.5">{po.no}</Chip>
            </div>
          </div>
          <div className="p-3">
            <div className="text-sm font-medium text-gray-900 truncate">{po.vendor}</div>
            <div className="text-xs text-gray-500">{po.project}</div>
            <div className="text-xs text-gray-500">{money(po.total)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}