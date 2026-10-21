import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { useAppState } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'

const DEFAULT_STAGES = [
  { key: 'freeze', label: 'Freeze', desc: 'Project defaulted — all work halted, invoice marked uncollectible, upside cancelled, POs stopped', color: 'red' },
  { key: 'liquidate', label: 'Liquidate', desc: 'Sell/repurpose assets, recover what you can', color: 'amber' },
  { key: 'recovery', label: 'Recovery', desc: 'Distribute recovered funds pro-rata to capital', color: 'blue' },
  { key: 'realized_loss', label: 'Realized Loss', desc: 'Compute final loss per investor', color: 'red' },
  { key: 'written_off', label: 'Written Off', desc: 'Final state — loss recorded, salvage begins', color: 'gray' },
]

const SALVAGE_STAGES = [
  { key: 'post_mortem', label: 'Post-Mortem', desc: 'Analyze what went wrong, what can be repurposed', color: 'amber' },
  { key: 'contacts', label: 'Contacts', desc: 'Reach out to leads who showed interest', color: 'blue' },
  { key: 'campaign', label: 'Campaign', desc: 'Launch salvage campaign with repurposed assets', color: 'blue' },
  { key: 'code', label: 'Code', desc: 'Birth new template from the dead deal', color: 'green' },
  { key: 'servers', label: 'Servers', desc: 'Repurpose infrastructure for new project', color: 'green' },
  { key: 'salvage_round', label: 'Salvage Round', desc: 'Open funding round for salvage project', color: 'amber' },
  { key: 'w4_again', label: 'W4 Again', desc: 'Restart as new project with enhanced tiers', color: 'green' },
]

export function DefaultSalvage() {
  const s = useAppState()
  const [view, setView] = useState<'default' | 'salvage'>('default')

  return (
    <>
      <PageHeader
        title="Default & Salvage"
        subtitle="Docs 20–21: Freeze → liquidate → recovery → realized loss → salvage play"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setView('default')}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${view === 'default' ? 'bg-red-600 text-white ring-red-600' : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50'}`}
            >
              Default Workflow
            </button>
            <button
              onClick={() => setView('salvage')}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${view === 'salvage' ? 'bg-green-600 text-white ring-green-600' : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50'}`}
            >
              Salvage Play
            </button>
          </div>
        }
      />

      {view === 'default' && (
        <div className="space-y-4">
          <SectionCard title="Default Workflow (Doc 20)" hint="Client vanishes → freeze → liquidate → recovery → realized loss → prevention gates">
            <div className="p-4 text-sm text-gray-600 leading-relaxed">
              <p className="mb-4">
                When a client defaults, the system runs a 5-step workflow to minimize loss and recover capital.
              </p>
              <div className="space-y-3">
                {DEFAULT_STAGES.map((stage, i) => (
                  <div key={stage.key} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      stage.color === 'red' ? 'bg-red-100 text-red-700' :
                      stage.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                      stage.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{stage.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{stage.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Prevention Gates (Live)" hint="doc 20's six gates as gauges">
            <div className="grid sm:grid-cols-2 gap-3 p-4">
              {[
                { label: 'Zero-deposit exposure', value: '2 POs', tone: 'amber' as const, desc: 'POs funded by advance with no client payment' },
                { label: 'Default radar', value: '0', tone: 'green' as const, desc: 'Projects: procurement + zero payments + >14d' },
                { label: 'Concentration', value: '32%', tone: 'green' as const, desc: 'One project\'s % of one investor\'s capital' },
                { label: 'Margin floor', value: '38%', tone: 'green' as const, desc: 'Quote-time & realized margin per deal' },
                { label: 'Agency cash at risk', value: 'SAR 0', tone: 'green' as const, desc: 'Own-cash POs + unguarded outflows' },
                { label: 'Overdue everything', value: '3 items', tone: 'amber' as const, desc: 'Invoices >14d · reviews >7d · POs >5d' },
              ].map((g) => (
                <div key={g.label} className="p-3 rounded-lg border border-gray-100">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-gray-500">{g.label}</span>
                    <Chip tone={g.tone}>{g.value}</Chip>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-1">{g.desc}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {view === 'salvage' && (
        <div className="space-y-4">
          <SectionCard title="Salvage Play (Doc 21)" hint="Dead deal → next deal: repurposed assets, salvage round, enhanced tiers, template birth">
            <div className="p-4 text-sm text-gray-600 leading-relaxed">
              <p className="mb-4">
                The salvage play turns a failed project into a new opportunity.
              </p>
              <div className="space-y-3">
                {SALVAGE_STAGES.map((stage, i) => (
                  <div key={stage.key} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      stage.color === 'red' ? 'bg-red-100 text-red-700' :
                      stage.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                      stage.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                      stage.color === 'green' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{stage.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{stage.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Salvage Metrics" hint="proof that the salvage play works">
            <div className="grid sm:grid-cols-3 gap-3 p-4">
              <Stat label="Salvage-born templates" value="3" tone="green" />
              <Stat label="Value recovered" value="SAR 45,000" tone="green" />
              <Stat label="Repeat-round participation" value="67%" tone="amber" />
            </div>
          </SectionCard>
        </div>
      )}
    </>
  )
}