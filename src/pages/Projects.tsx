import { Link } from 'react-router-dom'
import { PageHeader, SectionCard, Stat } from '../components/Layout'
import { StatusChip, Chip } from '../components/StatusChip'
import { useAppState } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'

export function Projects() {
  const s = useAppState()

  const activeProjects = s.projects.filter((p) => p.status !== 'delivered')

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Delivery, purchase orders, deployments, credentials — machines live under Assets"
        action={
          <Link to="/assets" className="rounded-lg border border-gray-300 text-sm font-medium px-4 py-2 hover:bg-gray-50">
            Assets →
          </Link>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Active projects" value={String(activeProjects.length)} />
        <Stat label="Open POs" value={String(s.purchaseOrders.filter((p) => p.status !== 'invoiced').length)} />
        <Stat label="Deploy targets" value={`${s.deployTargets.filter((d) => d.status === 'healthy').length}/${s.deployTargets.length} healthy`} tone={s.deployTargets.some((d) => d.status === 'degraded') ? 'red' : 'green'} />
        <Stat label="Credentials expiring ≤30d" value={String(s.credentials.filter((c) => c.expiresAt && daysBetween(c.expiresAt) > -30 && daysBetween(c.expiresAt) < 0).length)} tone="amber" />
      </div>

      <div className="space-y-4">
        <SectionCard title="Projects" hint="delivered ones stay for the client 360s">
          {s.projects.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-500">{p.clientName} · {p.phase}</div>
              </div>
              <Chip tone={p.fundedBy === 'investor_advance' ? 'blue' : 'gray'}>
                {p.fundedBy === 'investor_advance' ? 'investor advance' : 'own cash'}
              </Chip>
              <span className="text-sm font-semibold tabular-nums">{money(p.stake)}</span>
            </div>
          ))}
        </SectionCard>

        <SectionCard title="Purchase orders" hint="investor-advance POs carry the deposit gate (doc 20)">
          {s.purchaseOrders.map((po) => {
            const stuck = po.status === 'ordered' && po.orderedAt && daysBetween(po.orderedAt) >= 5
            return (
              <div key={po.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{po.no}</span>
                  <span className="text-sm text-gray-600">{po.project} · {po.vendor}</span>
                  <StatusChip status={po.status} domain={undefined} />
                  {po.fundedBy === 'investor_advance' && <Chip tone="blue">investor advance</Chip>}
                  {stuck && <Chip tone="amber">waiting {daysBetween(po.orderedAt!)}d</Chip>}
                  <span className="ml-auto text-sm font-semibold tabular-nums">{money(po.total)}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {po.items.map((i) => `${i.qty}× ${i.description}`).join(' · ')}
                  {po.assignee && <> · assigned to {po.assignee}</>}
                </div>
              </div>
            )
          })}
        </SectionCard>

        <SectionCard title="Deployment targets" hint="office VPS runs the pull-agent — W15 rollback is one click in v2">
          {s.deployTargets.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900 font-mono">{t.name}</div>
                <div className="text-xs text-gray-500">{t.clientName} · {t.provider.replace('_', ' ')} · {t.env} · {t.version}</div>
              </div>
              {t.behindBy > 0 && <Chip tone="amber" title="Commits behind the deployed tag">{t.behindBy} behind</Chip>}
              <StatusChip status={t.status} />
              <span className="text-xs text-gray-400">{t.lastDeployAt ? `deployed ${dateShort(t.lastDeployAt)}` : 'never'}</span>
            </div>
          ))}
        </SectionCard>

        <SectionCard title="Credentials" hint="vault-backed — only masked values ever render">
          {s.credentials.map((c) => {
            const expiring = c.expiresAt && daysBetween(c.expiresAt) > -30 && daysBetween(c.expiresAt) < 0
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">{c.provider}</div>
                  <div className="text-xs text-gray-500 font-mono">{c.masked} · {c.kind.replace('_', ' ')}</div>
                </div>
                {expiring && <Chip tone="amber">expires {dateShort(c.expiresAt)}</Chip>}
                {c.expiresAt && !expiring && daysBetween(c.expiresAt) >= 0 && <Chip tone="gray">expires {dateShort(c.expiresAt)}</Chip>}
                <span className="text-xs text-gray-400 max-w-36 truncate" title={c.note}>{c.note}</span>
              </div>
            )
          })}
        </SectionCard>
      </div>
    </>
  )
}
