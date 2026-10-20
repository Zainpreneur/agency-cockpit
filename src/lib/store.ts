// ── The mock backend. One observable store + named actions.
// When the real API arrives, only this file changes: the action signatures
// become POST/PUT calls and reads become TanStack Query fetches. Components
// never touch the internals.
//
// Actions implement the plan's rules:
//   • paid invoices flip blocked payouts → payable (the cascade)
//   • outbound sends cancel pending outbound (reply-cancels-pending)
//   • releases/paid flips write status_events (append-only)
//   • proposals snapshot price + write an outbox row, atomically

import { useSyncExternalStore } from 'react'
import type {
  AppState, CommsEntry, Invoice, OutboxItem, Payout, Proposal, ProposalStatus, StatusEvent,
} from './types'
import { mockData } from './mockData'
import { d, money } from './format'

let state: AppState = structuredClone(mockData)
const listeners = new Set<() => void>()

export function getState(): AppState {
  return state
}

function setState(mutator: (s: AppState) => AppState | void) {
  const result = mutator(state)
  if (result) state = result
  listeners.forEach((l) => l())
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

function withEvent(s: AppState, ev: Omit<StatusEvent, 'id' | 'at'>): StatusEvent[] {
  return [...s.statusEvents, { ...ev, id: s.seq++, at: new Date().toISOString() }]
}

function log(s: AppState, entry: Omit<CommsEntry, 'id' | 'at'>): CommsEntry[] {
  return [...s.commsLog, { ...entry, id: s.seq++, at: new Date().toISOString() }]
}

// ── Selectors (pure, reusable in previews) ─────────────────────────────

/** Payouts that would flip blocked→payable if this invoice were paid. */
export function cascadePreview(invoiceId: number): Payout[] {
  return state.payouts.filter((p) => p.status === 'blocked' && p.triggerInvoiceId === invoiceId)
}

export function pendingOutboxFor(contactableName: string): OutboxItem[] {
  return state.outbox.filter(
    (o) =>
      o.contactableName === contactableName &&
      (o.status === 'ready' || o.status === 'scheduled'),
  )
}

/** Leads whose latest message is inbound — "needs your reply". */
export function needsReplyLeads() {
  return state.leads.filter(
    (l) =>
      l.status !== 'archived' &&
      l.lastInboundAt &&
      (!l.lastOutboundAt || new Date(l.lastInboundAt) > new Date(l.lastOutboundAt)),
  )
}

// ── Actions ────────────────────────────────────────────────────────────

export function markInvoicePaid(
  invoiceId: number,
  opts: { provider: 'tap' | 'moyasar' | 'bank'; reference?: string },
) {
  setState((s) => {
    const inv = s.invoices.find((i) => i.id === invoiceId)
    if (!inv || inv.status === 'paid') return
    const now = new Date().toISOString()

    const flips = s.payouts.filter(
      (p) => p.status === 'blocked' && p.triggerInvoiceId === invoiceId,
    )
    const payouts = s.payouts.map((p) =>
      flips.some((f) => f.id === p.id) ? { ...p, status: 'payable' as const } : p,
    )

    const invoices = s.invoices.map((i) =>
      i.id === invoiceId
        ? { ...i, status: 'paid' as const, paidAt: now, paidVia: opts.provider }
        : i,
    )

    let next: AppState = {
      ...s,
      invoices,
      payments: [
        ...s.payments,
        { id: s.seq++, invoiceId, provider: opts.provider, amount: inv.total, paidAt: now, reference: opts.reference },
      ],
      payouts,
      statusEvents: withEvent({ ...s, seq: s.seq + 1 + flips.length }, { entity: 'invoice', entityId: invoiceId, from: inv.status, to: 'paid', note: `via ${opts.provider}` }),
      commsLog: log({ ...s, seq: s.seq + 2 + flips.length }, {
        contactableName: inv.clientName, channel: 'email', direction: 'out',
        snippet: `payment_received_thanks — ${inv.no}, SAR ${inv.total.toLocaleString()}`,
        templateCode: 'payment_received_thanks',
      }),
    }

    // one status event per payout flip, too
    for (const f of flips) {
      next = { ...next, statusEvents: withEvent({ ...next, seq: next.seq + 1 }, { entity: 'payout', entityId: f.id, from: 'blocked', to: 'payable', note: `${inv.no} paid` }) }
    }
    return { ...next, seq: next.seq + 1 + flips.length }
  })
}

export function releasePayout(payoutId: number) {
  setState((s) => {
    const p = s.payouts.find((x) => x.id === payoutId)
    if (!p || p.status !== 'payable') return
    const now = new Date().toISOString()
    let next: AppState = {
      ...s,
      payouts: s.payouts.map((x) => (x.id === payoutId ? { ...x, status: 'paid' as const, paidAt: now } : x)),
      commsLog: log({ ...s, seq: s.seq + 1 }, {
        contactableName: p.payee, channel: 'email', direction: 'out',
        snippet: `payout_released — SAR ${p.amount.toLocaleString()} (${p.kind})`,
        templateCode: 'payout_released',
      }),
    }
    next = { ...next, statusEvents: withEvent({ ...next, seq: next.seq + 1 }, { entity: 'payout', entityId: payoutId, from: p.status, to: 'paid' }) }
    return { ...next, seq: next.seq + 1 }
  })
}

export function sendInvoice(invoiceId: number) {
  setState((s) => {
    const inv = s.invoices.find((i) => i.id === invoiceId)
    if (!inv || inv.status !== 'draft') return
    const now = new Date().toISOString()
    let next: AppState = {
      ...s,
      invoices: s.invoices.map((i) => (i.id === invoiceId ? { ...i, status: 'sent' as const } : i)),
      commsLog: log({ ...s, seq: s.seq + 1 }, {
        contactableName: inv.clientName, channel: 'email', direction: 'out',
        snippet: `invoice_send — ${inv.no}, SAR ${inv.total.toLocaleString()}`,
        templateCode: 'invoice_send',
      }),
    }
    next = { ...next, statusEvents: withEvent({ ...next, seq: next.seq + 1 }, { entity: 'invoice', entityId: invoiceId, from: 'draft', to: 'sent' }) }
    return { ...next, seq: next.seq + 1 }
  })
}

/** Send (or copy-sent) an outbox row. Chains the follow-up template. */
export function sendOutboxItem(itemId: number) {
  setState((s) => {
    const item = s.outbox.find((o) => o.id === itemId)
    if (!item || item.status === 'sent' || item.status === 'skipped') return
    const template = s.commsTemplates.find((t) => t.code === item.templateCode)
    const now = new Date().toISOString()

    let outbox = s.outbox.map((o) => (o.id === itemId ? { ...o, status: 'sent' as const } : o))
    // chain the next follow-up, if the template defines one
    if (template?.followupTemplateCode && template.followupAfterDays) {
      outbox = [
        ...outbox,
        {
          id: s.seq + 1,
          contactableName: item.contactableName,
          stakeholder: item.stakeholder,
          templateCode: template.followupTemplateCode,
          subject: item.subject.replace(/^Following up/, 'Still here'),
          body: `Hi,\n\nJust checking in again on my last message.\n\nZain`,
          dueAt: d(template.followupAfterDays),
          status: 'scheduled',
        },
      ]
    }

    const isLead = item.stakeholder === 'lead' || item.stakeholder === 'client'
    let next: AppState = {
      ...s,
      outbox,
      commsLog: log({ ...s, seq: s.seq + 2 + (template?.followupAfterDays ? 1 : 0) }, {
        contactableName: item.contactableName, channel: 'email', direction: 'out',
        snippet: `${item.templateCode} — ${item.subject}`, templateCode: item.templateCode,
      }),
      leads: isLead
        ? s.leads.map((l) =>
            l.businessName === item.contactableName ? { ...l, lastOutboundAt: now } : l,
          )
        : s.leads,
    }
    next = {
      ...next,
      seq: next.seq + 1,
      statusEvents: withEvent({ ...next, seq: next.seq + 1 }, { entity: 'outbox', entityId: itemId, from: item.status, to: 'sent' }),
    }
    return { ...next, seq: next.seq + 1 }
  })
}

export function skipOutboxItem(itemId: number) {
  setState((s) => {
    const item = s.outbox.find((o) => o.id === itemId)
    if (!item || item.status === 'sent' || item.status === 'skipped') return
    return {
      ...s,
      outbox: s.outbox.map((o) => (o.id === itemId ? { ...o, status: 'skipped' as const } : o)),
      statusEvents: withEvent({ ...s, seq: s.seq + 1 }, { entity: 'outbox', entityId: itemId, from: item.status, to: 'skipped' }),
      seq: s.seq + 1,
    }
  })
}

/** Paste an inbound reply: logs it, flips the lead, cancels pending outbound. */
export function pasteInboundReply(contactableName: string, text: string, flipTo?: string) {
  setState((s) => {
    const now = new Date().toISOString()
    const cancelled = s.outbox.filter(
      (o) =>
        o.contactableName === contactableName &&
        (o.status === 'ready' || o.status === 'scheduled'),
    )

    let next: AppState = {
      ...s,
      commsLog: log({ ...s, seq: s.seq + 1 + cancelled.length }, {
        contactableName, channel: 'email', direction: 'in', snippet: text.slice(0, 180),
      }),
      outbox: s.outbox.map((o) =>
        o.contactableName === contactableName && (o.status === 'ready' || o.status === 'scheduled')
          ? { ...o, status: 'skipped' as const, cancelledBy: 'inbound_reply' as const }
          : o,
      ),
      leads: s.leads.map((l) =>
        l.businessName === contactableName
          ? { ...l, lastInboundAt: now, status: (flipTo ?? l.status) as AppState['leads'][number]['status'] }
          : l,
      ),
    }
    for (const c of cancelled) {
      next = { ...next, statusEvents: withEvent({ ...next, seq: next.seq + 1 }, { entity: 'outbox', entityId: c.id, from: c.status, to: 'skipped', note: 'cancelled by inbound reply' }) }
    }
    return { ...next, seq: next.seq + 1 + cancelled.length }
  })
}

/** Board/card move → status flip with an append-only event (same path as drag). */
export function moveLeadStatus(leadId: number, to: string) {
  setState((s) => {
    const lead = s.leads.find((l) => l.id === leadId)
    if (!lead || lead.status === to) return
    let next: AppState = {
      ...s,
      leads: s.leads.map((l) => (l.id === leadId ? { ...l, status: to as AppState['leads'][number]['status'] } : l)),
    }
    next = { ...next, statusEvents: withEvent({ ...next, seq: next.seq + 1 }, { entity: 'lead', entityId: leadId, from: lead.status, to }) }
    return { ...next, seq: next.seq + 1 }
  })
}

export type ProposalDraft = {
  leadId: number
  listPrice: number
  offeredPrice: number
  cost: number
  discountReason?: string
  maintenanceMonthly?: number
  lines: { description: string; qty: number; unitPrice: number }[]
}

/** Snapshot & send — proposal + lines + outbox + event in one transaction. */
export function createProposal(draft: ProposalDraft): number {
  let createdId = 0
  setState((s) => {
    const lead = s.leads.find((l) => l.id === draft.leadId)
    if (!lead) return
    const id = s.seq + 1
    createdId = id
    const num = 14 + s.proposals.length + (s.seq % 100)
    const proposal: Proposal = {
      id,
      no: `PROP-2026-${String(num).padStart(3, '0')}`,
      leadId: lead.id,
      leadName: lead.businessName,
      listPrice: draft.listPrice,
      offeredPrice: draft.offeredPrice,
      cost: draft.cost,
      discountReason: draft.discountReason,
      status: 'sent',
      validUntil: d(14),
      createdAt: new Date().toISOString(),
      lines: draft.lines,
      maintenanceMonthly: draft.maintenanceMonthly,
    }
    const outboxItem: OutboxItem = {
      id: id + 1,
      contactableName: lead.businessName,
      stakeholder: 'lead',
      templateCode: 'proposal_send',
      subject: `Your proposal from Zainpreneur — ${proposal.no}`,
      body: `Hi ${lead.contactName},\n\nYour proposal is ready: ${proposal.no} — SAR ${draft.offeredPrice.toLocaleString()}. Valid until ${new Date(proposal.validUntil).toLocaleDateString('en-GB')}.\n\nHappy to walk you through it.\nZain`,
      dueAt: new Date().toISOString(),
      status: 'ready',
    }
    let next: AppState = {
      ...s,
      seq: s.seq + 3,
      proposals: [...s.proposals, proposal],
      outbox: [...s.outbox, outboxItem],
      leads: s.leads.map((l) => (l.id === lead.id ? { ...l, status: 'proposal_sent', lastOutboundAt: outboxItem.dueAt, nextFollowUpAt: d(3) } : l)),
      commsLog: log({ ...s, seq: s.seq + 4 }, {
        contactableName: lead.businessName, channel: 'email', direction: 'out',
        snippet: `proposal_send — ${proposal.no}, SAR ${draft.offeredPrice.toLocaleString()}`,
        templateCode: 'proposal_send',
      }),
    }
    next = { ...next, statusEvents: withEvent({ ...next, seq: next.seq + 1 }, { entity: 'proposal', entityId: proposal.id, from: 'draft', to: 'sent', note: proposal.no }) }
    return { ...next, seq: next.seq + 1 }
  })
  return createdId
}

/** Won lead → client record (W1 ending) + queues the intake questionnaire (C2). Idempotent. */
export function convertLeadToClient(leadId: number): number | null {
  let result: number | null = null
  setState((s) => {
    const lead = s.leads.find((l) => l.id === leadId)
    if (!lead) return
    const existing = s.clients.find((c) => c.name === lead.businessName)
    if (existing) {
      result = existing.id
      return
    }
    if (lead.status !== 'won') return // guard: only closed-won leads convert
    const id = s.seq + 1
    const now = new Date().toISOString()
    let next: AppState = {
      ...s,
      seq: s.seq + 4,
      clients: [
        ...s.clients,
        {
          id,
          name: lead.businessName,
          contactName: lead.contactName,
          email: lead.email,
          phone: lead.phone,
          city: lead.city,
          industry: lead.industry,
          status: 'active' as const,
          since: now,
          notes: lead.notes,
        },
      ],
      outbox: [
        ...s.outbox,
        {
          id: id + 1,
          contactableName: lead.businessName,
          stakeholder: 'client' as const,
          templateCode: 'intake_request',
          subject: 'Two quick questions before we start',
          body: `Hi ${lead.contactName},\n\nBefore we start, reply to this email with:\n\n1. What do you sell?\n2. Who are your customers?\n3. What should customers be able to do online? (book / order / pay / see prices / contact / track)\n4. Which of those matters most?\n5. Anything else?\n\nZain`,
          dueAt: now,
          status: 'ready' as const,
        },
      ],
    }
    next = {
      ...next,
      statusEvents: withEvent({ ...next, seq: next.seq + 1 }, {
        entity: 'client', entityId: id, from: 'lead', to: 'active',
        note: `converted from lead #${leadId}`,
      }),
    }
    result = id
    return { ...next, seq: next.seq + 1 }
  })
  return result
}

/** Campaign play/pause with an event (boards and gestures flip, guards would outrank). */
export function toggleCampaign(campaignId: number) {
  setState((s) => {
    const c = s.campaigns.find((x) => x.id === campaignId)
    if (!c || c.status === 'ended') return
    const to = c.status === 'active' ? 'paused' : 'active'
    let next: AppState = {
      ...s,
      campaigns: s.campaigns.map((x) =>
        x.id === campaignId ? { ...x, status: to as AppState['campaigns'][number]['status'] } : x,
      ),
    }
    next = {
      ...next,
      statusEvents: withEvent({ ...next, seq: next.seq + 1 }, {
        entity: 'campaign', entityId: campaignId, from: c.status, to,
      }),
    }
    return { ...next, seq: next.seq + 1 }
  })
}

/** Board/card move → proposal status flip with an append-only event (same path as drag). */
export function moveProposalStatus(proposalId: number, to: string) {
  setState((s) => {
    const p = s.proposals.find((x) => x.id === proposalId)
    if (!p || p.status === to) return
    let next: AppState = {
      ...s,
      proposals: s.proposals.map((x) => (x.id === proposalId ? { ...x, status: to as ProposalStatus } : x)),
    }
    next = { ...next, statusEvents: withEvent({ ...next, seq: next.seq + 1 }, { entity: 'proposal', entityId: proposalId, from: p.status, to, note: p.no }) }
    return { ...next, seq: next.seq + 1 }
  })
}

// ── CRUD layer (doc 27) ────────────────────────────────────────────────
// Every entity is creatable/editable from the UI. "Deletes" respect the
// plan: money history is append-only (void/cancel, never erase), anything
// referenced by another row archives instead of vanishing, and every
// transition writes a status event. Actions return ActionResult so forms
// can surface guard reasons inline.

export type ActionResult = { ok: true; id?: number } | { ok: false; error: string }
export type Vals = Record<string, string | number | boolean>

const OK = (id?: number): ActionResult => ({ ok: true, id })
const FAIL = (error: string): ActionResult => ({ ok: false, error })
const S = (v: Vals, k: string): string => String(v[k] ?? '').trim()
const N = (v: Vals, k: string): number => { const n = Number(v[k]); return Number.isFinite(n) ? n : 0 }
const ISO = (v: Vals, k: string): string | undefined => {
  const x = S(v, k)
  return x ? new Date(x + 'T09:00:00').toISOString() : undefined
}

/** Unambiguous event helper: event id = current seq, seq +1. */
function ev(s: AppState, entity: string, entityId: number, from: string, to: string, note?: string): AppState {
  return {
    ...s,
    seq: s.seq + 1,
    statusEvents: [...s.statusEvents, { id: s.seq, entity, entityId, from, to, note, at: new Date().toISOString() }],
  }
}

// ── Leads ──────────────────────────────────────────────────────────────

export function createLead(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const businessName = S(v, 'businessName')
    if (!businessName) return void (res = FAIL('Business name is required.'))
    if (s.leads.some((l) => l.businessName.toLowerCase() === businessName.toLowerCase()))
      return void (res = FAIL(`A lead named ${businessName} already exists.`))
    const id = s.seq + 1
    const lead = {
      id, businessName, contactName: S(v, 'contactName'), phone: S(v, 'phone'), email: S(v, 'email'),
      source: S(v, 'source') || 'manual', industry: S(v, 'industry'), city: S(v, 'city'),
      status: 'discovered' as const, notes: S(v, 'notes') || undefined,
      nextFollowUpAt: ISO(v, 'nextFollowUpAt') ?? d(3),
    }
    let next: AppState = { ...s, seq: s.seq + 1, leads: [...s.leads, lead] }
    next = ev(next, 'lead', id, 'new', 'discovered', 'created via form')
    res = OK(id)
    return next
  })
  return res
}

