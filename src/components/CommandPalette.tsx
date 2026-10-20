import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState, createLead, createInvoice, createProject, createPurchaseOrder, addTeamMember, addInvestor, createCampaign, createTemplate, createCatalogTemplate, createDeployTarget, createCredential } from '../lib/store'
import { money } from '../lib/format'
import type { Lead, Client, Project, Invoice, Payout, Vendor, TeamMember, Investor } from '../lib/types'

/**
 * ⌘K Command Palette — the signature interaction (doc 23 #6).
 * Actions first ("new lead", "mark paid", "send invoice"), then fuzzy search
 * across leads/clients/invoices/POs.
 */
export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const s = useAppState()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Build action list — static actions first
  const actions = [
    { id: 'new-lead', label: 'New lead', desc: 'Quick capture a lead', icon: '👤', action: () => navigate('/sales/leads') },
    { id: 'new-client', label: 'New client', desc: 'Create a client record', icon: '👥', action: () => navigate('/clients') },
    { id: 'new-project', label: 'New project', desc: 'Start a delivery project', icon: '📦', action: () => navigate('/projects') },
    { id: 'new-proposal', label: 'New proposal', desc: 'Open the 5-step builder', icon: '📝', action: () => navigate('/sales/proposals/new') },
    { id: 'new-invoice', label: 'New invoice', desc: 'Create a draft invoice', icon: '🧾', action: () => navigate('/money/invoices') },
    { id: 'new-payout', label: 'New payout', desc: 'Create an ad-hoc payout', icon: '💸', action: () => navigate('/money/payouts') },
    { id: 'new-campaign', label: 'New campaign', desc: 'Start an email sequence', icon: '📧', action: () => navigate('/sales/campaigns') },
    { id: 'new-template', label: 'New template', desc: 'Add a comms template', icon: '✉️', action: () => navigate('/comms/templates') },
    { id: 'new-catalog', label: 'New catalogue template', desc: 'Add a service template', icon: '📦', action: () => navigate('/sales/catalogue') },
    { id: 'new-vendor', label: 'New vendor', desc: 'Add a vendor', icon: '🏭', action: () => navigate('/vendors') },
    { id: 'new-asset', label: 'Register device', desc: 'Add a client machine', icon: '🖥️', action: () => navigate('/assets') },
    { id: 'new-deploy', label: 'New deploy target', desc: 'Add a deployment target', icon: '☁️', action: () => navigate('/projects') },
    { id: 'new-credential', label: 'Store credential', desc: 'Add a masked credential', icon: '🔐', action: () => navigate('/projects') },
    { id: 'mark-paid', label: 'Mark invoice paid', desc: 'Open mark-paid with cascade preview', icon: '✅', action: () => navigate('/money/invoices') },
    { id: 'send-reminder', label: 'Send invoice reminder', desc: 'Queue a reminder email', icon: '🔔', action: () => navigate('/money/invoices') },
    { id: 'release-payout', label: 'Release payout', desc: 'Release a payable payout', icon: '🚀', action: () => navigate('/money/payouts') },
    { id: 'paste-reply', label: 'Paste inbound reply', desc: 'Log a reply and cancel nudges', icon: '📋', action: () => navigate('/comms/outbox') },
    { id: 'new-team', label: 'Add team member', desc: 'Add a flat-fee team member', icon: '👤', action: () => navigate('/people') },
    { id: 'new-investor', label: 'Add investor', desc: 'Add an investor', icon: '💰', action: () => navigate('/people') },
    { id: 'new-round', label: 'Open funding round', desc: 'Start a funding round', icon: '🏦', action: () => navigate('/people') },
  ]

  // Searchable entities
  const searchableLeads: { type: 'lead'; item: Lead; label: string; desc: string }[] = s.leads
    .filter((l) => l.status !== 'archived')
    .map((l) => ({ type: 'lead' as const, item: l, label: l.businessName, desc: `${l.contactName} · ${l.industry} · ${l.city}` }))
  const searchableClients: { type: 'client'; item: Client; label: string; desc: string }[] = s.clients
    .map((c) => ({ type: 'client' as const, item: c, label: c.name, desc: `${c.contactName} · ${c.industry} · ${c.city}` }))
  const searchableProjects: { type: 'project'; item: Project; label: string; desc: string }[] = s.projects
    .filter((p) => p.status !== 'delivered')
    .map((p) => ({ type: 'project' as const, item: p, label: p.name, desc: `${p.clientName} · ${p.status} · ${money(p.stake)}` }))
  const searchableInvoices: { type: 'invoice'; item: Invoice; label: string; desc: string }[] = s.invoices
    .filter((i) => i.status !== 'paid' && i.status !== 'void')
    .map((i) => ({ type: 'invoice' as const, item: i, label: i.no, desc: `${i.clientName} · ${money(i.total)} · ${i.status}` }))
  const searchablePOs: { type: 'po'; item: any; label: string; desc: string }[] = s.purchaseOrders
    .filter((p) => p.status !== 'invoiced')
    .map((p) => ({ type: 'po' as const, item: p, label: p.no, desc: `${p.project} · ${p.vendor} · ${money(p.total)} · ${p.status}` }))
  const searchablePayouts: { type: 'payout'; item: Payout; label: string; desc: string }[] = s.payouts
    .filter((p) => p.status === 'payable' || p.status === 'blocked')
    .map((p) => ({ type: 'payout' as const, item: p, label: `${p.payee} · ${money(p.amount)}`, desc: `${p.kind} · ${p.status} · ${p.note ?? ''}` }))
  const searchableVendors: { type: 'vendor'; item: Vendor; label: string; desc: string }[] = s.vendors
    .filter((v) => v.status === 'active')
    .map((v) => ({ type: 'vendor' as const, item: v, label: v.name, desc: `${v.category} · ${v.contactName} · ${v.terms}` }))
  const searchableTeam: { type: 'team'; item: TeamMember; label: string; desc: string }[] = s.team
    .filter((t) => t.status === 'active')
    .map((t) => ({ type: 'team' as const, item: t, label: t.name, desc: `pending ${money(t.pending)} · paid YTD ${money(t.paidYtd)}` }))
  const searchableInvestors: { type: 'investor'; item: Investor; label: string; desc: string }[] = s.investors
    .map((i) => ({ type: 'investor' as const, item: i, label: i.name, desc: `deployed ${money(i.deployed)} · returned ${money(i.returned)}` }))

  // Fuzzy match helper
  const score = (text: string, q: string): number => {
    if (!q) return 1
    const t = text.toLowerCase()
    const ql = q.toLowerCase()
    if (t === ql) return 100
    if (t.startsWith(ql)) return 90
    if (t.includes(ql)) return 80
    // subsequence match
    let ti = 0, qi = 0
    while (ti < t.length && qi < ql.length) {
      if (t[ti] === ql[qi]) qi++
      ti++
    }
    return qi === ql.length ? 70 : 0
  }

  // Build filtered results
  const results = (() => {
    const q = query.trim()
    if (!q) {
      return actions.slice(0, 8).map((a) => ({ ...a, score: 100, kind: 'action' as const }))
    }
    const scored: { score: number; kind: 'action' | 'entity'; item: any }[] = []

    actions.forEach((a) => {
      const s = score(a.label, q) + score(a.desc, q)
      if (s > 0) scored.push({ score: s, kind: 'action', item: a })
    })

    const entityLists = [
      searchableLeads, searchableClients, searchableProjects,
      searchableInvoices, searchablePOs, searchablePayouts,
      searchableVendors, searchableTeam, searchableInvestors,
    ]

    entityLists.forEach((list) => {
      list.forEach((e) => {
        const s = score(e.label, q) + score(e.desc, q)
        if (s > 0) scored.push({ score: s, kind: 'entity', item: e })
      })
    })

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((r) => ({ ...r.item, score: r.score, kind: r.kind }))
  })()

  // Keyboard handling
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const selected = results[selectedIndex]
      if (selected) {
        if (selected.kind === 'action') {
          selected.action()
        } else if (selected.type === 'lead') {
          navigate(`/sales/leads/${selected.item.id}`)
        } else if (selected.type === 'client') {
          navigate(`/clients/${selected.item.id}`)
        } else if (selected.type === 'project') {
          navigate(`/projects/${selected.item.id}`)
        } else if (selected.type === 'invoice') {
          navigate('/money/invoices')
        } else if (selected.type === 'po') {
          navigate('/projects')
        } else if (selected.type === 'payout') {
          navigate('/money/payouts')
        } else if (selected.type === 'vendor') {
          navigate('/vendors')
        } else if (selected.type === 'team') {
          navigate('/people')
        } else if (selected.type === 'investor') {
          navigate(`/people/investors/${selected.item.id}`)
        }
        onClose()
      }
      return
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <kbd className="px-2 py-0.5 text-xs font-mono bg-gray-100 rounded ring-1 ring-gray-200">⌘</kbd>
          <kbd className="px-2 py-0.5 text-xs font-mono bg-gray-100 rounded ring-1 ring-gray-200">K</kbd>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent text-lg font-medium text-gray-900 placeholder-gray-400 outline-none"
            autoFocus
          />
          <kbd className="px-2 py-0.5 text-xs font-mono bg-gray-100 rounded ring-1 ring-gray-200 text-gray-500">Esc</kbd>
        </div>

        <div className="max-h-96 overflow-auto">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400">
              No matches for "{query}"
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {results.map((r, i) => (
                <li
                  key={`${r.kind}-${r.type ?? r.id}`}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition ${
                    i === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    if (r.kind === 'action') r.action()
                    else if (r.type === 'lead') navigate(`/sales/leads/${r.item.id}`)
                    else if (r.type === 'client') navigate(`/clients/${r.item.id}`)
                    else if (r.type === 'project') navigate(`/projects/${r.item.id}`)
                    else if (r.type === 'invoice') navigate('/money/invoices')
                    else if (r.type === 'po') navigate('/projects')
                    else if (r.type === 'payout') navigate('/money/payouts')
                    else if (r.type === 'vendor') navigate('/vendors')
                    else if (r.type === 'team') navigate('/people')
                    else if (r.type === 'investor') navigate(`/people/investors/${r.item.id}`)
                    onClose()
                  }}
                >
                  <span className="text-xl">{r.icon ?? (r.kind === 'action' ? '⚡' : '🔍')}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">{r.label}</div>
                    <div className="text-xs text-gray-500 truncate">{r.desc}</div>
                  </div>
                  {r.score !== undefined && (
                    <span className="text-[10px] text-gray-400 font-mono">{r.score}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
          ↑↓ navigate · Enter select · Esc close
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to open palette with ⌘K (Mac) or Ctrl+K (Windows/Linux)
 */
export function useCommandPalette(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpen()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpen])
}