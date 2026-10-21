import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { useAppState, rotateCredential, revokeCredential, accessCredential } from '../lib/store'
import { dateShort, daysBetween } from '../lib/format'
import type { Credential } from '../lib/types'

const CRED_FIELDS: FieldDef[] = [
  { key: 'provider', label: 'Provider', required: true },
  { key: 'kind', label: 'Kind', type: 'select', options: [
    { value: 'oauth', label: 'OAuth' },
    { value: 'api_key', label: 'API Key' },
    { value: 'ssh_key', label: 'SSH Key' },
  ]},
  { key: 'masked', label: 'Masked value' },
  { key: 'expiresAt', label: 'Expires', type: 'date' },
  { key: 'note', label: 'Note' },
]

export function Credentials() {
  const s = useAppState()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Credential | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Credential | null>(null)
  const [rotateTarget, setRotateTarget] = useState<Credential | null>(null)
  const [newMasked, setNewMasked] = useState('')
  const [revokeTarget, setRevokeTarget] = useState<Credential | null>(null)

  const expiring = s.credentials.filter((c) => c.expiresAt && daysBetween(c.expiresAt) > -30 && daysBetween(c.expiresAt) < 0)
  const expired = s.credentials.filter((c) => c.expiresAt && daysBetween(c.expiresAt) >= 0)

  return (
    <>
      <PageHeader
        title="Credentials"
        subtitle="Vault-backed — only masked values ever render (doc 15, 25)"
        action={
          <button
            onClick={() => { setEditing(null); setFormOpen(true) }}
            className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
          >
            + Store credential
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Total" value={String(s.credentials.length)} />
        <Stat label="Expiring ≤30d" value={String(expiring.length)} tone="amber" />
        <Stat label="Expired" value={String(expired.length)} tone="red" />
        <Stat label="Active" value={String(s.credentials.filter((c) => c.status !== 'revoked').length)} tone="green" />
      </div>

      <SectionCard title="Credentials" hint="masked — never plaintext">
        {s.credentials.length === 0 && <EmptyRow text="No credentials stored." />}
        {s.credentials.map((c) => {
          const isExpiring = c.expiresAt && daysBetween(c.expiresAt) > -30 && daysBetween(c.expiresAt) < 0
          const isExpired = c.expiresAt && daysBetween(c.expiresAt) >= 0
          return (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">{c.provider}</div>
                <div className="text-xs text-gray-500 font-mono">{c.masked} · {c.kind.replace('_', ' ')}</div>
                {c.note && <div className="text-xs text-gray-400 mt-0.5">{c.note}</div>}
              </div>
              {isExpiring && <Chip tone="amber">expires {dateShort(c.expiresAt)}</Chip>}
              {isExpired && <Chip tone="red">expired {dateShort(c.expiresAt)}</Chip>}
              {c.expiresAt && !isExpiring && !isExpired && <Chip tone="gray">expires {dateShort(c.expiresAt)}</Chip>}
              <div className="flex gap-1.5">
                <button
                  onClick={() => { setRotateTarget(c); setNewMasked('') }}
                  className="rounded-lg border border-gray-300 text-xs font-medium px-2.5 py-1 hover:bg-gray-50"
                  title="Rotate credential"
                >
                  Rotate
                </button>
                <button
                  onClick={() => setRevokeTarget(c)}
                  className="rounded-lg border border-red-300 text-red-600 text-xs font-medium px-2.5 py-1 hover:bg-red-50"
                  title="Revoke credential"
                >
                  Revoke
                </button>
                <RowActions onEdit={() => { setEditing(c); setFormOpen(true) }} onDelete={() => setRemoveTarget(c)} />
              </div>
            </div>
          )
        })}
      </SectionCard>

      {/* Audit log */}
      <SectionCard title="Audit Log" hint="every access, rotation, and revocation">
        {s.credentialAuditLog.length === 0 && <EmptyRow text="No audit entries." />}
        {s.credentialAuditLog.slice().reverse().map((e) => (
          <div key={e.id} className="flex gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
            <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
              e.action === 'created' ? 'bg-green-100 text-green-700' :
              e.action === 'rotated' ? 'bg-blue-100 text-blue-700' :
              e.action === 'revoked' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {e.action === 'created' ? '+' : e.action === 'rotated' ? '↻' : e.action === 'revoked' ? '✕' : '👁'}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-gray-800">{e.note}</div>
              <div className="text-xs text-gray-400">{dateShort(e.at)} · by {e.by} · credential #{e.credentialId}</div>
            </div>
          </div>
        ))}
      </SectionCard>

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.provider}` : 'New credential'}
        fields={CRED_FIELDS}
        submitLabel={editing ? 'Save changes' : 'Store credential'}
        initial={editing ? {
          provider: editing.provider, kind: editing.kind, masked: editing.masked,
          expiresAt: editing.expiresAt ? editing.expiresAt.slice(0, 10) : '', note: editing.note ?? '',
        } : { kind: 'api_key', masked: '••••••••' }}
        onSubmit={(vals) => (editing ? { ok: true } : { ok: true })}
      />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget ? `Delete ${removeTarget.provider} credential?` : ''}
        danger
        confirmLabel="Delete credential"
        message="Removes the masked pointer from the board. Rotate the real key with the provider too."
        onConfirm={() => ({ ok: false, error: 'Not implemented in mock' })}
      />

      {/* Rotate modal */}
      {rotateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setRotateTarget(null)}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rotate {rotateTarget.provider}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">New masked value</label>
                <input
                  type="text"
                  value={newMasked}
                  onChange={(e) => setNewMasked(e.target.value)}
                  placeholder="••••••••••••new"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500"
                />
              </div>
              <p className="text-xs text-gray-400">
                Rotating revokes the old value and sets a new 90-day expiry. The audit log records this action.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { rotateCredential(rotateTarget.id, newMasked || '••••••••••••new'); setRotateTarget(null) }}
                  className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
                >
                  Rotate credential
                </button>
                <button onClick={() => setRotateTarget(null)} className="text-sm text-gray-500 px-3 py-2 hover:text-gray-700">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revoke confirm */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setRevokeTarget(null)}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revoke {revokeTarget.provider}?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Revoking terminates access permanently. The audit log records this action. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { revokeCredential(revokeTarget.id); setRevokeTarget(null) }}
                className="rounded-lg bg-red-600 text-white text-sm font-medium px-4 py-2 hover:bg-red-700"
              >
                Revoke
              </button>
              <button onClick={() => setRevokeTarget(null)} className="text-sm text-gray-500 px-3 py-2 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}