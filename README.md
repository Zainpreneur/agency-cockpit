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
```

## Stack

React 19 · Vite 7 · Tailwind 4 · TypeScript · React Router 7
(no backend, per instruction — Hono + Drizzle + SQLite come later)

## What's built

| Area | Screen | Highlights |
|---|---|---|
| **Today** | `/` | Five queues (needs reply / send today / money / blockers / this week) + payout pulse. Paste-reply, Copy+Send, Mark paid with **cascade preview** — all in place |
| **Dashboard** | `/dashboard` | Six pillars (Money · Pipeline · Delivery · People · Risk radar · Growth), every metric computed from existing rows, plus **weekly review mode** (copy → paste into your notes) |
| **Sales** | `/sales/leads` | Board · cards · list · table · timeline · calendar — moving a card is a status flip with an event behind it |
| | `/sales/leads/:id` | 360°: timeline, proposals, queued messages, paste reply (reply-cancels-pending). Won → **Turn into client** |
| | `/sales/proposals` | Board · table · cards · calendar (quote expiry) |
| | `/sales/proposals/new` | **5-step conditional proposal builder** — variant pills filter attributes, catalogue exclusions disable impossible combos with the reason shown, discount > 0 demands a written reason, owner-only margin, snapshot & send |
| | `/sales/campaigns` | Email sequences per batch — visible chains, enrolment/reply stats, pause/resume (guard: no auto-send) |
| | `/sales/catalogue` | Variant/attribute engine overview (doc 17) |
| **Clients** | `/clients` | Table · cards — where won leads land (intake questionnaire queues automatically) |
| | `/clients/:id` | **Client 360°**: projects, invoices (+ remind / mark-paid cascade), proposals, message timeline, deploy targets, machines, POs, blocked-payout health |
| **Delivery** | `/projects` | Projects (from store), purchase orders (investor-advance badge), deploy targets, credentials (masked) |
| | `/vendors` | Table · cards — per-vendor POs, terms, totals; row → detail modal |
| | `/assets` | Gallery · list — client devices with serial, warranty chip, color-first photo fallback |
| **Money** | `/money/invoices` | Table · list · cards · calendar — aging-sorted, reminder + mark-paid with cascade preview (which payouts unlock) |
| | `/money/payouts` | Board · table — accrued / blocked / payable / paid; guards decide, gestures don't; release is deliberate |
| **People** | `/people` | Team (flat fee only) + investor positions + funding rounds |
| **Comms** | `/comms/outbox` | Today / this week / sent / cancelled groups; Copy+Send, Skip, chained follow-ups |
| | `/comms/templates` | ~30 templates with visible follow-up chains, grouped by stakeholder |
| **Calendar** | `/calendar` | The due-date family in one month grid — follow-ups, quote expiry, invoice due, queued sends, credential expiry, warranties. No new table (doc 25) |
| **Settings** | `/settings` | Cadence numbers, deposit gate toggle, email-only v1 note |

### Seven views (doc 25), everywhere they matter

| View | Used by |
|---|---|
| Board | Leads, Proposals, Payouts |
| Table | Leads, Proposals, Invoices, Payouts, Clients, Vendors, Assets |
| List | Leads, Invoices, Assets |
| Cards | Leads, Proposals, Invoices, Clients, Vendors |
| Timeline | Leads (all conversations) |
| Gallery | Assets (client devices) |
| 360° | Lead detail, Client detail |
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

## Roadmap

1. **Now**: full frontend over mock store — seven views, dashboard, clients,
   vendors, calendar, campaigns (this repo)
2. **Next**: Hono API + Drizzle/SQLite over the plan's schema v11 — swap
   `src/lib/store.ts` for TanStack Query + fetch
3. **Later**: email provider wiring, offline drafts, board drag-and-drop,
   record forms (add client/vendor/device from the UI), rollback buttons
