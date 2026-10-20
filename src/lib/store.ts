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
  AppState, CommsEntry, Invoice, OutboxItem, Payout, Proposal, StatusEvent,
} from './types'
import { mockData } from './mockData'
import { d } from './format'

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
