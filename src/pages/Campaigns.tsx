import { PageHeader, SectionCard } from '../components/Layout'
import { Chip } from '../components/StatusChip'
import { useAppState, toggleCampaign } from '../lib/store'

const STATUS_TONE = { active: 'green', paused: 'amber', ended: 'gray' } as const

export function Campaigns() {
  const s = useAppState()

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="Email sequences to a batch of leads — steps fire as outbox rows, replies land in Today"
        action={<span className="text-sm text-gray-400 tabular-nums">{s.campaigns.filter((c) => c.status === 'active').length} active</span>}
      />

      <div className="space-y-4">
        {s.campaigns.map((c) => {
          const replyPct = c.enrolled ? Math.round((c.replied / c.enrolled) * 100) : 0
          return (
            <SectionCard
              key={c.id}
              title={c.name}
              hint={c.audience}
              action={
                <div className="flex items-center gap-2">
                  <Chip tone={STATUS_TONE[c.status]}>{c.status}</Chip>
                  {c.status !== 'ended' && (
                    <button
                      onClick={() => toggleCampaign(c.id)}
                      className={`rounded-lg text-xs font-medium px-3 py-1.5 ring-1 ring-inset transition ${
                        c.status === 'active'
                          ? 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50'
                          : 'bg-gray-900 text-white ring-gray-900 hover:bg-gray-800'
                      }`}
                    >
                      {c.status === 'active' ? 'Pause' : 'Resume'}
                    </button>
                  )}
                </div>
              }
            >
              <div className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
                  {c.steps.map((step, i) => (
                    <span key={i} className="flex items-center gap-1.5 shrink-0">
                      {i > 0 && <span className="text-gray-300">→</span>}
                      <span className="rounded-lg bg-gray-50 ring-1 ring-gray-200 px-2 py-1 text-xs text-gray-700">
                        <span className="text-gray-400 mr-1 tabular-nums">Day {step.day}</span>
                        <span className="font-mono">{step.templateCode}</span>
                      </span>
                    </span>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 max-w-md">
                  <div>
                    <div className="text-xs text-gray-500">Enrolled</div>
                    <div className="text-sm font-semibold tabular-nums">{c.enrolled}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Replied</div>
                    <div className="text-sm font-semibold tabular-nums">{c.replied}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Reply rate</div>
                    <div className={`text-sm font-semibold tabular-nums ${replyPct >= 20 ? 'text-emerald-600' : replyPct >= 10 ? 'text-amber-600' : 'text-gray-700'}`}>
                      {replyPct}%
                    </div>
                  </div>
                </div>

                {/* reply-rate bar */}
                <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden max-w-md">
                  <div
                    className={`h-full rounded-full ${replyPct >= 20 ? 'bg-emerald-500' : replyPct >= 10 ? 'bg-amber-500' : 'bg-gray-400'}`}
                    style={{ width: Math.max(3, replyPct) + '%' }}
                  />
                </div>

                <p className="text-xs text-gray-400 mt-2.5 leading-relaxed">
                  {c.status === 'active'
                    ? 'Active — next steps schedule outbox rows automatically; a reply cancels what is pending for that lead.'
                    : c.status === 'paused'
                      ? 'Paused — enrolled leads keep their place, no new sends.'
                      : 'Ended — results kept for the growth pillar.'}
                </p>
              </div>
            </SectionCard>
          )
        })}
      </div>
    </>
  )
}
