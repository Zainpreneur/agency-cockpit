// Currency-aware money helpers. Plan stores minor units; v0 mock keeps whole riyals.

const MS = 86_400_000

export function d(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * MS).toISOString()
}

export function money(n: number): string {
  return 'SAR ' + Math.round(n).toLocaleString('en-US')
}

export function dateShort(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function daysBetween(fromIso: string, toIso = new Date().toISOString()): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / MS)
}

/** Aging label for due dates: "16d overdue", "due in 3d", "due today" */
export function dueLabel(dueAt: string, paidAt?: string): string {
  if (paidAt) return 'paid ' + dateShort(paidAt)
  const diff = daysBetween(dueAt) // positive = past due
  if (diff > 0) return `${diff}d overdue`
  if (diff === 0) return 'due today'
  return `due in ${-diff}d`
}

export function dueTone(dueAt: string, paidAt?: string): 'green' | 'amber' | 'red' | 'gray' {
  if (paidAt) return 'green'
  const diff = daysBetween(dueAt)
  if (diff > 0) return 'red'
  if (diff > -7) return 'amber' // due within the next 7 days
  return 'gray'
}
