import { useState, useEffect } from 'react'
import { PageHeader, SectionCard } from '../components/Layout'
import { Chip } from '../components/StatusChip'

export function Settings() {
  const [ownerName, setOwnerName] = useState('Zain')
  const [ownerEmail, setOwnerEmail] = useState('zain@zainpreneur.com')
  const [signature, setSignature] = useState('Zain\nZainpreneur')
  const [followUpDays, setFollowUpDays] = useState(3)
  const [invoiceDueDays, setInvoiceDueDays] = useState(14)
  const [depositPct, setDepositPct] = useState(50)
  const [gate, setGate] = useState(true)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark'
    }
    return false
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  const save = () => {
    // becomes PUT /settings when the backend lands (app_settings table, schema v8)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500'
  const label = 'text-xs font-medium text-gray-600'

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Cadence numbers feed the cron queue; gates feed the guard registry"
        action={
          <button onClick={save} className="rounded-lg bg-gray-900 text-white text-sm font-medium px-4 py-2 hover:bg-gray-800">
            {saved ? '✓ Saved' : 'Save'}
          </button>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <SectionCard title="Your details">
          <div className="p-4 space-y-3">
            <div>
              <label className={label}>Name (used in signatures)</label>
              <input className={`${input} mt-1`} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </div>
            <div>
              <label className={label}>Email</label>
              <input className={`${input} mt-1`} value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
            </div>
            <div>
              <label className={label}>Signature (variables allowed: {'{name} {business}'})</label>
              <textarea className={`${input} mt-1`} rows={3} value={signature} onChange={(e) => setSignature(e.target.value)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Cadence" hint="each number is a queue, not a hope">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className={label}>Lead follow-up after</div>
                <div className="text-xs text-gray-400">days of silence before reminder 1</div>
              </div>
              <input type="number" min={1} className={`${input} w-24 text-right tabular-nums`} value={followUpDays} onChange={(e) => setFollowUpDays(Number(e.target.value))} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className={label}>Invoice due in</div>
                <div className="text-xs text-gray-400">days (default on new invoices)</div>
              </div>
              <input type="number" min={1} className={`${input} w-24 text-right tabular-nums`} value={invoiceDueDays} onChange={(e) => setInvoiceDueDays(Number(e.target.value))} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className={label}>Deposit before procurement</div>
                <div className="text-xs text-gray-400">% — gate #1 (doc 20)</div>
              </div>
              <input type="number" min={0} max={100} className={`${input} w-24 text-right tabular-nums`} value={depositPct} onChange={(e) => setDepositPct(Number(e.target.value))} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Gates & guards">
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-gray-900">Deposit-before-procure gate</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Blocks investor-advance POs until a client deposit lands; the only way past is a
                  written waiver note (required field, audited).
                </div>
              </div>
              <button
                onClick={() => setGate(!gate)}
                className={`shrink-0 rounded-full w-12 h-6 transition relative ${gate ? 'bg-blue-600' : 'bg-gray-300'}`}
                aria-pressed={gate}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${gate ? 'left-6.5' : 'left-0.5'}`} />
              </button>
            </div>
            <div className="pt-3 border-t border-gray-50 flex flex-wrap gap-1.5">
              <Chip tone="gray">blocked→payable unlock</Chip>
              <Chip tone="gray">reply-cancels-pending</Chip>
              <Chip tone="gray">price snapshots on send</Chip>
              <Chip tone="gray">margin sanity warn</Chip>
              <Chip tone="gray">concentration cap</Chip>
            </div>
            <p className="text-xs text-gray-400">Guards outrank gestures everywhere — boards included.</p>
          </div>
        </SectionCard>

        <SectionCard title="Appearance">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-gray-900">Dark mode</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Toggle between light and dark themes. Preference saved locally.
                </div>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`shrink-0 rounded-full w-12 h-6 transition relative ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}
                aria-pressed={darkMode}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${darkMode ? 'left-6.5' : 'left-0.5'}`} />
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Email sending (v1)" hint="doc 22 — email only for v1">
          <div className="p-4 space-y-2.5 text-sm text-gray-600 leading-relaxed">
            <p>
              Every generated message lands in the <strong>Outbox</strong> as <em>ready</em>. You copy
              it, send from your own mail app, and mark it sent — or use <strong>Open mail app</strong>{' '}
              which prefills your mail client and records the send.
            </p>
            <p className="text-xs text-gray-400">
              WhatsApp and provider send APIs are explicitly deferred; the template library and
              sequence chains already model them so nothing structural changes later.
            </p>
          </div>
        </SectionCard>
      </div>
    </>
  )
}
