import { useState, useMemo } from 'react'
import { PageHeader, SectionCard, EmptyRow } from '../components/Layout'
import { Chip } from '../components/StatusChip'
import { useAppState } from '../lib/store'
import { money, dateShort } from '../lib/format'

export function CommsLog() {
  const s = useAppState()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all')
  const [stakeholder, setStakeholder] = useState<string>('all')

  const filtered = useMemo(() => {
    return s.commsLog
      .filter((c) => {
        if (filter !== 'all' && c.direction !== filter) return false
        if (stakeholder !== 'all' && c.contactableName !== stakeholder) return false
        if (query && !c.snippet.toLowerCase().includes(query.toLowerCase()) && !c.contactableName.toLowerCase().includes(query.toLowerCase())) return false
        return true
      })
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [s.commsLog, filter, stakeholder, query])

  const stakeholders = [...new Set(s.commsLog.map((c) => c.contactableName))]

  return (
    <>
      <PageHeader
        title="Comms Log"
        subtitle="Global timeline — every message in and out, searchable (doc 25)"
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages…"
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500"
        />
        <div className="flex rounded-lg overflow-hidden ring-1 ring-gray-300">
          {(['all', 'in', 'out'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium capitalize ${filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {f === 'all' ? 'All' : f === 'in' ? 'Inbound' : 'Outbound'}
            </button>
          ))}
        </div>
        <select
          value={stakeholder}
          onChange={(e) => setStakeholder(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
        >
          <option value="all">All contacts</option>
          {stakeholders.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <SectionCard title={`Messages (${filtered.length})`}>
        {filtered.length === 0 && <EmptyRow text="No messages match your filters." />}
        {filtered.map((c) => (
          <div key={c.id} className="flex gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
            <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
              c.direction === 'in' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {c.direction === 'in' ? '←' : '→'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-gray-900">{c.contactableName}</span>
                <span className="text-xs text-gray-400">{dateShort(c.at)}</span>
                {c.templateCode && <span className="font-mono text-[11px] text-gray-400">{c.templateCode}</span>}
              </div>
              <div className="text-sm text-gray-700 mt-0.5">{c.snippet}</div>
            </div>
            <Chip tone={c.direction === 'in' ? 'blue' : 'gray'}>{c.direction === 'in' ? 'in' : 'out'}</Chip>
          </div>
        ))}
      </SectionCard>
    </>
  )
}