import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, SectionCard, Stat } from '../components/Layout'
import { StatusChip, Chip } from '../components/StatusChip'
import { FormModal, type FieldDef, type FormValues } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import {
  useAppState,
  createProject, updateProject, deleteProject,
  createPurchaseOrder, updatePurchaseOrder, advancePurchaseOrder, deletePurchaseOrder,
  createDeployTarget, updateDeployTarget, deleteDeployTarget,
  createCredential, updateCredential, deleteCredential,
} from '../lib/store'
import { money, dateShort, daysBetween } from '../lib/format'
import type { Credential, DeployTarget, Project, PurchaseOrder } from '../lib/types'

const PROJECT_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Project name', required: true },
  { key: 'clientName', label: 'Client', required: true },
  { key: 'phase', label: 'Phase', placeholder: 'kicked off · building · installing…' },
  {
    key: 'status', label: 'Status', type: 'select',
    options: [
      { value: 'proposal', label: 'Proposal' },
      { value: 'active', label: 'Active' },
      { value: 'installing', label: 'Installing' },
      { value: 'delivered', label: 'Delivered' },
      { value: 'on_hold', label: 'On hold' },
    ],
  },
  {
    key: 'fundedBy', label: 'Funded by', type: 'select',
    options: [
      { value: 'own_cash', label: 'Own cash' },
      { value: 'investor_advance', label: 'Investor advance' },
    ],
  },
  { key: 'stake', label: 'Stake (SAR)', type: 'number', min: 0 },
]

const PO_FIELDS: FieldDef[] = [
  { key: 'project', label: 'Project', type: 'select', required: true, options: [] },
  { key: 'vendor', label: 'Vendor', type: 'select', required: true, options: [] },
  {
    key: 'fundedBy', label: 'Funded by', type: 'select',
    options: [
      { value: 'own_cash', label: 'Own cash' },
      { value: 'investor_advance', label: 'Investor advance' },
    ],
  },
  { key: 'assignee', label: 'Assignee' },
  { key: 'orderedAt', label: 'Ordered on', type: 'date' },
  {
    key: 'items', label: 'Items', type: 'textarea', rows: 4, required: true,
    hint: 'One per line — 2x POS terminal @ 450', placeholder: '1x Receipt printer @ 320',
  },
]

const DEPLOY_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Target name', required: true, placeholder: 'aqua-pets-site' },
  { key: 'clientName', label: 'Client', required: true },
  {
    key: 'provider', label: 'Provider', type: 'select',
    options: [
      { value: 'vercel', label: 'Vercel' },
      { value: 'vps', label: 'VPS' },
      { value: 'netlify', label: 'Netlify' },
    ],
  },
  {
    key: 'env', label: 'Environment', type: 'select',
    options: [
      { value: 'production', label: 'Production' },
      { value: 'staging', label: 'Staging' },
    ],
  },
  {
    key: 'status', label: 'Health', type: 'select',
    options: [
      { value: 'never_deployed', label: 'Never deployed' },
      { value: 'healthy', label: 'Healthy' },
      { value: 'degraded', label: 'Degraded' },
      { value: 'down', label: 'Down' },
    ],
  },
  { key: 'version', label: 'Version tag' },
  { key: 'behindBy', label: 'Commits behind', type: 'number', min: 0 },
]

const CRED_FIELDS: FieldDef[] = [
  { key: 'provider', label: 'Provider', required: true, placeholder: 'Vercel · Tap Payments…' },
  {
    key: 'kind', label: 'Kind', type: 'select',
    options: [
      { value: 'api_key', label: 'API key' },
      { value: 'oauth', label: 'OAuth' },
      { value: 'ssh_key', label: 'SSH key' },
      { value: 'password', label: 'Password' },
    ],
  },
  { key: 'masked', label: 'Masked value', hint: 'only masked values ever render' },
  { key: 'expiresAt', label: 'Expires', type: 'date' },
  { key: 'note', label: 'Note', placeholder: 'which client / environment' },
]

const ROLE_OPTIONS = [
  { value: 'own_cash', label: 'Own cash' },
  { value: 'investor_advance', label: 'Investor advance' },
]