export function updateLead(id: number, v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const lead = s.leads.find((l) => l.id === id)
    if (!lead) return void (res = FAIL('Lead not found.'))
    const name = S(v, 'businessName')
    if (name && s.leads.some((l) => l.id !== id && l.businessName.toLowerCase() === name.toLowerCase()))
      return void (res = FAIL(`A lead named ${name} already exists.`))
    let next: AppState = {
      ...s,
      leads: s.leads.map((l) => (l.id === id ? {
        ...l, businessName: name || l.businessName, contactName: S(v, 'contactName') || l.contactName,
        phone: S(v, 'phone') || l.phone, email: S(v, 'email') || l.email, source: S(v, 'source') || l.source,
        industry: S(v, 'industry') || l.industry, city: S(v, 'city') || l.city,
        notes: S(v, 'notes') || undefined, nextFollowUpAt: ISO(v, 'nextFollowUpAt') ?? l.nextFollowUpAt,
      } : l)),
    }
    next = ev(next, 'lead', id, lead.status, lead.status, 'record edited')
    res = OK(id)
    return next
  })
  return res
}

export function archiveLead(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const lead = s.leads.find((l) => l.id === id)
    if (!lead) return void (res = FAIL('Lead not found.'))
    if (lead.status === 'archived') return void (res = FAIL('Already archived.'))
    let next: AppState = {
      ...s,
      leads: s.leads.map((l) => (l.id === id ? { ...l, status: 'archived' as const } : l)),
      outbox: s.outbox.map((o) =>
        o.contactableName === lead.businessName && (o.status === 'ready' || o.status === 'scheduled')
          ? { ...o, status: 'skipped' as const, cancelledBy: 'inbound_reply' as const } : o,
      ),
    }
    next = ev(next, 'lead', id, lead.status, 'archived', 'archived — pending sends cancelled')
    res = OK(id)
    return next
  })
  return res
}

