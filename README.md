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
| **Sales** | `/sales/leads` | Kanban board — moving a card is a status flip with an event behind it |
| | `/sales/leads/:id` | 360°: timeline, proposals, queued messages, paste reply (reply-cancels-pending) |
| | `/sales/proposals/new` | **5-step conditional proposal builder** — variant pills filter attributes, catalogue exclusions disable impossible combos with the reason shown, discount > 0 demands a written reason, owner-only margin, snapshot & send |
| | `/sales/catalogue` | Variant/attribute engine overview (doc 17) |
| **Money** | `/money/invoices` | Aging-sorted (overdue first), reminder + mark-paid with cascade preview (which payouts unlock) |
| | `/money/payouts` | Accrued / blocked / payable / paid board — guards decide, gestures don't; release is deliberate |
| **Delivery** | `/projects` | Projects, purchase orders (investor-advance badge), deploy targets, credentials (masked), devices |
| **People** | `/people` | Team (flat fee only) + investor positions + funding rounds |
| **Comms** | `/comms/outbox` | Today / this week / sent / cancelled groups; Copy+Send, Skip, chained follow-ups |
| | `/comms/templates` | ~30 templates with visible follow-up chains, grouped by stakeholder |
| **Settings** | `/settings` | Cadence numbers, deposit gate toggle, email-only v1 note |

## The plan's rules visible in the UI

- **Blocked → payable, never dragged**: payouts wait on their invoice; marking
  the invoice paid previews and performs the unlock.
- **Reply-cancels-pending**: a pasted inbound reply cancels scheduled outbound.
- **Price snapshots**: proposals freeze lines at send.
- **Flat fee only**: no hourly/monthly comp anywhere.
- **Owner-only numbers**: margins shown to you (it's your app).

## Roadmap

1. **Now**: frontend over mock store (this repo)
2. **Next**: Hono API + Drizzle/SQLite over the plan's schema v11 — swap
   `src/lib/store.ts` for TanStack Query + fetch
3. **Later**: email provider wiring, offline drafts, board drag-and-drop,
   gallery/calendar views, rollback buttons
