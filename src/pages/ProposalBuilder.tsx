import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/Layout'
import { Chip } from '../components/StatusChip'
import { useAppState, createProposal } from '../lib/store'
import { money, dateShort } from '../lib/format'

const STEPS = ['For whom', 'Service', 'Configure', 'Adjust', 'Review']

const card = 'bg-white rounded-xl border border-gray-200 shadow-sm p-4'
const pill = (on: boolean) =>
  `rounded-full px-3.5 py-2 text-sm font-medium ring-1 ring-inset transition text-left ${
    on ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-gray-700 ring-gray-300 hover:bg-gray-50'
  }`
const disabledPill =
  'rounded-full px-3.5 py-2 text-sm font-medium ring-1 ring-inset bg-gray-50 text-gray-300 ring-gray-200 cursor-not-allowed'

export function ProposalBuilder() {
  const s = useAppState()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [leadId, setLeadId] = useState<number | null>(null)
  const [templateId, setTemplateId] = useState<number | null>(null)
  const [variantCode, setVariantCode] = useState<string | null>(null)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [discount, setDiscount] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [maintenance, setMaintenance] = useState(false)
  const [touched, setTouched] = useState(false)

  const template = s.catalog.find((t) => t.id === templateId) ?? null
  const lead = s.leads.find((l) => l.id === leadId) ?? null
  const variant = template?.variants.find((v) => v.code === variantCode) ?? null

  // ── derived pricing (live, every keystroke) ──────────────────────────
  const { listPrice, cost, attrExtra, lines } = useMemo(() => {
    if (!template || !variant) return { listPrice: 0, cost: 0, attrExtra: 0, lines: [] as { description: string; qty: number; unitPrice: number }[] }
    let extra = 0
    const ls: { description: string; qty: number; unitPrice: number }[] = [
      { description: `${template.name} — ${variant.name} variant (${variant.deliveryDays} days)`, qty: 1, unitPrice: variant.price },
    ]
    for (const attr of template.attributes) {
      const code = selections[attr.code]
      if (!code) continue
      const val = attr.values.find((v) => v.code === code)
      if (!val || val.priceExtra === 0) continue
      extra += val.priceExtra
      ls.push({ description: `${attr.name}: ${val.name}`, qty: 1, unitPrice: val.priceExtra })
    }
    return { listPrice: variant.price + extra, cost: variant.cost + Math.round(extra * 0.5), attrExtra: extra, lines: ls }
  }, [template, variant, selections])

  const offered = Math.max(0, listPrice - discount)
  const margin = offered - cost
  const discountInvalid = touched && discount > 0 && !discountReason.trim()

  /** Is this attribute value blocked by the current combination? (catalogue exclusion) */
  const exclusionHit = (attrCode: string, valueExcludedWith?: string[]) => {
    if (!valueExcludedWith?.length) return false
    return valueExcludedWith.some((pair) => {
      const [a, v] = pair.split('=')
      return selections[a] === v
    })
  }

  const canAdvance =
    step === 0 ? leadId !== null :
    step === 1 ? templateId !== null :
    step === 2 ? variantCode !== null :
    step === 3 ? !discountInvalid :
    true

  const go = (delta: number) => {
    if (delta > 0) {
      setTouched(true)
      if (!canAdvance) return
    }
    setStep((x) => Math.min(STEPS.length - 1, Math.max(0, x + delta)))
    if (delta > 0) setTouched(false)
  }

  const send = () => {
    setTouched(true)
    if (discountInvalid) {
      setStep(3)
      return
    }
    if (!lead || !variant) return
    const finalLines = [...lines]
    if (maintenance) finalLines.push({ description: 'Maintenance & updates (monthly)', qty: 1, unitPrice: 0 })
    const id = createProposal({
      leadId: lead.id,
      listPrice,
      offeredPrice: offered,
      cost,
      discountReason: discount > 0 ? discountReason.trim() : undefined,
      maintenanceMonthly: maintenance ? Math.max(150, Math.round(offered * 0.03)) : undefined,
      lines: finalLines,
    })
    navigate(id ? '/sales/proposals' : '/sales/proposals')
  }

  const pickAttr = (attrCode: string, valueCode: string) => {
    setSelections((prev) => ({ ...prev, [attrCode]: prev[attrCode] === valueCode ? '' : valueCode }))
  }

  return (
    <>
      <PageHeader
        title="New proposal"
        subtitle="5 steps — configure live, see the price move, snapshot it on send"
        action={
          <button onClick={() => navigate('/sales/proposals')} className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-2 hover:bg-gray-50">
            Cancel
          </button>
        }
      />

      {/* progress */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => i < step && setStep(i)}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              i === step ? 'bg-gray-900 text-white' :
              i < step ? 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50' :
              'bg-gray-100 text-gray-400'
            }`}
          >
            <span className="tabular-nums">{i + 1}</span> {label}
          </button>
        ))}
      </div>

      {/* ── STEP 1: for whom ── */}
      {step === 0 && (
        <div className={card}>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Who is this proposal for?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {s.leads.filter((l) => l.status !== 'lost').map((l) => (
              <button
                key={l.id}
                onClick={() => setLeadId(l.id)}
                className={`text-left rounded-xl p-3 ring-1 ring-inset transition ${
                  leadId === l.id ? 'bg-blue-50 ring-blue-500' : 'bg-white ring-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="text-sm font-semibold text-gray-900">{l.businessName}</div>
                <div className="text-xs text-gray-500">{l.contactName} · {l.city}</div>
              </button>
            ))}
          </div>
          {touched && !leadId && <p className="text-xs text-red-600 mt-2">Pick a client first.</p>}
        </div>
      )}

      {/* ── STEP 2: service ── */}
      {step === 1 && (
        <div className="grid sm:grid-cols-3 gap-3">
          {s.catalog.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTemplateId(t.id); setVariantCode(t.variants[1]?.code ?? t.variants[0].code); setSelections({}) }}
              className={`text-left rounded-xl overflow-hidden ring-1 ring-inset transition ${
                templateId === t.id ? 'ring-blue-500 shadow-md' : 'ring-gray-200 hover:shadow-md'
              }`}
            >
              <div
                className="h-28 flex items-end p-3"
                style={{ background: `linear-gradient(135deg, hsl(${t.hue} 70% 88%), hsl(${(t.hue + 40) % 360} 70% 75%))` }}
              >
                <span className="text-xs font-semibold text-gray-700 bg-white/70 rounded px-1.5 py-0.5">{t.sold} sold</span>
              </div>
              <div className="bg-white p-3 border-t border-gray-100">
                <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                <div className="text-xs text-gray-500">from {money(t.fromPrice)}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── STEP 3: configure — the conditional engine ── */}
      {step === 2 && template && (
        <div className="space-y-4">
          <div className={card}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Variant</h3>
            <div className="flex flex-wrap gap-2">
              {template.variants.map((v) => (
                <button key={v.code} onClick={() => setVariantCode(v.code)} className={pill(variantCode === v.code)}>
                  <span className="font-semibold">{v.name}</span>
                  <span className="ml-2 tabular-nums opacity-80">{money(v.price)}</span>
                  <span className="ml-2 text-xs opacity-60">{v.deliveryDays}d</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Choosing a variant sets the base — attributes below add on top.</p>
          </div>

          {template.attributes.map((attr) => (
            <div key={attr.code} className={card}>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{attr.name}</h3>
              <div className="flex flex-wrap gap-2">
                {attr.values.map((v) => {
                  const blocked = exclusionHit(attr.code, v.excludedWith)
                  const on = selections[attr.code] === v.code
                  if (blocked) {
                    return (
                      <span key={v.code} className={disabledPill} title="Not combinable with your current choices">
                        {v.name} {v.priceExtra ? `+${money(v.priceExtra)}` : ''} ⛔
                      </span>
                    )
                  }
                  return (
                    <button key={v.code} onClick={() => pickAttr(attr.code, v.code)} className={pill(on)}>
                      {v.name}
                      {v.priceExtra > 0 && <span className="ml-2 tabular-nums text-xs opacity-75">+{money(v.priceExtra)}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between bg-gray-900 text-white rounded-xl px-4 py-3">
            <span className="text-sm">Running total</span>
            <span className="text-lg font-semibold tabular-nums">{money(listPrice)}</span>
          </div>
        </div>
      )}

      {/* ── STEP 4: adjust (conditional discount reason, maintenance) ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className={card}>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Discount</h3>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                value={discount || ''}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                placeholder="0"
                className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-sm tabular-nums focus:border-blue-500"
              />
              <span className="text-xs text-gray-500">from {money(listPrice)}</span>
              {discount > 0 && (
                <div className="ml-auto flex gap-1.5">
                  {[100, 500, 1000].map((amt) => (
                    <button key={amt} onClick={() => setDiscount(amt)} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-200">
                      −{amt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* conditional: any discount demands a written reason */}
            {discount > 0 && (
              <div className="mt-3">
                <label className="text-xs font-medium text-gray-600">
                  Why is this discounted? <span className="text-red-500">required</span>
                </label>
                <input
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="e.g. Repeat client — sister business already with us"
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-blue-500 ${
                    discountInvalid ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
                  }`}
                />
                {discountInvalid && <p className="text-xs text-red-600 mt-1">Every discount needs a reason — your future self will want it.</p>}
              </div>
            )}
          </div>

          <div className={card}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Add maintenance & updates</h3>
                <p className="text-xs text-gray-500 mt-0.5">Monthly recurring — becomes Lane C (your own SaaS) if you productize it later.</p>
              </div>
              <button
                onClick={() => setMaintenance(!maintenance)}
                className={`shrink-0 rounded-full w-12 h-6 transition relative ${maintenance ? 'bg-blue-600' : 'bg-gray-300'}`}
                aria-pressed={maintenance}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${maintenance ? 'left-6.5' : 'left-0.5'}`} />
              </button>
            </div>
            {maintenance && (
              <div className="mt-3 rounded-lg bg-blue-50 ring-1 ring-blue-200 px-3 py-2 text-xs text-blue-800 tabular-nums">
                + {money(Math.max(150, Math.round(offered * 0.03)))}/month · shown as a recurring line in review
              </div>
            )}
          </div>

          <div className="flex items-center justify-between bg-gray-900 text-white rounded-xl px-4 py-3">
            <span className="text-sm">Offered price {discount > 0 && <span className="text-gray-400">(list {money(listPrice)})</span>}</span>
            <span className="text-lg font-semibold tabular-nums">{money(offered)}</span>
          </div>
        </div>
      )}

      {/* ── STEP 5: review — snapshot & send ── */}
      {step === 4 && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className={card}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{lead?.businessName}</div>
                  <div className="text-xs text-gray-500">contact: {lead?.contactName} · valid 14 days</div>
                </div>
                <Chip tone="amber">not sent yet</Chip>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td className="py-2 text-gray-700">{l.description}</td>
                      <td className="py-2 text-right tabular-nums text-gray-500">× {l.qty}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{money(l.unitPrice)}</td>
                    </tr>
                  ))}
                  {maintenance && (
                    <tr>
                      <td className="py-2 text-gray-700">Maintenance & updates <span className="text-blue-600">· monthly</span></td>
                      <td className="py-2 text-right text-gray-500">—</td>
                      <td className="py-2 text-right tabular-nums font-medium">{money(Math.max(150, Math.round(offered * 0.03)))}/mo</td>
                    </tr>
                  )}
                  {discount > 0 && (
                    <tr>
                      <td className="py-2 text-gray-700">Discount <span className="text-gray-400">— {discountReason}</span></td>
                      <td />
                      <td className="py-2 text-right tabular-nums text-red-600">−{money(discount)}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-gray-100">
                    <td className="py-2.5 font-semibold text-gray-900" colSpan={2}>Total (snapshot)</td>
                    <td className="py-2.5 text-right font-bold tabular-nums">{money(offered)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={`${card} border-dashed`}>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Email that goes out (template: proposal_send)</div>
              <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
{`Hi ${lead?.contactName ?? ''},

Your proposal is ready — ${money(offered)} for ${template?.name ?? 'the project'}. Valid for 14 days.

Happy to walk you through it.
Zain`}
              </p>
              <p className="text-xs text-gray-400 mt-2">Sent via Copy + Send (email-only v1) — the row lands in the outbox.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className={card}>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Owner eyes only</div>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">List price</dt><dd className="tabular-nums">{money(listPrice)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Offered</dt><dd className="tabular-nums font-semibold">{money(offered)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Est. cost</dt><dd className="tabular-nums">{money(cost)}</dd></div>
                <div className="flex justify-between border-t border-gray-100 pt-1.5">
                  <dt className="font-semibold">Margin</dt>
                  <dd className={`tabular-nums font-bold ${margin >= offered * 0.3 ? 'text-emerald-600' : margin > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                    {money(margin)} · {Math.round((margin / Math.max(offered, 1)) * 100)}%
                  </dd>
                </div>
              </dl>
              {offered < cost && (
                <p className="text-xs text-red-600 mt-2">⚠ Under cost — margin gate would warn before send.</p>
              )}
            </div>

            <button
              onClick={send}
              className="w-full rounded-xl bg-blue-600 text-white text-sm font-semibold px-4 py-3 hover:bg-blue-700"
            >
              Snapshot & send →
            </button>
            <p className="text-xs text-gray-400 text-center">Writes proposal + frozen lines + outbox row + event in one transaction.</p>
          </div>
        </div>
      )}

      {/* nav */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => go(-1)}
          disabled={step === 0}
          className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-2 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Back
        </button>
        {step < STEPS.length - 1 && (
          <button
            onClick={() => go(1)}
            className="rounded-lg bg-gray-900 text-white text-sm font-medium px-5 py-2 hover:bg-gray-800"
          >
            Continue →
          </button>
        )}
      </div>
      {step === 4 && (
        <div className="text-xs text-gray-400 mt-2 tabular-nums">
          valid until {dateShort(new Date(Date.now() + 14 * 86_400_000).toISOString())}
        </div>
      )}
    </>
  )
}