// ── Clients ────────────────────────────────────────────────────────────

export function createClient(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const name = S(v, 'name')
    if (!name) return void (res = FAIL('Client name is required.'))
    if (s.clients.some((c) => c.name.toLowerCase() === name.toLowerCase()))
      return void (res = FAIL(`A client named ${name} already exists.`))
    const id = s.seq + 1
    let next: AppState = {
      ...s, seq: s.seq + 1,
      clients: [...s.clients, {
        id, name, contactName: S(v, 'contactName'), email: S(v, 'email'), phone: S(v, 'phone'),
        city: S(v, 'city'), industry: S(v, 'industry'), status: 'active' as const,
        since: new Date().toISOString(), notes: S(v, 'notes') || undefined,
      }],
    }
    next = ev(next, 'client', id, 'new', 'active', 'created via form')
    res = OK(id)
    return next
  })
  return res
}

export function updateClient(id: number, v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const c = s.clients.find((x) => x.id === id)
    if (!c) return void (res = FAIL('Client not found.'))
    const name = S(v, 'name')
    if (name && s.clients.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase()))
      return void (res = FAIL(`A client named ${name} already exists.`))
    let next: AppState = {
      ...s,
      clients: s.clients.map((x) => (x.id === id ? {
        ...x, name: name || x.name, contactName: S(v, 'contactName') || x.contactName,
        email: S(v, 'email') || x.email, phone: S(v, 'phone') || x.phone, city: S(v, 'city') || x.city,
        industry: S(v, 'industry') || x.industry, notes: S(v, 'notes') || undefined,
      } : x)),
    }
    next = ev(next, 'client', id, c.status, c.status, 'record edited')
    res = OK(id)
    return next
  })
  return res
}

