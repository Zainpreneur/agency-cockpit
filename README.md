# Agency Cockpit

Frontend for **Agency OS** — the solo-mode owner cockpit designed in
[Zainpreneur/Agency-OS-Plan](https://github.com/Zainpreneur/Agency-OS-Plan)
(26 planning docs: workflows, forms, analytics, comms, guards).

**Frontend only, for now.** No backend, no database — state lives in a single
in-memory store (`src/lib/store.ts`) seeded with the plan's running scenarios
(Alnoor POS, Aqua Pets, Desert Carwash…). That file is the *only* swap point:
when the Hono API lands, its actions become HTTP calls and reads move under
TanStack Query — no component changes.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle
npm run typecheck
npm run smoke      # route + wizard + cascade smoke (dev server must be up)
npm run smoke:crud # create/edit/delete + guard smoke (dev server must be up)
```

## New in this release (Phase B + C foundations)

- **⌘K Command Palette** — Actions first (new lead, mark paid, send invoice…), then fuzzy search across all entities
- **Dark mode** — Toggle in Settings, persists in localStorage
- **Generic PipelineBoard** — Reusable kanban with drag = status flip + cascade preview on hover
- **Enhanced DataTable** — Sort, group by column, bulk-select, CSV export
- **ReceiptUploader** — Camera/file attachment for PO receipts (mobile-first)
- **PO Receipts Gallery** — Visual gallery of uploaded receipts

## Stack

React 19 · Vite 7 · Tailwind 4 · TypeScript · React Router 7
(no backend, per instruction — Hono + Drizzle + SQLite come later)

## Full CRUD, everywhere

Every entity is creatable, editable and removable **from the UI** — not just
readable (doc 27's forms inventory). One generic `FormModal` (field descriptors
in, values out) powers the **~25 forms**, and one `ConfirmModal` surfaces the
store's guard reasons inline. Row-level `✎` / `✕` actions sit on every table,
card, gallery tile and detail modal.

| Entity | Create | Edit | Remove | Delete guard |
|---|---|---|---|---|
| Lead | ✓ | ✓ | Archive | pending sends cancelled |
| Client | ✓ | ✓ | Archive | blocked while invoices open |
| Vendor | ✓ | ✓ | Archive / Delete | delete blocked when POs reference it → archive |
| Team member | ✓ | ✓ | Archive / Delete | delete blocked when payout rows exist → archive |
| Investor | ✓ | ✓ | Delete | blocked while capital is deployed |
| Funding round | ✓ | ✓ | Delete | blocked once anyone raised (close instead) |
| Project | ✓ | ✓ | Delete | blocked when POs point at it |
| Purchase order | ✓ | ✓ advance draft→invoiced | Delete | draft only — ordered money is settled |
| Invoice | ✓ | Draft only | Void / Delete draft | paid rows never move (append-only) |
| Payout | ✓ ad-hoc | — | Cancel | paid rows never move (append-only) |
| Template | ✓ | ✓ | Delete | blocked while queued in the outbox |
| Campaign | ✓ | ✓ | Delete | active campaigns must pause first |
| Catalogue template | ✓ | ✓ | Delete | quotes keep frozen snapshots |
| Deploy target | ✓ | ✓ | Delete | — |
| Credential | ✓ | ✓ | Delete | — |
| Device | ✓ | ✓ | Delete | — |

Creates and status transitions write **append-only status events**; money rows
are never erased — they void/cancel. The one store rule: *mimic the plan's
guards, surface them as errors, never silently drop history.*

## What's built

| Area | Screen | Highlights |
|---|---|---|
| **Today** | `/` | Five queues (needs reply / send today / money / blockers / this week) + payout pulse. Paste-reply, Copy+Send, Mark paid with **cascade preview** — all in place |
| **Dashboard** | `/dashboard` | Six pillars (Money · Pipeline · Delivery · People · Risk radar · Growth), every metric computed from existing rows, plus **weekly review mode** (copy → paste into your notes) |
| **Sales** | `/sales/leads` | Board (drag = status flip, event written) · cards · list · table · timeline · calendar — **drag-and-drop with cascade preview** |
| | `/sales/leads/:id` | 360°: timeline (comms + status events), proposals, queued messages, paste reply (reply-cancels-pending). Won → **Turn into client** |
| | `/sales/proposals` | Board (drag = status flip, event written) · table · cards · calendar (quote expiry) |
| | `/sales/proposals/new` | **5-step conditional proposal builder** — variant pills filter attributes, catalogue exclusions disable impossible combos with the reason shown, discount > 0 demands a written reason, owner-only margin, snapshot & send |
| | `/sales/campaigns` | Email sequences per batch — visible chains, enrolment/reply stats, pause/resume (guard: no auto-send) |
| | `/sales/catalogue` | Variant/attribute engine overview (doc 17) |
| **Clients** | `/clients` | Table · cards — where won leads land (intake questionnaire queues automatically) |
| | `/clients/:id` | **Client 360°**: projects, invoices (+ remind / mark-paid cascade), proposals, message timeline (comms + status events), deploy targets, machines, POs, blocked-payout health |
| **Delivery** | `/projects` | Projects (from store), purchase orders (investor-advance badge), deploy targets, credentials (masked) |
| | `/projects/:id` | **Project 360°** — tabs: Overview (health, waterfall), Build (module orders, POs, deploys), Money (invoices, payouts, margin), Comms (timeline), Assets (devices) |
| | `/vendors` | Table · cards — per-vendor POs, terms, totals; row → detail modal |
| | `/assets` | Gallery · list — client devices with serial, warranty chip, color-first photo fallback |
| **Money** | `/money/invoices` | Table (bulk select + CSV) · list · cards · calendar — aging-sorted, reminder + mark-paid with cascade preview (which payouts unlock) |
| | `/money/payouts` | Board · table (bulk select + CSV) — accrued / blocked / payable / paid; guards decide, gestures don't; release is deliberate |
| **People** | `/people` | Team (flat fee only) + investor positions + funding rounds |
| | `/people/investors/:id` | **Investor 360°** — tabs: Overview (waterfall, position), Rounds, Payouts, Comms, Statements (I6/I7/I9/I10 generators) |
| **Comms** | `/comms/outbox` | Today / this week / sent / cancelled groups; Copy+Send, Skip, chained follow-ups |
| | `/comms/templates` | ~30 templates with visible follow-up chains, grouped by stakeholder |
| **Calendar** | `/calendar` | The due-date family in one month grid — follow-ups, quote expiry, invoice due, queued sends, credential expiry, warranties. No new table (doc 25) |
| **Settings** | `/settings` | Cadence numbers, deposit gate toggle, dark mode, email-only v1 note |

### Seven views (doc 25), everywhere they matter

| View | Used by |
|---|---|
| Board | Leads, Proposals, Payouts (drag = status flip, cascades on drop) |
| Table | Leads, Proposals, Invoices, Payouts, Clients, Vendors, Assets (bulk-select + CSV on money tables) |
| List | Leads, Invoices, Assets |
| Cards | Leads, Proposals, Invoices, Clients, Vendors |
| Timeline | Leads, Clients, Projects (comms + status events merged) |
| Gallery | Assets (client devices) |
| 360° | Lead detail, Client detail, Project detail, Investor detail |
| Calendar | Global, plus per-page overlays on Leads, Proposals, Invoices |

The chosen view persists per entity (localStorage) — the app opens the way you
left it.

## The plan's rules visible in the UI

- **Blocked → payable, never dragged**: payouts wait on their invoice; marking
  the invoice paid previews and performs the unlock.
- **Reply-cancels-pending**: a pasted inbound reply cancels scheduled outbound.
- **Price snapshots**: proposals freeze lines at send.
- **Flat fee only**: no hourly/monthly comp anywhere.
- **Owner-only numbers**: margins shown to you (it's your app).
- **Drag = status flip (with cascade)**: lead/proposal boards write events on drop; payouts stay guard-driven.
- **Timeline = event union**: every detail screen merges `status_events` ∪ `comms_log` ∪ payments so history never drifts.
- **Bulk actions on money**: invoices and payouts tables support multi-select and CSV export.
- **Waterfall on investor deals**: capital stack visual clears tiers in order — principal → hurdle → carry.
- **⌘K everywhere**: one keystroke to any action or entity.
- **Dark mode**: light/dark themes with localStorage persistence.
- **Receipt camera**: mobile-first PO receipt capture.

## Roadmap

1. **Done**: Full frontend over mock store — seven views, dashboard, clients,
   vendors, calendar, campaigns, full CRUD, 360s, drag-and-drop boards, bulk
   actions, timelines, waterfall, ⌘K palette, dark mode, receipt upload
2. **Phase B remaining**: Module Orders board, Tickets, Deploy Targets rollback,
   Client Repos, Update PRs, Expenses/Cost Allocation, Payments table,
   Investor Payouts board, Receipts gallery
3. **Phase C**: Reports (P&L, margins), Multi-branch, Default/Salvage workflows,
   RTL/Arabic, Offline drafts
4. **Next**: Hono API + Drizzle/SQLite over schema v12 — swap
   `src/lib/store.ts` for TanStack Query + fetch
