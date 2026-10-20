import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow } from '../components/Layout'
import { Chip } from '../components/StatusChip'
import { useAppState } from '../lib/store'
import { money } from '../lib/format'

const STAKEHOLDERS = ['all', 'lead', 'client', 'team', 'investor', 'vendor'] as const

export function Templates() {
  const s = useAppState()
  const [filter, setFilter] = useState<(typeof STAKEHOLDERS)[number]>('all')
  const [openCode, setOpenCode] = useState<string | null>(null)

  const list = s.commsTemplates.filter((t) => filter === 'all' || t.stakeholder === filter)

  return (
    <>
      <PageHeader
        title="Templates"
        subtitle="Plain-language email templates with follow-up chains — every outbox row renders one"
        action={
          <div className="flex flex-wrap gap-1">
            {STAKEHOLDERS.map((x) => (
              <button
                key={x}
                onClick={() => setFilter(x)}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset capitalize ${
                  filter === x ? 'bg-gray-900 text-white ring-gray-900' : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50'
                }`}
              >
                {x}
              </button>
            ))}
          </div>
        }
      />

      <SectionCard title={`${list.length} templates`} hint="click a row to preview">
        {list.length === 0 && <EmptyRow text="No templates in this group." />}
        {list.map((t) => {
          const open = openCode === t.code
          const chain = []
          let cur = t
          while (cur?.followupTemplateCode && chain.length < 6) {
            const next = s.commsTemplates.find((x) => x.code === cur.followupTemplateCode)
            if (!next) break
            chain.push(next)
            cur = next
          }
          return (
            <div key={t.code}>
              <button
                onClick={() => setOpenCode(open ? null : t.code)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
              >
                <span className="font-mono text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-600 shrink-0">{t.code}</span>
                <span className="text-sm text-gray-800 truncate flex-1">{t.subject}</span>
                <Chip tone="gray">{t.stakeholder}</Chip>
                <span className="text-xs text-gray-400 hidden sm:block w-40 truncate">{t.stage}</span>
                <span className="text-gray-400 text-xs">{open ? '▴' : '▾'}</span>
              </button>
              {open && (
                <div className="px-4 pb-4 -mt-1">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-gray-50 rounded-lg p-3 text-gray-700 font-sans border border-gray-100">
                    <strong className="block text-xs uppercase tracking-wider text-gray-400 mb-1.5">Subject: {t.subject}</strong>
                    {t.body}
                  </pre>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500 overflow-x-auto">
                    <span className="font-mono text-gray-600">{t.code}</span>
                    {chain.map((c) => (
                      <span key={c.code} className="flex items-center gap-1.5 shrink-0">
                        <span>→</span>
                        <span className="font-mono text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">
                          {c.code}{c.followupAfterDays ? ` (+${c.followupAfterDays}d)` : ''}
                        </span>
                      </span>
                    ))}
                    {chain.length === 0 && <span className="text-gray-400">· end of chain (no auto follow-up)</span>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </SectionCard>

      <div className="mt-4 grid sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm">
          <div className="font-semibold text-gray-900 mb-1">Merge fields</div>
          <p className="text-xs text-gray-500 leading-relaxed">
            {'{name} {business} {proposal_no} {amount} {invoice_no} {due_date} …'} — filled from the
            record the template is sent against.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm">
          <div className="font-semibold text-gray-900 mb-1">Chains</div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Each template can name its follow-up + delay; sending schedules the next row instead of
            making you remember.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm">
          <div className="font-semibold text-gray-900 mb-1">Analytics tie-in</div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Response rates by template feed the growth pillar — same rows, no extra tracking.
          </p>
        </div>
      </div>
    </>
  )
}