export function archiveClient(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const c = s.clients.find((x) => x.id === id)
    if (!c) return void (res = FAIL('Client not found.'))
    const open = s.invoices.filter((i) => i.clientName === c.name && i.status !== 'paid' && i.status !== 'void')
    if (open.length)
      return void (res = FAIL(`${open.map((i) => i.no).join(', ')} still open — settle the money before archiving ${c.name}.`))
    if (c.status === 'archived') return void (res = FAIL('Already archived.'))
    let next: AppState = { ...s, clients: s.clients.map((x) => (x.id === id ? { ...x, status: 'archived' as const } : x)) }
    next = ev(next, 'client', id, c.status, 'archived')
    res = OK(id)
    return next
  })
  return res
}

// ── Vendors ────────────────────────────────────────────────────────────

export function createVendor(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const name = S(v, 'name')
    if (!name) return void (res = FAIL('Vendor name is required.'))
    if (s.vendors.some((x) => x.name.toLowerCase() === name.toLowerCase()))
      return void (res = FAIL(`A vendor named ${name} already exists.`))
    const id = s.seq + 1
    let next: AppState = {
      ...s, seq: s.seq + 1,
      vendors: [...s.vendors, {
        id, name, category: S(v, 'category'), contactName: S(v, 'contactName'),
        phone: S(v, 'phone'), email: S(v, 'email'), terms: S(v, 'terms') || 'On delivery',
        status: 'active' as const,
      }],
    }
    next = ev(next, 'vendor', id, 'new', 'active', 'created via form')
    res = OK(id)
    return next
  })
  return res
}

export function updateVendor(id: number, v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const x0 = s.vendors.find((x) => x.id === id)
    if (!x0) return void (res = FAIL('Vendor not found.'))
    const name = S(v, 'name')
    if (name && s.vendors.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase()))
      return void (res = FAIL(`A vendor named ${name} already exists.`))
    let next: AppState = {
      ...s,
      vendors: s.vendors.map((x) => (x.id === id ? {
        ...x, name: name || x.name, category: S(v, 'category') || x.category,
        contactName: S(v, 'contactName') || x.contactName, phone: S(v, 'phone') || x.phone,
        email: S(v, 'email') || x.email, terms: S(v, 'terms') || x.terms,
      } : x)),
    }
    next = ev(next, 'vendor', id, x0.status, x0.status, 'record edited')
    res = OK(id)
    return next
  })
  return res
}

export function archiveVendor(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const x0 = s.vendors.find((x) => x.id === id)
    if (!x0) return void (res = FAIL('Vendor not found.'))
    let next: AppState = { ...s, vendors: s.vendors.map((x) => (x.id === id ? { ...x, status: 'archived' as const } : x)) }
    next = ev(next, 'vendor', id, x0.status, 'archived')
    res = OK(id)
    return next
  })
  return res
}

export function removeVendor(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const x0 = s.vendors.find((x) => x.id === id)
    if (!x0) return void (res = FAIL('Vendor not found.'))
    const pos = s.purchaseOrders.filter((p) => p.vendor === x0.name)
    if (pos.length)
      return void (res = FAIL(`${x0.name} has ${pos.length} purchase order(s) — archive instead; PO history must stay traceable.`))
    let next: AppState = { ...s, vendors: s.vendors.filter((x) => x.id !== id) }
    next = ev(next, 'vendor', id, x0.status, 'deleted', 'no POs referenced — hard delete allowed')
    res = OK(id)
    return next
  })
  return res
}

// ── Team ───────────────────────────────────────────────────────────────

export function addTeamMember(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const name = S(v, 'name')
    const email = S(v, 'email')
    if (!name) return void (res = FAIL('Name is required.'))
    if (s.team.some((m) => m.name.toLowerCase() === name.toLowerCase() || m.email.toLowerCase() === email.toLowerCase()))
      return void (res = FAIL(`${name} is already on the team list.`))
    const id = s.seq + 1
    let next: AppState = {
      ...s, seq: s.seq + 1,
      team: [...s.team, { id, name, email, pending: 0, paidYtd: 0, status: 'active' as const }],
    }
    next = ev(next, 'team', id, 'new', 'active', 'flat fee per deliverable')
    res = OK(id)
    return next
  })
  return res
}

export function updateTeamMember(id: number, v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const m = s.team.find((x) => x.id === id)
    if (!m) return void (res = FAIL('Team member not found.'))
    const name = S(v, 'name')
    const email = S(v, 'email')
    if ((name && s.team.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase())) ||
        (email && s.team.some((x) => x.id !== id && x.email.toLowerCase() === email.toLowerCase())))
      return void (res = FAIL('Another team member already uses that name or email.'))
    let next: AppState = {
      ...s,
      team: s.team.map((x) => (x.id === id ? { ...x, name: name || x.name, email: email || x.email } : x)),
    }
    next = ev(next, 'team', id, m.status, m.status, 'record edited (money fields derive from payouts)')
    res = OK(id)
    return next
  })
  return res
}

export function archiveTeamMember(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const m = s.team.find((x) => x.id === id)
    if (!m) return void (res = FAIL('Team member not found.'))
    let next: AppState = { ...s, team: s.team.map((x) => (x.id === id ? { ...x, status: 'archived' as const } : x)) }
    next = ev(next, 'team', id, m.status, 'archived', 'no longer gets new assignments')
    res = OK(id)
    return next
  })
  return res
}

export function removeTeamMember(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const m = s.team.find((x) => x.id === id)
    if (!m) return void (res = FAIL('Team member not found.'))
    const payouts = s.payouts.filter((p) => p.payee === m.name && p.status !== 'cancelled')
    if (payouts.length)
      return void (res = FAIL(`${m.name} has ${payouts.length} payout row(s) — archive instead; money history is append-only.`))
    let next: AppState = { ...s, team: s.team.filter((x) => x.id !== id) }
    next = ev(next, 'team', id, m.status, 'deleted', 'no payout history — hard delete allowed')
    res = OK(id)
    return next
  })
  return res
}

// ── Investors ──────────────────────────────────────────────────────────

export function addInvestor(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const name = S(v, 'name')
    if (!name) return void (res = FAIL('Name is required.'))
    if (s.investors.some((x) => x.name.toLowerCase() === name.toLowerCase()))
      return void (res = FAIL(`${name} is already an investor.`))
    const id = s.seq + 1
    let next: AppState = {
      ...s, seq: s.seq + 1,
      investors: [...s.investors, { id, name, email: S(v, 'email'), deployed: 0, returned: 0 }],
    }
    next = ev(next, 'investor', id, 'new', 'active', 'added to the roster')
    res = OK(id)
    return next
  })
  return res
}

