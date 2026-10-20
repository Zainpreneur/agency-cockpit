import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow } from '../components/Layout'
import { StatusChip, Chip } from '../components/StatusChip'
import { SendEmailModal } from '../components/SendEmailModal'
import { useAppState, sendOutboxItem, skipOutboxItem } from '../lib/store'
import { dateShort, dueLabel } from '../lib/format'
import type { OutboxItem } from '../lib/types'

export function Outbox() {
  const s = useAppState()
  const [sendItem, setSendItem] = useState<OutboxItem | null>(null)

  const todayEnd = new Date().setHours(23, 59, 59, 999)
  const weekEnd = Date.now() + 7 * 86_400_000

  const groups = [
    {
      title: 'Today',
      hint: 'copy → mail app → mark sent',
      items: s.outbox.filter((o) => o.status === 'ready'),
    },
    {
      title: 'This week',
      hint: 'chained follow-ups, fire early if you want',
      items: s.outbox.filter((o) => o.status === 'scheduled' && new Date(o.dueAt).getTime() <= weekEnd),
    },
    {
      title: 'Sent',
      hint: '',
      items: s.outbox.filter((o) => o.status === 'sent').sort((a, b) => b.dueAt.localeCompare(a.dueAt)),
    },
    {
      title: 'Cancelled / skipped',
      hint: 'inbound replies cancel pending outbound automatically',
      items: s.outbox.filter((o) => o.status === 'skipped'),
    },
  ]

  return (
    <>
      <PageHeader
        title="Outbox"
        subtitle="Email-only v1 — every generated message waits here for copy + send"
        action={
          <span className="rounded-lg bg-white border border-gray-300 text-sm px-3 py-2 text-gray-600 tabular-nums">
            {s.outbox.filter((o) => o.status === 'ready').length} ready today
          </span>
        }
      />

      <div className="space-y-4">
        {groups.map((g) => (
          <SectionCard key={g.title} title={g.title} hint={g.hint} action={<span className="text-xs text-gray-400 tabular-nums">{g.items.length}</span>}>
            {g.items.length === 0 && <EmptyRow text="Nothing here." />}
            {g.items.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-gray-50/70">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate">{o.subject}</div>
                  <div className="text-xs text-gray-500 truncate">
                    to <span className="text-gray-700 font-medium">{o.contactableName}</span> · {o.templateCode} · {o.stakeholder}
                    {o.cancelledBy === 'inbound_reply' && ' · cancelled by their reply'}
                  </div>
                </div>
                <Chip tone={dueToneFor(o)}>{dueLabel(o.dueAt)}</Chip>
                <StatusChip status={o.status} domain="outbox" />
                <div className="flex items-center gap-1.5">
                  {(o.status === 'ready' || o.status === 'scheduled') && (
                    <>
                      <button
                        onClick={() => setSendItem(o)}
                        className="rounded-lg bg-blue-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-blue-700"
                      >
                        Copy + Send
                      </button>
                      <button
                        onClick={() => skipOutboxItem(o.id)}
                        className="rounded-lg bg-white text-gray-500 ring-1 ring-gray-300 text-xs font-medium px-3 py-1.5 hover:bg-gray-50"
                      >
                        Skip
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </SectionCard>
        ))}
      </div>

      <div className="mt-4 text-xs text-gray-400 leading-relaxed">
        Sequences chain automatically: sending <span className="font-mono">proposal_send</span> schedules{' '}
        <span className="font-mono">proposal_followup</span> in 3 days (template chains from doc 22).
        A pasted inbound reply cancels whatever was pending for that contact.
      </div>

      <SendEmailModal item={sendItem} onClose={() => setSendItem(null)} />
    </>
  )
}

function dueToneFor(o: OutboxItem): 'amber' | 'green' | 'gray' {
  if (o.status === 'sent') return 'green'
  if (o.status === 'ready') return 'amber'
  return 'gray'
}
