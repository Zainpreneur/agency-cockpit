import { PageHeader, SectionCard, Stat } from '../components/Layout'
import { StatusChip, Chip } from '../components/StatusChip'
import { useAppState } from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'

export function Projects() {
  const s = useAppState()

  const activeProjects = [
    { name: 'Alnoor POS deployment', client: 'Alnoor Hotel', phase: 'procurement → deployment', funded: 'investor advance', stake: 10000 },
    { name: 'Aqua Pets booking site', client: 'Aqua Pets', phase: 'proposal sent — awaiting decision', funded: 'own cash', stake: 3000 },
    { name: 'Gulf Spa booking site', client: 'Gulf Spa', phase: 'delivered — final invoice drafted', funded: 'own cash', stake: 2700 },
  ]

  return (
    <>
      <PageHeader title="Projects & infra" subtitle="Delivery, purchase orders, deployments, credentials and devices" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Active projects" value={String(activeProjects.length)} />
        <Stat label="Open POs" value={String(s.purchaseOrders.filter((p) => p.status !== 'invoiced').length)} />
        <Stat label="Deploy targets" value={`${s.deployTargets.filter((d) => d.status === 'healthy').length}/${s.deployTargets.length} healthy`} tone={s.deployTargets.some((d) => d.status === 'degraded') ? 'red' : 'green'} />
        <Stat label="Credentials expiring ≤30d" value={String(s.credentials.filter((c) => c.expiresAt && daysBetween(c.expiresAt) > -30).length)} tone="amber" />
      </div>

      <div className="space-y-4">
        <SectionCard title="Active projects">
          {activeProjects.map((p) => (
            <div key={p.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-500">{p.client} · {p.phase}</div>
              </div>
              <Chip tone={p.funded === 'investor advance' ? 'blue' : 'gray'}>{p.funded}</Chip>
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

        <div className="grid lg:grid-cols-2 gap-4">
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

          <SectionCard title="Client devices" hint="photo-first gallery — gallery view comes in v2">
            <div className="grid grid-cols-2 gap-3 p-3">
              {s.devices.map((dev) => (
                <div key={dev.id} className="rounded-xl border border-gray-100 overflow-hidden">
                  <div
                    className="h-20 flex items-center justify-center text-2xl"
                    style={{ background: `linear-gradient(135deg, hsl(${dev.imageHue} 65% 90%), hsl(${(dev.imageHue + 30) % 360} 65% 80%))` }}
                    title={dev.kind}
                  >
                    📷
                  </div>
                  <div className="px-2.5 py-2">
                    <div className="text-xs font-semibold text-gray-900 truncate">{dev.kind}</div>
                    <div className="text-[11px] text-gray-500 truncate">{dev.clientName}</div>
                    <div className="text-[11px] text-gray-400 font-mono">{dev.serial}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  )
}