export function updateInvestor(id: number, v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const inv = s.investors.find((x) => x.id === id)
    if (!inv) return void (res = FAIL('Investor not found.'))
    const name = S(v, 'name')
    const email = S(v, 'email')
    if (name && s.investors.some((x) => x.id !== id && x.name.toLowerCase() === name.toLowerCase()))
      return void (res = FAIL(`Another investor is already named ${name}.`))
    let next: AppState = {
      ...s,
      investors: s.investors.map((x) => (x.id === id ? { ...x, name: name || x.name, email: email || x.email } : x)),
    }
    next = ev(next, 'investor', id, 'active', 'active', 'record edited (capital flows derive from rounds + payouts)')
    res = OK(id)
    return next
  })
  return res
}

export function removeInvestor(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const inv = s.investors.find((x) => x.id === id)
    if (!inv) return void (res = FAIL('Investor not found.'))
    if (inv.deployed > 0 || s.payouts.some((p) => p.payee === inv.name && p.status !== 'cancelled'))
      return void (res = FAIL(`${inv.name} has capital in play (${money(inv.deployed)} deployed) — investors settle, they don't vanish.`))
    let next: AppState = { ...s, investors: s.investors.filter((x) => x.id !== id) }
    next = ev(next, 'investor', id, 'active', 'deleted', 'never funded — hard delete allowed')
    res = OK(id)
    return next
  })
  return res
}

// ── Funding rounds ─────────────────────────────────────────────────────

export function createFundingRound(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const project = S(v, 'project')
    if (!project) return void (res = FAIL('Project is required.'))
    const id = s.seq + 1
    let next: AppState = {
      ...s, seq: s.seq + 1,
      fundingRounds: [...s.fundingRounds, {
        id, project, target: N(v, 'target') || 1, raised: 0,
        rule: (S(v, 'rule') || 'fixed') as AppState['fundingRounds'][number]['rule'],
        sourceKind: (S(v, 'sourceKind') || 'new_capital') as AppState['fundingRounds'][number]['sourceKind'],
        status: 'seeking' as const,
      }],
    }
    next = ev(next, 'round', id, 'new', 'seeking', project)
    res = OK(id)
    return next
  })
  return res
}

export function updateFundingRound(id: number, v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const r = s.fundingRounds.find((x) => x.id === id)
    if (!r) return void (res = FAIL('Round not found.'))
    const raised = N(v, 'raised')
    if (raised < r.raised)
      return void (res = FAIL('Raised can only move forward here — money already committed doesn\'t un-commit.'))
    let next: AppState = {
      ...s,
      fundingRounds: s.fundingRounds.map((x) => (x.id === id ? {
        ...x, target: N(v, 'target') || x.target, raised,
        rule: (S(v, 'rule') || x.rule) as AppState['fundingRounds'][number]['rule'],
        sourceKind: (S(v, 'sourceKind') || x.sourceKind) as AppState['fundingRounds'][number]['sourceKind'],
        status: (S(v, 'status') || x.status) as AppState['fundingRounds'][number]['status'],
      } : x)),
    }
    next = ev(next, 'round', id, r.status, S(v, 'status') || r.status, r.project)
    res = OK(id)
    return next
  })
  return res
}

export function deleteFundingRound(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const r = s.fundingRounds.find((x) => x.id === id)
    if (!r) return void (res = FAIL('Round not found.'))
    if (r.raised > 0)
      return void (res = FAIL(`SAR ${r.raised.toLocaleString()} already came in on this round — close it instead of deleting it.`))
    let next: AppState = { ...s, fundingRounds: s.fundingRounds.filter((x) => x.id !== id) }
    next = ev(next, 'round', id, r.status, 'deleted', 'nothing raised — safe to remove')
    res = OK(id)
    return next
  })
  return res
}

// ── Projects ───────────────────────────────────────────────────────────

export function createProject(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const name = S(v, 'name')
    if (!name) return void (res = FAIL('Project name is required.'))
    if (s.projects.some((x) => x.name.toLowerCase() === name.toLowerCase()))
      return void (res = FAIL(`A project named ${name} already exists.`))
    const id = s.seq + 1
    let next: AppState = {
      ...s, seq: s.seq + 1,
      projects: [...s.projects, {
        id, name, clientName: S(v, 'clientName'), phase: S(v, 'phase') || 'kicked off',
        status: (S(v, 'status') || 'proposal') as AppState['projects'][number]['status'],
        fundedBy: (S(v, 'fundedBy') || 'own_cash') as AppState['projects'][number]['fundedBy'],
        stake: N(v, 'stake'),
      }],
    }
    next = ev(next, 'project', id, 'new', S(v, 'status') || 'proposal', name)
    res = OK(id)
    return next
  })
  return res
}

export function updateProject(id: number, v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const p = s.projects.find((x) => x.id === id)
    if (!p) return void (res = FAIL('Project not found.'))
    let next: AppState = {
      ...s,
      projects: s.projects.map((x) => (x.id === id ? {
        ...x, clientName: S(v, 'clientName') || x.clientName, phase: S(v, 'phase') || x.phase,
        status: (S(v, 'status') || x.status) as AppState['projects'][number]['status'],
        fundedBy: (S(v, 'fundedBy') || x.fundedBy) as AppState['projects'][number]['fundedBy'],
        stake: N(v, 'stake') || x.stake,
      } : x)),
    }
    next = ev(next, 'project', id, p.status, S(v, 'status') || p.status, 'project edited')
    res = OK(id)
    return next
  })
  return res
}

export function deleteProject(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const p = s.projects.find((x) => x.id === id)
    if (!p) return void (res = FAIL('Project not found.'))
    const pos = s.purchaseOrders.filter((x) => x.project === p.name)
    if (pos.length)
      return void (res = FAIL(`${p.name} has ${pos.length} purchase order(s) pointing at it — archive the phase instead.`))
    let next: AppState = { ...s, projects: s.projects.filter((x) => x.id !== id) }
    next = ev(next, 'project', id, p.status, 'deleted', 'no POs referenced')
    res = OK(id)
    return next
  })
  return res
}

// ── Purchase orders ────────────────────────────────────────────────────

const PO_NEXT: Record<string, string> = { draft: 'ordered', ordered: 'received', received: 'installed', installed: 'invoiced' }

