// ── Offline Draft Autosave (doc 23, 27) ────────────────────────────────────
// Saves form data to localStorage so it survives dead wifi and app restarts.
// On reconnect, the draft is restored automatically.

import { useState, useEffect, useCallback, useRef } from 'react'

const DRAFT_PREFIX = 'agencyos.draft.'

export function useDraftAutosave<T extends Record<string, any>>(
  key: string,
  initial: T,
  options?: { debounceMs?: number; onRestore?: (draft: T) => void }
) {
  const debounceMs = options?.debounceMs ?? 500
  const [draft, setDraft] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_PREFIX + key)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (options?.onRestore) options.onRestore(parsed)
        return { ...initial, ...parsed }
      }
    } catch { /* ignore */ }
    return initial
  })

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveDraft = useCallback((data: T) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(data))
      } catch { /* ignore */ }
    }, debounceMs)
  }, [key, debounceMs])

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_PREFIX + key)
    } catch { /* ignore */ }
  }, [key])

  const updateDraft = useCallback((data: Partial<T>) => {
    setDraft((prev) => {
      const next = { ...prev, ...data }
      saveDraft(next)
      return next
    })
  }, [saveDraft])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return { draft, updateDraft, clearDraft, setDraft }
}

// ── Online status hook ─────────────────────────────────────────────────────
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// ── Offline indicator component ────────────────────────────────────────────
export function OfflineIndicator() {
  const isOnline = useOnlineStatus()
  if (isOnline) return null
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center text-sm py-1.5 font-medium">
      You are offline - changes will sync when you reconnect
    </div>
  )
}