export function Projects() {
  const s = useAppState()
  const navigate = useNavigate()

  const [projectOpen, setProjectOpen] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [projectRemove, setProjectRemove] = useState<Project | null>(null)

  const [poOpen, setPoOpen] = useState(false)
  const [editPo, setEditPo] = useState<PurchaseOrder | null>(null)
  const [poRemove, setPoRemove] = useState<PurchaseOrder | null>(null)

  const [deployOpen, setDeployOpen] = useState(false)
  const [editDeploy, setEditDeploy] = useState<DeployTarget | null>(null)
  const [deployRemove, setDeployRemove] = useState<DeployTarget | null>(null)

  const [credOpen, setCredOpen] = useState(false)
  const [editCred, setEditCred] = useState<Credential | null>(null)
  const [credRemove, setCredRemove] = useState<Credential | null>(null)

  const activeProjects = s.projects.filter((p) => p.status !== 'delivered')

  const poFields: FieldDef[] = PO_FIELDS.map((f) =>
    f.key === 'project'
      ? { ...f, options: s.projects.map((p) => ({ value: p.name, label: p.name })) }
      : f.key === 'vendor'
        ? { ...f, options: s.vendors.filter((v) => v.status === 'active').map((v) => ({ value: v.name, label: v.name })) }
        : f,
  )

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
        <SectionCard
          title="Projects"
          hint="delivered ones stay for the client 360s"
          action={
            <button
              onClick={() => { setEditProject(null); setProjectOpen(true) }}
              className="rounded-lg bg-blue-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-blue-700"
            >
              + New project
            </button>
          }
        >
          {s.projects.length === 0 && <div className="px-4 py-6 text-sm text-gray-400 text-center">No projects yet.</div>}
          {s.projects.map((p) => (
            <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50/50">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900">{p.name}</div>
                <div className="text-xs text-gray-500">{p.clientName} · {p.phase}</div>
              </div>
              <Chip tone={p.fundedBy === 'investor_advance' ? 'blue' : 'gray'}>
                {p.fundedBy === 'investor_advance' ? 'investor advance' : 'own cash'}
              </Chip>
              <StatusChip status={p.status} />
              <span className="text-sm font-semibold tabular-nums">{money(p.stake)}</span>
              <RowActions
                onEdit={() => { setEditProject(p); setProjectOpen(true) }}
                onDelete={() => setProjectRemove(p)}
              />
            </div>
          ))}
        </SectionCard>

        <SectionCard
          title="Purchase orders"
          hint="investor-advance POs carry the deposit gate (doc 20)"
          action={
            <button
              onClick={() => { setEditPo(null); setPoOpen(true) }}
              className="rounded-lg bg-blue-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-blue-700"
            >
              + New PO
            </button>
          }
        >
          {s.purchaseOrders.length === 0 && <div className="px-4 py-6 text-sm text-gray-400 text-center">No purchase orders yet.</div>}
          {s.purchaseOrders.map((po) => {
            const stuck = po.status === 'ordered' && po.orderedAt && daysBetween(po.orderedAt) >= 5
            const next = ({ draft: 'Order', ordered: 'Mark received', received: 'Mark installed', installed: 'Mark invoiced' } as Record<string, string>)[po.status]
            return (
              <div key={po.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{po.no}</span>
                  <span className="text-sm text-gray-600">{po.project} · {po.vendor}</span>
                  <StatusChip status={po.status} domain={undefined} />
                  {po.fundedBy === 'investor_advance' && <Chip tone="blue">investor advance</Chip>}
                  {stuck && <Chip tone="amber">waiting {daysBetween(po.orderedAt!)}d</Chip>}
                  <span className="ml-auto text-sm font-semibold tabular-nums">{money(po.total)}</span>
                  {next && (
                    <button
                      onClick={() => advancePurchaseOrder(po.id)}
                      className="rounded-lg bg-gray-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-gray-800"
                    >
                      {next} →
                    </button>
                  )}
                  <RowActions
                    onEdit={() => { setEditPo(po); setPoOpen(true) }}
                    onDelete={() => setPoRemove(po)}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {po.items.map((i) => `${i.qty}× ${i.description}`).join(' · ')}
                  {po.assignee && <> · assigned to {po.assignee}</>}
                </div>
              </div>
            )
          })}
        </SectionCard>

        <SectionCard
          title="Deployment targets"
          hint="office VPS runs the pull-agent — W15 rollback is one click in v2"
          action={
            <button
              onClick={() => { setEditDeploy(null); setDeployOpen(true) }}
              className="rounded-lg bg-blue-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-blue-700"
            >
              + New target
            </button>
          }
        >
          {s.deployTargets.length === 0 && <div className="px-4 py-6 text-sm text-gray-400 text-center">No deploy targets yet.</div>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
            {s.deployTargets.map((t) => (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 font-mono truncate">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.clientName} · {t.provider.replace('_', ' ')} · {t.env} · {t.version}</div>
                  </div>
                  <StatusChip status={t.status} />
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  {t.behindBy > 0 && <Chip tone="amber" title="Commits behind the deployed tag">{t.behindBy} behind</Chip>}
                  <span className="text-xs text-gray-400 ml-auto">{t.lastDeployAt ? `deployed ${dateShort(t.lastDeployAt)}` : 'never'}</span>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2">
                  <button
                    onClick={() => { setEditDeploy(t); setDeployOpen(true) }}
                    className="rounded-lg border border-gray-300 text-xs font-medium px-2.5 py-1 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  {t.status === 'healthy' && t.lastDeployAt && (
                    <button
                      className="rounded-lg border border-red-300 text-red-600 text-xs font-medium px-2.5 py-1 hover:bg-red-50"
                      title="Rollback to previous version"
                    >
                      Rollback
                    </button>
                  )}
                  <RowActions
                    onEdit={() => { setEditDeploy(t); setDeployOpen(true) }}
                    onDelete={() => setDeployRemove(t)}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Credentials"
          hint="vault-backed — only masked values ever render"
          action={
            <button
              onClick={() => { setEditCred(null); setCredOpen(true) }}
              className="rounded-lg bg-blue-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-blue-700"
            >
              + New credential
            </button>
          }
        >
          {s.credentials.length === 0 && <div className="px-4 py-6 text-sm text-gray-400 text-center">No credentials stored.</div>}
          {s.credentials.map((c) => {
            const expiring = c.expiresAt && daysBetween(c.expiresAt) > -30 && daysBetween(c.expiresAt) < 0
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900">{c.provider}</div>
                  <div className="text-xs text-gray-500 font-mono">{c.masked} · {c.kind.replace('_', ' ')}</div>
                </div>
                {expiring && <Chip tone="amber">expires {dateShort(c.expiresAt)}</Chip>}
                {c.expiresAt && !expiring && daysBetween(c.expiresAt) >= 0 && <Chip tone="gray">expires {dateShort(c.expiresAt)}</Chip>}
                <span className="text-xs text-gray-400 max-w-36 truncate" title={c.note}>{c.note}</span>
                <RowActions
                  onEdit={() => { setEditCred(c); setCredOpen(true) }}
                  onDelete={() => setCredRemove(c)}
                />
              </div>
            )
          })}
        </SectionCard>
      </div>

      <FormModal
        open={projectOpen}
        onClose={() => setProjectOpen(false)}
        title={editProject ? `Edit ${editProject.name}` : 'New project'}
        fields={PROJECT_FIELDS}
        submitLabel={editProject ? 'Save changes' : 'Create project'}
        initial={editProject ? {
          name: editProject.name, clientName: editProject.clientName, phase: editProject.phase,
          status: editProject.status, fundedBy: editProject.fundedBy, stake: editProject.stake,
        } : { status: 'proposal', fundedBy: 'own_cash', stake: 0 }}
        onSubmit={(vals) => (editProject ? updateProject(editProject.id, vals) : createProject(vals))}
      />
      <ConfirmModal
        open={!!projectRemove}
        onClose={() => setProjectRemove(null)}
        title={projectRemove ? `Delete ${projectRemove.name}?` : ''}
        danger
        confirmLabel="Delete project"
        message="The store blocks deleting a project with POs pointing at it — those costs stay traceable. Move it to delivered instead."
        onConfirm={() => (projectRemove ? deleteProject(projectRemove.id) : { ok: false, error: 'Nothing selected.' })}
      />

      <FormModal
        open={poOpen}
        onClose={() => setPoOpen(false)}
        title={editPo ? `Edit ${editPo.no}` : 'New purchase order'}
        fields={editPo
          ? PO_FIELDS.filter((f) => f.key !== 'items')
          : poFields}
        submitLabel={editPo ? 'Save changes' : 'Create PO'}
        initial={editPo ? {
          project: editPo.project, vendor: editPo.vendor, fundedBy: editPo.fundedBy,
          assignee: editPo.assignee ?? '',
          orderedAt: editPo.orderedAt ? editPo.orderedAt.slice(0, 10) : '',
        } as FormValues : {
          fundedBy: 'own_cash',
          items: '',
        }}
        onSubmit={(vals) => (editPo ? updatePurchaseOrder(editPo.id, vals) : createPurchaseOrder(vals))}
      />
      <ConfirmModal
        open={!!poRemove}
        onClose={() => setPoRemove(null)}
        title={poRemove ? `Delete ${poRemove.no}?` : ''}
        danger
        confirmLabel="Delete PO"
        message="Only draft POs can be deleted — ordered money becomes a settled cost, never an erased one."
        onConfirm={() => (poRemove ? deletePurchaseOrder(poRemove.id) : { ok: false, error: 'Nothing selected.' })}
      />

      <FormModal
        open={deployOpen}
        onClose={() => setDeployOpen(false)}
        title={editDeploy ? `Edit ${editDeploy.name}` : 'New deploy target'}
        fields={editDeploy ? DEPLOY_FIELDS.filter((f) => f.key !== 'name' && f.key !== 'clientName') : DEPLOY_FIELDS}
        submitLabel={editDeploy ? 'Save changes' : 'Create target'}
        initial={editDeploy ? {
          provider: editDeploy.provider, env: editDeploy.env, status: editDeploy.status,
          version: editDeploy.version, behindBy: editDeploy.behindBy,
        } : { provider: 'vercel', env: 'production', status: 'never_deployed', behindBy: 0 }}
        onSubmit={(vals) => (editDeploy ? updateDeployTarget(editDeploy.id, vals) : createDeployTarget(vals))}
      />
      <ConfirmModal
        open={!!deployRemove}
        onClose={() => setDeployRemove(null)}
        title={deployRemove ? `Delete ${deployRemove.name}?` : ''}
        danger
        confirmLabel="Delete target"
        message="Removes the deploy target from the board. Actual infrastructure teardown is manual — this is just the tracking row."
        onConfirm={() => (deployRemove ? deleteDeployTarget(deployRemove.id) : { ok: false, error: 'Nothing selected.' })}
      />

      <FormModal
        open={credOpen}
        onClose={() => setCredOpen(false)}
        title={editCred ? `Edit ${editCred.provider}` : 'New credential'}
        fields={CRED_FIELDS}
        submitLabel={editCred ? 'Save changes' : 'Store credential'}
        initial={editCred ? {
          provider: editCred.provider, kind: editCred.kind, masked: editCred.masked,
          expiresAt: editCred.expiresAt ? editCred.expiresAt.slice(0, 10) : '', note: editCred.note ?? '',
        } : { kind: 'api_key', masked: '••••••••' }}
        onSubmit={(vals) => (editCred ? updateCredential(editCred.id, vals) : createCredential(vals))}
      />
      <ConfirmModal
        open={!!credRemove}
        onClose={() => setCredRemove(null)}
        title={credRemove ? `Delete ${credRemove.provider} credential?` : ''}
        danger
        confirmLabel="Delete credential"
        message="Removes the masked pointer from the board. Rotate the real key with the provider too."
        onConfirm={() => (credRemove ? deleteCredential(credRemove.id) : { ok: false, error: 'Nothing selected.' })}
      />
    </>
  )
}