export function createPurchaseOrder(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const project = S(v, 'project')
    const vendor = S(v, 'vendor')
    if (!project || !vendor) return void (res = FAIL('Project and vendor are both required.'))
    const vendorRow = s.vendors.find((x) => x.name === vendor)
    if (vendorRow?.status === 'archived') return void (res = FAIL(`${vendor} is archived — reactivate it or pick another vendor.`))
    // items: "2x POS terminal @ 450" one per line
    const lines = S(v, 'items').split('\n').map((ln) => {
      const m = ln.match(/^(\d+)\s*x\s+(.+?)\s*@\s*(\d+(?:\.\d+)?)$/i)
      return m ? { qty: Number(m[1]), description: m[2].trim(), unitCost: Number(m[3]) } : null
    }).filter(Boolean) as { qty: number; description: string; unitCost: number }[]
    if (!lines.length) return void (res = FAIL('Add at least one item line — format: 2x POS terminal @ 450'))
    const total = lines.reduce((a, l) => a + l.qty * l.unitCost, 0)
    const id = s.seq + 1
    const num = s.purchaseOrders.reduce((a, p) => Math.max(a, Number(p.no.split('-')[1]) || 0), 20) + 1
    let next: AppState = {
      ...s, seq: s.seq + 1,
      purchaseOrders: [...s.purchaseOrders, {
        id, no: `PO-${num}`, project, vendor, total,
        fundedBy: (S(v, 'fundedBy') || 'own_cash') as AppState['purchaseOrders'][number]['fundedBy'],
        status: 'draft' as const, orderedAt: undefined, assignee: S(v, 'assignee') || undefined, items: lines,
      }],
    }
    next = ev(next, 'po', id, 'new', 'draft', `${no0(num)} · ${project}`)
    res = OK(id)
    return next
  })
  return res
}
const no0 = (n: number) => `PO-${n}`

export function updatePurchaseOrder(id: number, v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const po = s.purchaseOrders.find((x) => x.id === id)
    if (!po) return void (res = FAIL('PO not found.'))
    if (po.status === 'invoiced') return void (res = FAIL('Invoiced POs are settled books — costs can\'t drift after that.'))
    let next: AppState = {
      ...s,
      purchaseOrders: s.purchaseOrders.map((x) => (x.id === id ? {
        ...x, assignee: S(v, 'assignee') || undefined,
        fundedBy: (S(v, 'fundedBy') || x.fundedBy) as AppState['purchaseOrders'][number]['fundedBy'],
        orderedAt: ISO(v, 'orderedAt') ?? x.orderedAt,
      } : x)),
    }
    next = ev(next, 'po', id, po.status, po.status, 'PO edited')
    res = OK(id)
    return next
  })
  return res
}

/** Advance draft→ordered→received→installed→invoiced (each step an event). */
export function advancePurchaseOrder(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const po = s.purchaseOrders.find((x) => x.id === id)
    if (!po) return void (res = FAIL('PO not found.'))
    const to = PO_NEXT[po.status]
    if (!to) return void (res = FAIL('PO is already invoiced — end of the line.'))
    let next: AppState = {
      ...s,
      purchaseOrders: s.purchaseOrders.map((x) => (x.id === id ? {
        ...x, status: to as AppState['purchaseOrders'][number]['status'],
        orderedAt: to === 'ordered' ? new Date().toISOString() : x.orderedAt,
      } : x)),
    }
    next = ev(next, 'po', id, po.status, to, po.no)
    res = OK(id)
    return next
  })
  return res
}

export function deletePurchaseOrder(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const po = s.purchaseOrders.find((x) => x.id === id)
    if (!po) return void (res = FAIL('PO not found.'))
    if (po.status !== 'draft')
      return void (res = FAIL(`${po.no} is ${po.status} — ordered money can't be un-ordered. Mark received or void costs instead.`))
    let next: AppState = { ...s, purchaseOrders: s.purchaseOrders.filter((x) => x.id !== id) }
    next = ev(next, 'po', id, po.status, 'deleted', 'draft only — safe to remove')
    res = OK(id)
    return next
  })
  return res
}

// ── Invoices ───────────────────────────────────────────────────────────

const nextInvoiceNo = (s: AppState) =>
  `INV-${s.invoices.reduce((a, i) => Math.max(a, Number(i.no.split('-')[1]) || 0), 30) + 1}`

export function createInvoice(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const clientName = S(v, 'clientName')
    const total = N(v, 'total')
    if (!clientName) return void (res = FAIL('Pick a client.'))
    if (total <= 0) return void (res = FAIL('Total must be greater than zero.'))
    const dueIn = N(v, 'dueIn') || 14
    const id = s.seq + 1
    const no = nextInvoiceNo(s)
    let next: AppState = {
      ...s, seq: s.seq + 1,
      invoices: [...s.invoices, {
        id, no, clientName, proposalNo: S(v, 'proposalNo') || undefined, total,
        status: 'draft' as const, dueAt: d(dueIn),
        lines: [{ description: `Project invoice — ${clientName}`, qty: 1, unitPrice: total }],
      }],
    }
    next = ev(next, 'invoice', id, 'new', 'draft', no)
    res = OK(id)
    return next
  })
  return res
}

export function updateInvoice(id: number, v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const inv = s.invoices.find((x) => x.id === id)
    if (!inv) return void (res = FAIL('Invoice not found.'))
    if (inv.status !== 'draft')
      return void (res = FAIL('Only draft invoices can be edited — sent paperwork becomes void + reissue, never silent edits.'))
    const total = N(v, 'total') || inv.total
    let next: AppState = {
      ...s,
      invoices: s.invoices.map((x) => (x.id === id ? {
        ...x, clientName: S(v, 'clientName') || x.clientName, total,
        dueAt: ISO(v, 'dueAt') ?? x.dueAt,
        lines: x.lines.map((l, i) => (i === 0 ? { ...l, unitPrice: total } : l)),
      } : x)),
    }
    next = ev(next, 'invoice', id, inv.status, inv.status, `${inv.no} draft edited`)
    res = OK(id)
    return next
  })
  return res
}

export function voidInvoice(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const inv = s.invoices.find((x) => x.id === id)
    if (!inv) return void (res = FAIL('Invoice not found.'))
    if (inv.status === 'paid') return void (res = FAIL(`${inv.no} is paid — money events are append-only; a credit note comes in v2.`))
    if (inv.status === 'void') return void (res = FAIL('Already void.'))
    let next: AppState = { ...s, invoices: s.invoices.map((x) => (x.id === id ? { ...x, status: 'void' as const } : x)) }
    next = ev(next, 'invoice', id, inv.status, 'void', inv.no)
    res = OK(id)
    return next
  })
  return res
}

export function deleteInvoice(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const inv = s.invoices.find((x) => x.id === id)
    if (!inv) return void (res = FAIL('Invoice not found.'))
    if (inv.status !== 'draft')
      return void (res = FAIL('Only drafts can be deleted — anything sent becomes a void record instead.'))
    let next: AppState = { ...s, invoices: s.invoices.filter((x) => x.id !== id) }
    next = ev(next, 'invoice', id, inv.status, 'deleted', 'draft only — safe to remove')
    res = OK(id)
    return next
  })
  return res
}

// ── Payouts ────────────────────────────────────────────────────────────

export function createPayout(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const payee = S(v, 'payee')
    const amount = N(v, 'amount')
    if (!payee) return void (res = FAIL('Pick a payee.'))
    if (amount <= 0) return void (res = FAIL('Amount must be greater than zero.'))
    const triggerId = N(v, 'triggerInvoiceId') || undefined
    const trigger = triggerId ? s.invoices.find((i) => i.id === triggerId) : undefined
    const status = trigger ? (trigger.status === 'paid' ? 'payable' : 'blocked') : 'accrued'
    const id = s.seq + 1
    let next: AppState = {
      ...s, seq: s.seq + 1,
      payouts: [...s.payouts, {
        id, payee,
        payeeRole: (S(v, 'payeeRole') || 'team') as AppState['payouts'][number]['payeeRole'],
        kind: (S(v, 'kind') || 'delivery') as AppState['payouts'][number]['kind'],
        amount, status: status as AppState['payouts'][number]['status'],
        triggerInvoiceId: triggerId, note: S(v, 'note') || undefined,
      }],
    }
    next = ev(next, 'payout', id, 'new', status, trigger ? `trigger ${trigger.no}` : 'manual row')
    res = OK(id)
    return next
  })
  return res
}

