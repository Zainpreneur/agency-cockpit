// Status → label + tone map. The single source of truth behind every chip
// (doc 23: colors are semantic — green done, amber attention, red money risk,
// blue in-flight, gray static).

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray'

const TONE: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  gray: 'bg-gray-100 text-gray-600 ring-gray-200',
}

export function toneCls(tone: Tone): string {
  return TONE[tone]
}

type Meta = { label: string; tone: Tone }

export const STATUS_META: Record<string, Meta> = {
  // leads
  discovered: { label: 'Discovered', tone: 'gray' },
  contacted: { label: 'Contacted', tone: 'blue' },
  demo_built: { label: 'Demo built', tone: 'blue' },
  demo_shared: { label: 'Demo shared', tone: 'blue' },
  proposal_sent: { label: 'Proposal sent', tone: 'amber' },
  negotiating: { label: 'Negotiating', tone: 'amber' },
  won: { label: 'Won', tone: 'green' },
  lost: { label: 'Lost', tone: 'red' },
  archived: { label: 'Archived', tone: 'gray' },
  // proposals
  draft: { label: 'Draft', tone: 'gray' },
  sent: { label: 'Sent', tone: 'blue' },
  viewed: { label: 'Viewed', tone: 'blue' },
  accepted: { label: 'Accepted', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  expired: { label: 'Expired', tone: 'gray' },
  // invoices
  invoice_draft: { label: 'Draft', tone: 'gray' },
  invoice_sent: { label: 'Sent', tone: 'amber' },
  invoice_viewed: { label: 'Viewed', tone: 'amber' },
  paid: { label: 'Paid', tone: 'green' },
  invoice_overdue: { label: 'Overdue', tone: 'red' },
  invoice_void: { label: 'Void', tone: 'gray' },
  // payouts
  accrued: { label: 'Accrued', tone: 'gray' },
  blocked: { label: 'Blocked', tone: 'gray' },
  payable: { label: 'Payable', tone: 'amber' },
  payout_paid: { label: 'Paid', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
  // purchase orders
  ordered: { label: 'Ordered', tone: 'blue' },
  received: { label: 'Received', tone: 'blue' },
  installed: { label: 'Installed', tone: 'green' },
  invoiced: { label: 'Invoiced', tone: 'green' },
  // deployments
  never_deployed: { label: 'Never deployed', tone: 'gray' },
  healthy: { label: 'Healthy', tone: 'green' },
  degraded: { label: 'Degraded', tone: 'red' },
  pending_agent: { label: 'Waiting for agent', tone: 'amber' },
  // outbox
  scheduled: { label: 'Scheduled', tone: 'gray' },
  ready: { label: 'Ready to send', tone: 'amber' },
  outbox_sent: { label: 'Sent', tone: 'green' },
  skipped: { label: 'Skipped', tone: 'gray' },
  // funding rounds
  seeking: { label: 'Seeking', tone: 'amber' },
  committed: { label: 'Committed', tone: 'blue' },
  funded: { label: 'Funded', tone: 'green' },
  returned: { label: 'Returned', tone: 'green' },
  closed: { label: 'Closed', tone: 'gray' },
}

/** Map a raw status value into its namespaced meta key (invoice/payout/outbox
 * statuses collide across domains, so callers pass the right key here). */
export function statusMeta(domain: 'invoice' | 'payout' | 'outbox', status: string): Meta {
  const key =
    domain === 'invoice' ? `invoice_${status}` :
    domain === 'payout' ? (status === 'paid' ? 'payout_paid' : status) :
    domain === 'outbox' ? (status === 'sent' ? 'outbox_sent' : status) :
    status
  return STATUS_META[key] ?? { label: status, tone: 'gray' as Tone }
}

export function metaFor(status: string): Meta {
  return STATUS_META[status] ?? { label: status, tone: 'gray' as Tone }
}
