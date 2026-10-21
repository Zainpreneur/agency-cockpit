import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { useAppState } from '../lib/store'
import { dateShort, daysBetween } from '../lib/format'

type ConnectorStatus = 'requested' | 'provisioned' | 'connected' | 'broken'

type Connector = {
  id: number
  clientName: string
  provider: string
  status: ConnectorStatus
  provisionedAt?: string
  connectedAt?: string
  brokenAt?: string
  brokenReason?: string
  healthcheckAt?: string
}

const MOCK_CONNECTORS: Connector[] = [
  { id: 1, clientName: 'Alnoor Hotel', provider: 'Google Business', status: 'connected', provisionedAt: new Date(Date.now() - 80 * 86400000).toISOString(), connectedAt: new Date(Date.now() - 75 * 86400000).toISOString(), healthcheckAt: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: 2, clientName: 'Gulf Spa', provider: 'Vercel', status: 'connected', provisionedAt: new Date(Date.now() - 60 * 86400000).toISOString(), connectedAt: new Date(Date.now() - 55 * 86400000).toISOString(), healthcheckAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 3, clientName: 'Desert Carwash', provider: 'Tap Payments', status: 'broken', provisionedAt: new Date(Date.now() - 40 * 86400000).toISOString(), connectedAt: new Date(Date.now() - 35 * 86400000).toISOString(), brokenAt: new Date(Date.now() - 3 * 86400000).toISOString(), brokenReason: 'Token expired — OAuth refresh failed' },
  { id: 4, clientName: 'Ocean Treats', provider: 'Google Business', status: 'provisioned', provisionedAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 5, clientName: 'Aqua Pets', provider: 'Vercel', status: 'requested' },
]

const STATUS_TONE: Record<ConnectorStatus, 'gray' | 'blue' | 'green' | 'red'> = {
  requested: 'gray', provisioned: 'blue', connected: 'green', broken: 'red',
}

const CONNECTOR_FIELDS: FieldDef[] = [
  { key: 'clientName', label: 'Client', required: true },
  { key: 'provider', label: 'Provider', required: true, placeholder: 'Google Business · Vercel · Tap Payments' },
]

export function Connectors() {
  const s = useAppState()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Connector | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Connector | null>(null)

  return (
    <>
      <PageHeader
        title="Connectors"
        subtitle="Client-owned integrations: requested → provisioned → connected → broken (doc 15)"
        action={
          <button
            onClick={() => { setEditing(null); setFormOpen(true) }}
            className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
          >
            + New connector
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total" value={String(MOCK_CONNECTORS.length)} />
        <Stat label="Connected" value={String(MOCK_CONNECTORS.filter((c) => c.status === 'connected').length)} tone="green" />
        <Stat label="Broken" value={String(MOCK_CONNECTORS.filter((c) => c.status === 'broken').length)} tone="red" />
        <Stat label="Pending" value={String(MOCK_CONNECTORS.filter((c) => c.status === 'requested' || c.status === 'provisioned').length)} tone="amber" />
      </div>

      <SectionCard title="Connectors" hint="broken auto-creates a ticket">
        {MOCK_CONNECTORS.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-900">{c.provider}</div>
              <div className="text-xs text-gray-500">{c.clientName}</div>
              {c.brokenReason && <div className="text-xs text-red-600 mt-0.5">{c.brokenReason}</div>}
            </div>
            <Chip tone={STATUS_TONE[c.status]}>{c.status}</Chip>
            <div className="text-xs text-gray-400">
              {c.connectedAt ? `connected ${dateShort(c.connectedAt)}` : c.provisionedAt ? `provisioned ${dateShort(c.provisionedAt)}` : 'not provisioned'}
            </div>
            <div className="flex gap-1.5">
              {c.status === 'requested' && <button className="rounded-lg bg-blue-600 text-white text-xs font-medium px-2.5 py-1 hover:bg-blue-700">Provision</button>}
              {c.status === 'provisioned' && <button className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-2.5 py-1 hover:bg-emerald-700">Connect</button>}
              {c.status === 'connected' && <button className="rounded-lg bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 hover:bg-gray-200">Healthcheck</button>}
              {c.status === 'broken' && <button className="rounded-lg bg-red-600 text-white text-xs font-medium px-2.5 py-1 hover:bg-red-700">Break → Ticket</button>}
              <RowActions onEdit={() => { setEditing(c); setFormOpen(true) }} onDelete={() => setRemoveTarget(c)} />
            </div>
          </div>
        ))}
      </SectionCard>

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.provider}` : 'New connector'}
        fields={CONNECTOR_FIELDS}
        submitLabel={editing ? 'Save changes' : 'Create connector'}
        initial={editing ? { clientName: editing.clientName, provider: editing.provider } : undefined}
        onSubmit={() => ({ ok: true })}
      />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget ? `Delete ${removeTarget.provider}?` : ''}
        danger
        confirmLabel="Delete connector"
        message="Removes the connector. Revoke the underlying credential too."
        onConfirm={() => ({ ok: false, error: 'Not implemented in mock' })}
      />
    </>
  )
}