export function cancelPayout(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const p = s.payouts.find((x) => x.id === id)
    if (!p) return void (res = FAIL('Payout not found.'))
    if (p.status === 'paid') return void (res = FAIL('Already released — paid rows are append-only, they don\'t un-happen.'))
    if (p.status === 'cancelled') return void (res = FAIL('Already cancelled.'))
    let next: AppState = { ...s, payouts: s.payouts.map((x) => (x.id === id ? { ...x, status: 'cancelled' as const } : x)) }
    next = ev(next, 'payout', id, p.status, 'cancelled', `${p.payee} ${money(p.amount)}`)
    res = OK(id)
    return next
  })
  return res
}

// ── Templates ──────────────────────────────────────────────────────────

export function createTemplate(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    let code = S(v, 'code').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
    if (!code) return void (res = FAIL('Template code is required (letters, numbers, underscores).'))
    if (s.commsTemplates.some((t) => t.code === code))
      return void (res = FAIL(`Template code ${code} already exists.`))
    if (!S(v, 'subject') || !S(v, 'body')) return void (res = FAIL('Subject and body are both required.'))
    const followupCode = S(v, 'followupTemplateCode')
    let next: AppState = {
      ...s, seq: s.seq + 1,
      commsTemplates: [...s.commsTemplates, {
        code, stakeholder: S(v, 'stakeholder') || 'lead', stage: S(v, 'stage') || 'manual',
        subject: S(v, 'subject'), body: S(v, 'body'),
        followupTemplateCode: followupCode || undefined,
        followupAfterDays: followupCode ? N(v, 'followupAfterDays') || 3 : undefined,
      }],
    }
    next = ev(next, 'template', s.seq, 'new', 'active', code)
    res = OK()
    return next
  })
  return res
}

export function updateTemplate(code: string, v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const t = s.commsTemplates.find((x) => x.code === code)
    if (!t) return void (res = FAIL('Template not found.'))
    if (!S(v, 'subject') || !S(v, 'body')) return void (res = FAIL('Subject and body are both required.'))
    const followupCode = S(v, 'followupTemplateCode')
    let next: AppState = {
      ...s,
      commsTemplates: s.commsTemplates.map((x) => (x.code === code ? {
        ...x, stakeholder: S(v, 'stakeholder') || x.stakeholder, stage: S(v, 'stage') || x.stage,
        subject: S(v, 'subject'), body: S(v, 'body'),
        followupTemplateCode: followupCode || undefined,
        followupAfterDays: followupCode ? N(v, 'followupAfterDays') || 3 : undefined,
      } : x)),
    }
    next = ev(next, 'template', s.seq, 'active', 'active', `${code} edited`)
    res = OK()
    return next
  })
  return res
}

export function deleteTemplate(code: string): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const queued = s.outbox.filter((o) => o.templateCode === code && (o.status === 'ready' || o.status === 'scheduled'))
    if (queued.length)
      return void (res = FAIL(`${code} has ${queued.length} queued row(s) in the outbox — skip those first.`))
    let next: AppState = { ...s, commsTemplates: s.commsTemplates.filter((x) => x.code !== code) }
    next = ev(next, 'template', s.seq, 'active', 'deleted', code)
    res = OK()
    return next
  })
  return res
}

// ── Campaigns ──────────────────────────────────────────────────────────

/** steps textarea: "0|lead_intro" one per line. */
const parseSteps = (raw: string): { day: number; templateCode: string }[] =>
  raw.split('\n').map((ln) => {
    const [dStr, code] = ln.split('|').map((x) => x.trim())
    const day = Number(dStr)
    return code && Number.isFinite(day) && day >= 0 ? { day, templateCode: code } : null
  }).filter(Boolean) as { day: number; templateCode: string }[]

export function createCampaign(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const name = S(v, 'name')
    if (!name) return void (res = FAIL('Campaign name is required.'))
    if (s.campaigns.some((c) => c.name.toLowerCase() === name.toLowerCase()))
      return void (res = FAIL(`A campaign named ${name} already exists.`))
    const steps = parseSteps(S(v, 'steps'))
    if (!steps.length) return void (res = FAIL('Add at least one step — format: 0|lead_intro (day|template)'))
    const bad = steps.find((st) => !s.commsTemplates.some((t) => t.code === st.templateCode))
    if (bad) return void (res = FAIL(`No template with code ${bad.templateCode} — check the Templates page.`))
    const id = s.seq + 1
    let next: AppState = {
      ...s, seq: s.seq + 1,
      campaigns: [...s.campaigns, {
        id, name, status: 'paused' as const, audience: S(v, 'audience') || 'manual list',
        channel: 'email' as const, steps: steps.sort((a, b) => a.day - b.day), enrolled: 0, replied: 0,
      }],
    }
    next = ev(next, 'campaign', id, 'new', 'paused', 'created — resume when the list is ready')
    res = OK(id)
    return next
  })
  return res
}

export function updateCampaign(id: number, v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const c = s.campaigns.find((x) => x.id === id)
    if (!c) return void (res = FAIL('Campaign not found.'))
    const rawSteps = S(v, 'steps')
    const steps = rawSteps ? parseSteps(rawSteps) : c.steps
    if (rawSteps) {
      if (!steps.length) return void (res = FAIL('Steps format: 0|lead_intro (day|template)'))
      const bad = steps.find((st) => !s.commsTemplates.some((t) => t.code === st.templateCode))
      if (bad) return void (res = FAIL(`No template with code ${bad.templateCode}.`))
    }
    let next: AppState = {
      ...s,
      campaigns: s.campaigns.map((x) => (x.id === id ? {
        ...x, name: S(v, 'name') || x.name, audience: S(v, 'audience') || x.audience,
        steps: steps.sort((a, b) => a.day - b.day),
      } : x)),
    }
    next = ev(next, 'campaign', id, c.status, c.status, 'campaign edited')
    res = OK(id)
    return next
  })
  return res
}

export function deleteCampaign(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const c = s.campaigns.find((x) => x.id === id)
    if (!c) return void (res = FAIL('Campaign not found.'))
    if (c.status === 'active')
      return void (res = FAIL('Pause the campaign first — deleting an active one would drop enrolled leads silently.'))
    let next: AppState = { ...s, campaigns: s.campaigns.filter((x) => x.id !== id) }
    next = ev(next, 'campaign', id, c.status, 'deleted', c.name)
    res = OK(id)
    return next
  })
  return res
}

// ── Catalogue templates ────────────────────────────────────────────────

export function createCatalogTemplate(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const name = S(v, 'name')
    if (!name) return void (res = FAIL('Template name is required.'))
    if (s.catalog.some((t) => t.name.toLowerCase() === name.toLowerCase()))
      return void (res = FAIL(`A catalogue template named ${name} already exists.`))
    const id = s.seq + 1
    let next: AppState = {
      ...s, seq: s.seq + 1,
      catalog: [...s.catalog, {
        id, name, hue: N(v, 'hue') || 212, fromPrice: N(v, 'fromPrice'), sold: 0, variants: [], attributes: [],
      }],
    }
    next = ev(next, 'catalog', id, 'new', 'active', `${name} — add variants next`)
    res = OK(id)
    return next
  })
  return res
}

