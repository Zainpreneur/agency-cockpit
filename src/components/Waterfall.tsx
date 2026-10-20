import { money } from '../lib/format'

/**
 * Waterfall — tier bars for investor deals (docs 19–21).
 * Shows the capital stack visually: each tier's return threshold, what's paid, what remains.
 */
export function Waterfall({
  tiers,
  totalDeployed,
  totalReturned,
}: {
  /** Each tier: label, threshold (multiple or fixed amount), color, description */
  tiers: {
    label: string
    threshold: number
    type: 'multiple' | 'fixed' | 'revenue_share'
    color: string
    description?: string
  }[]
  totalDeployed: number
  totalReturned: number
}) {
  const remaining = totalDeployed - totalReturned
  const returnedPct = totalDeployed ? Math.round((totalReturned / totalDeployed) * 100) : 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Waterfall</h3>
          <span className="text-xs text-gray-500">
            {money(totalReturned)} / {money(totalDeployed)} returned ({returnedPct}%)
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {tiers.map((tier, i) => {
          const isFinal = i === tiers.length - 1
          const thresholdAmount =
            tier.type === 'multiple'
              ? tier.threshold * totalDeployed
              : tier.type === 'fixed'
                ? tier.threshold
                : totalDeployed // revenue share = residual
          const paidInTier = Math.min(Math.max(totalReturned - (i > 0 ? tiers.slice(0, i).reduce((a, t) => {
            const ta = t.type === 'multiple' ? t.threshold * totalDeployed : t.type === 'fixed' ? t.threshold : totalDeployed
            return a + ta
          }, 0) : 0), 0), thresholdAmount)
          const tierPct = thresholdAmount ? Math.round((paidInTier / thresholdAmount) * 100) : 100

          return (
            <div key={tier.label} className="px-4 py-3">
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: tier.color }}
                  />
                  <span className="text-sm font-medium text-gray-900">{tier.label}</span>
                  {tier.description && <span className="text-xs text-gray-400">({tier.description})</span>}
                </div>
                <span className="text-xs text-gray-500">
                  {money(paidInTier)} / {money(thresholdAmount)} ({tierPct}%)
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, tierPct)}%`,
                    backgroundColor: tier.color,
                  }}
                />
              </div>
              {isFinal && remaining > 0 && (
                <div className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  {money(remaining)} remaining to clear all tiers
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>Capital deployed: {money(totalDeployed)}</span>
          <span className="font-medium">Paid back: {money(totalReturned)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span>Current position: {money(remaining)}</span>
          <span>IRR proxy: {returnedPct}% of capital returned</span>
        </div>
      </div>
    </div>
  )
}