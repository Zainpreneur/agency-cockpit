import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { DataTable, exportToCSV } from '../components/PipelineBoard'
import { useAppState } from '../lib/store'
import { money, dateShort } from '../lib/format'

const OFFBOARDING_FIELDS: FieldDef[] = [
  { key: 'clientName', label: 'Client name', required: true },
  { key: 'credentials', label: 'Credentials to revoke (comma-separated)', placeholder: 'Vercel, Tap Payments' },
  { key: 'repos', label: 'Repos to archive (comma-separated)', placeholder: 'alnoor-pos, aqua-pets-site' },
]

export function Offboarding() {
  const s = useAppState()
  const [formOpen, setFormOpen] = useState(false)
  const [selectedChecklist, setSelectedChecklist] = useState<any>(null)

  // Mock offboarding checklists
  const checklists = [
    {
      id: 1, clientName: 'Gulf Spa', status: 'complete', createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), completedAt: new Date(Date.now() - 25 * 86400000).toISOString(),
      items: [
        { id: 1, action: 'Send final invoice', status: 'done' },
        { id: 2, action: 'Revoke credential: Vercel', status: 'done' },
        { id: 3, action: 'Revoke credential: Tap Payments', status: 'done' },
        { id: 4, action: 'Archive repo: gulf-spa-booking', status: 'done' },
        { id: 5, action: 'Export client data', status: 'done' },
        { id: 6, action: 'Close external client costs', status: 'done' },
        { id: 7, action: 'Mark client as offboarded', status: 'done' },
      ],
    },
    {
      id: 2, clientName: 'Desert Carwash', status: 'in_progress', createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      items: [
        { id: 1, action: 'Send final invoice', status: 'done' },
        { id: 2, action: 'Revoke credential: Vercel', status: 'done' },
        { id: 3, action: 'Revoke credential: Tap Payments', status: 'pending' },
        { id: 4, action: 'Archive repo: desert-carwash', status: 'pending' },
        { id: 5, action: 'Export client data', status: 'pending' },
        { id: 6, action: 'Close external client costs', status: 'pending' },
        { id: 7, action: 'Mark client as offboarded', status: 'pending' },
      ],
    },
  ]

  return (
    <>
      <PageHeader
        title="Offboarding"
        subtitle="Revoke-all checklist: final invoice → revoke credentials → archive repos → export data → offboard (doc 15)"
        action={
          <button
            onClick={() => setFormOpen(true)}
            className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
          >
            + Start offboarding
          </button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Stat label="Total" value={String(checklists.length)} />
        <Stat label="In progress" value={String(checklists.filter((c) => c.status === 'in_progress').length)} tone="amber" />
        <Stat label="Complete" value={String(checklists.filter((c) => c.status === 'complete').length)} tone="green" />
      </div>

      <div className="space-y-4">
        {checklists.map((cl) => {
          const done = cl.items.filter((i: any) => i.status === 'done' || i.status === 'skipped').length
          const total = cl.items.length
          const pct = Math.round((done / total) * 100)
          return (
            <SectionCard key={cl.id} title={cl.clientName} hint={`${done}/${total} complete (${pct}%)`}>
              <div className="p-4">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="space-y-2">
                  {cl.items.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 px-2 py-1.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                        item.status === 'done' ? 'bg-emerald-100 text-emerald-700' :
                        item.status === 'skipped' ? 'bg-gray-100 text-gray-500' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {item.status === 'done' ? '✓' : item.status === 'skipped' ? '—' : '○'}
                      </span>
                      <span className={`text-sm ${item.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {item.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )
        })}
      </div>

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Start offboarding"
        fields={OFFBOARDING_FIELDS}
        submitLabel="Create checklist"
        initial={{ credentials: '', repos: '' }}
        onSubmit={() => ({ ok: true })}
      />
    </>
  )
}