export function updateCatalogTemplate(id: number, v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const t = s.catalog.find((x) => x.id === id)
    if (!t) return void (res = FAIL('Catalogue template not found.'))
    let next: AppState = {
      ...s,
      catalog: s.catalog.map((x) => (x.id === id ? {
        ...x, name: S(v, 'name') || x.name, hue: N(v, 'hue') || x.hue,
        fromPrice: N(v, 'fromPrice') || x.fromPrice,
      } : x)),
    }
    next = ev(next, 'catalog', id, 'active', 'active', 'catalogue edited (sent quotes keep their snapshots)')
    res = OK(id)
    return next
  })
  return res
}

export function deleteCatalogTemplate(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const t = s.catalog.find((x) => x.id === id)
    if (!t) return void (res = FAIL('Catalogue template not found.'))
    let next: AppState = { ...s, catalog: s.catalog.filter((x) => x.id !== id) }
    next = ev(next, 'catalog', id, 'active', 'deleted', 'sent proposals keep frozen snapshots')
    res = OK(id)
    return next
  })
  return res
}

// ── Deploy targets ─────────────────────────────────────────────────────

export function createDeployTarget(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const name = S(v, 'name')
    if (!name) return void (res = FAIL('Target name is required.'))
    if (s.deployTargets.some((x) => x.name.toLowerCase() === name.toLowerCase()))
      return void (res = FAIL(`A deploy target named ${name} already exists.`))
    const id = s.seq + 1
    let next: AppState = {
      ...s, seq: s.seq + 1,
      deployTargets: [...s.deployTargets, {
        id, name, clientName: S(v, 'clientName'),
        provider: (S(v, 'provider') || 'vercel') as AppState['deployTargets'][number]['provider'],
        env: (S(v, 'env') || 'production') as AppState['deployTargets'][number]['env'],
        status: (S(v, 'status') || 'never_deployed') as AppState['deployTargets'][number]['status'],
        behindBy: 0, version: S(v, 'version') || 'v0.0.1',
      }],
    }
    next = ev(next, 'deploy', id, 'new', S(v, 'status') || 'never_deployed', name)
    res = OK(id)
    return next
  })
  return res
}

export function updateDeployTarget(id: number, v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const t = s.deployTargets.find((x) => x.id === id)
    if (!t) return void (res = FAIL('Deploy target not found.'))
    const to = S(v, 'status') || t.status
    let next: AppState = {
      ...s,
      deployTargets: s.deployTargets.map((x) => (x.id === id ? {
        ...x, status: to as AppState['deployTargets'][number]['status'],
        version: S(v, 'version') || x.version,
        behindBy: N(v, 'behindBy'),
        lastDeployAt: to === 'healthy' && t.status !== 'healthy' ? new Date().toISOString() : x.lastDeployAt,
      } : x)),
    }
    next = ev(next, 'deploy', id, t.status, to, t.name)
    res = OK(id)
    return next
  })
  return res
}

export function deleteDeployTarget(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const t = s.deployTargets.find((x) => x.id === id)
    if (!t) return void (res = FAIL('Deploy target not found.'))
    let next: AppState = { ...s, deployTargets: s.deployTargets.filter((x) => x.id !== id) }
    next = ev(next, 'deploy', id, t.status, 'deleted', t.name)
    res = OK(id)
    return next
  })
  return res
}

// ── Credentials ────────────────────────────────────────────────────────

export function createCredential(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const provider = S(v, 'provider')
    if (!provider) return void (res = FAIL('Provider is required.'))
    const id = s.seq + 1
    let next: AppState = {
      ...s, seq: s.seq + 1,
      credentials: [...s.credentials, {
        id, provider,
        kind: (S(v, 'kind') || 'api_key') as AppState['credentials'][number]['kind'],
        masked: S(v, 'masked') || '••••••••',
        expiresAt: ISO(v, 'expiresAt'), note: S(v, 'note') || undefined,
      }],
    }
    next = ev(next, 'credential', id, 'new', 'active', `${provider} stored (masked)`)
    res = OK(id)
    return next
  })
  return res
}

export function updateCredential(id: number, v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const c = s.credentials.find((x) => x.id === id)
    if (!c) return void (res = FAIL('Credential not found.'))
    let next: AppState = {
      ...s,
      credentials: s.credentials.map((x) => (x.id === id ? {
        ...x, provider: S(v, 'provider') || x.provider,
        kind: (S(v, 'kind') || x.kind) as AppState['credentials'][number]['kind'],
        masked: S(v, 'masked') || x.masked,
        expiresAt: ISO(v, 'expiresAt') ?? x.expiresAt, note: S(v, 'note') || undefined,
      } : x)),
    }
    next = ev(next, 'credential', id, 'active', 'active', `${c.provider} rotated/edited`)
    res = OK(id)
    return next
  })
  return res
}

export function deleteCredential(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const c = s.credentials.find((x) => x.id === id)
    if (!c) return void (res = FAIL('Credential not found.'))
    let next: AppState = { ...s, credentials: s.credentials.filter((x) => x.id !== id) }
    next = ev(next, 'credential', id, 'active', 'deleted', c.provider)
    res = OK(id)
    return next
  })
  return res
}

// ── Devices ────────────────────────────────────────────────────────────

export function createDevice(v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const kind = S(v, 'kind')
    const clientName = S(v, 'clientName')
    if (!kind || !clientName) return void (res = FAIL('Client and device kind are both required.'))
    const id = s.seq + 1
    let next: AppState = {
      ...s, seq: s.seq + 1,
      devices: [...s.devices, {
        id, clientName, kind, serial: S(v, 'serial') || undefined,
        imageHue: Math.floor(Math.random() * 360), warrantyUntil: ISO(v, 'warrantyUntil'),
      }],
    }
    next = ev(next, 'device', id, 'new', 'on_site', `${kind} @ ${clientName}`)
    res = OK(id)
    return next
  })
  return res
}

export function updateDevice(id: number, v: Vals): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const dev = s.devices.find((x) => x.id === id)
    if (!dev) return void (res = FAIL('Device not found.'))
    let next: AppState = {
      ...s,
      devices: s.devices.map((x) => (x.id === id ? {
        ...x, clientName: S(v, 'clientName') || x.clientName, kind: S(v, 'kind') || x.kind,
        serial: S(v, 'serial') || undefined, warrantyUntil: ISO(v, 'warrantyUntil') ?? x.warrantyUntil,
      } : x)),
    }
    next = ev(next, 'device', id, 'on_site', 'on_site', 'device edited')
    res = OK(id)
    return next
  })
  return res
}

export function deleteDevice(id: number): ActionResult {
  let res: ActionResult = FAIL('not run')
  setState((s) => {
    const dev = s.devices.find((x) => x.id === id)
    if (!dev) return void (res = FAIL('Device not found.'))
    let next: AppState = { ...s, devices: s.devices.filter((x) => x.id !== id) }
    next = ev(next, 'device', id, 'on_site', 'removed', `${dev.kind} @ ${dev.clientName}`)
    res = OK(id)
    return next
  })
  return res
}
