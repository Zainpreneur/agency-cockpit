import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/Layout'
import { Chip } from '../components/StatusChip'
import { ViewSwitcher, useViewMode, type ViewMode } from '../components/ViewSwitcher'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { useAppState, createClient, updateClient, archiveClient } from '../lib/store'
import { dateShort } from '../lib/format'
import type { Client } from '../lib/types'

const STATUS_TONE = { active: 'green', delivered: 'blue', archived: 'gray' } as const

const CLIENT_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Client name', required: true },
  { key: 'contactName', label: 'Contact person', required: true },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'city', label: 'City' },
  { key: 'industry', label: 'Industry' },
  { key: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
]

export function Clients() {
  const s = useAppState()
  const navigate = useNavigate()
  const [mode, setMode] = useViewMode('clients', ['table', 'cards'] as ViewMode[], 'table')
  const [editing, setEditing] = useState<Client | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Client | null>(null)

  const statsFor = (c: Client) => {
    const openInvoices = s.invoices.filter((i) => i.clientName === c.name && i.status !== 'paid' && i.status !== 'void')
    const overdue = openInvoices.filter((i) => i.status === 'overdue')
    const projects = s.projects.filter((p) => p.clientName === c.name)
    return { openInvoices, overdue, projects }
  }

  const open = (c: Client) => navigate(`/clients/${c.id}`)

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Lands here when you close a lead Won — intake questionnaire queues automatically"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-400 tabular-nums">{s.clients.length} clients</span>
            <ViewSwitcher modes={['table', 'cards']} value={mode} onChange={setMode} />
            <button
              onClick={() => { setEditing(null); setFormOpen(true) }}
              className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
            >
              + New client
            </button>
          </div>
        }
      />

      {mode === 'table' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Contact</th>
                <th className="px-4 py-2.5 font-medium">Since</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Open money</th>
                <th className="px-4 py-2.5 font-medium">Projects</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {s.clients.map((c) => {
                const { openInvoices, overdue, projects } = statsFor(c)
                return (
                  <tr key={c.id} onClick={() => open(c)} className="hover:bg-gray-50/70 cursor-pointer">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-gray-900 text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {c.name.slice(0, 1)}
                        </span>
                        <div>
                          <div className="font-medium text-gray-900">{c.name}</div>
                          <div className="text-xs text-gray-400">{c.industry} · {c.city}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.contactName}</td>
                    <td className="px-4 py-3 text-gray-500">{dateShort(c.since)}</td>
                    <td className="px-4 py-3"><Chip tone={STATUS_TONE[c.status]}>{c.status}</Chip></td>
                    <td className="px-4 py-3">
                      {openInvoices.length === 0 ? (
                        <span className="text-xs text-gray-400">settled ✓</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="tabular-nums font-medium">
                            {openInvoices.reduce((a, i) => a + i.total, 0).toLocaleString()}
                          </span>
                          {overdue.length > 0 && <Chip tone="red">{overdue.length} overdue</Chip>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{projects.length}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-blue-600">open →</span>
                        <RowActions
                          onEdit={() => { setEditing(c); setFormOpen(true) }}
                          onDelete={() => setArchiveTarget(c)}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {mode === 'cards' && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {s.clients.map((c) => {
            const { openInvoices, overdue, projects } = statsFor(c)
            const hues = [212, 158, 32, 280, 340, 190]
            const hue = hues[c.name.length % hues.length]
            return (
              <div key={c.id} onClick={() => open(c)} className="text-left bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition cursor-pointer">
                <div className="h-16 flex items-center px-4" style={{ background: `linear-gradient(135deg, hsl(${hue} 65% 90%), hsl(${(hue + 40) % 360} 65% 82%))` }}>
                  <span className="text-xl font-bold text-gray-700">{c.name.slice(0, 1)}</span>
                  <span className="ml-auto"><Chip tone={STATUS_TONE[c.status]}>{c.status}</Chip></span>
                </div>
                <div className="p-4 border-t border-gray-100">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{c.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{c.contactName} · {c.industry} · client since {dateShort(c.since)}</div>
                    </div>
                    <RowActions
                      onEdit={() => { setEditing(c); setFormOpen(true) }}
                      onDelete={() => setArchiveTarget(c)}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                    <Chip tone="gray">{projects.length} project{projects.length === 1 ? '' : 's'}</Chip>
                    {openInvoices.length > 0 && <Chip tone={overdue.length ? 'red' : 'amber'}>{openInvoices.reduce((a, i) => a + i.total, 0).toLocaleString()} open</Chip>}
                    {openInvoices.length === 0 && <Chip tone="green">settled</Chip>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New client'}
        fields={CLIENT_FIELDS}
        submitLabel={editing ? 'Save changes' : 'Create client'}
        initial={editing ? {
          name: editing.name, contactName: editing.contactName, email: editing.email,
          phone: editing.phone, city: editing.city, industry: editing.industry, notes: editing.notes ?? '',
        } : undefined}
        onSubmit={(vals) => (editing ? updateClient(editing.id, vals) : createClient(vals))}
      />
      {archiveTarget && (
        <ConfirmModal
          open
          onClose={() => setArchiveTarget(null)}
          title={`Archive ${archiveTarget.name}?`}
          danger
          confirmLabel="Archive client"
          message={
            <>
              {archiveTarget.name} leaves the active list — history (invoices, messages, projects)
              stays. The store blocks this while invoices are still open.
            </>
          }
          onConfirm={() => archiveClient(archiveTarget.id)}
        />
      )}
    </>
  )
}
