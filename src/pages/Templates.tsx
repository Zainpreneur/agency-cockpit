import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow } from '../components/Layout'
import { Chip } from '../components/StatusChip'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { useAppState, createTemplate, updateTemplate, deleteTemplate } from '../lib/store'
import type { CommsTemplate } from '../lib/types'

const STAKEHOLDERS = ['all', 'lead', 'client', 'team', 'investor', 'vendor'] as const

const TEMPLATE_FIELDS: FieldDef[] = [
  { key: 'code', label: 'Code', required: true, placeholder: 'invoice_reminder_1', hint: 'lowercase, underscores' },
  {
    key: 'stakeholder', label: 'Stakeholder', type: 'select',
    options: STAKEHOLDERS.filter((x) => x !== 'all').map((x) => ({ value: x, label: x })),
  },
  { key: 'stage', label: 'Stage', placeholder: 'manual · day 3 · after invoice…' },
  { key: 'subject', label: 'Subject', required: true },
  { key: 'body', label: 'Body', type: 'textarea', rows: 8, required: true, hint: 'merge fields: {name} {amount} {invoice_no}…' },
  { key: 'followupTemplateCode', label: 'Follow-up template code', hint: 'optional — chains schedule the next send' },
  { key: 'followupAfterDays', label: 'Follow-up after (days)', type: 'number', min: 0 },
]

export function Templates() {
  const s = useAppState()
  const [filter, setFilter] = useState<(typeof STAKEHOLDERS)[number]>('all')
  const [openCode, setOpenCode] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CommsTemplate | null>(null)
  const [removeTarget, setRemoveTarget] = useState<CommsTemplate | null>(null)

  const list = s.commsTemplates.filter((t) => filter === 'all' || t.stakeholder === filter)

  return (
    <>
      <PageHeader
        title="Templates"
        subtitle="Plain-language email templates with follow-up chains — every outbox row renders one"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {STAKEHOLDERS.map((x) => (
                <button
                  key={x}
                  onClick={() => setFilter(x)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset capitalize ${
                    filter === x ? 'bg-gray-900 text-white ring-gray-900' : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {x}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setEditing(null); setFormOpen(true) }}
              className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
            >
              + New template
            </button>
          </div>
        }
      />

      <SectionCard title={`${list.length} templates`} hint="click a row to preview">
        {list.length === 0 && <EmptyRow text="No templates in this group." />}
        {list.map((t) => {
          const open = openCode === t.code
          const chain = []
          let cur = t
          while (cur?.followupTemplateCode && chain.length < 6) {
            const next = s.commsTemplates.find((x) => x.code === cur.followupTemplateCode)
            if (!next) break
            chain.push(next)
            cur = next
          }
          return (
            <div key={t.code}>
              <button
                onClick={() => setOpenCode(open ? null : t.code)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
              >
                <span className="font-mono text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-600 shrink-0">{t.code}</span>
                <span className="text-sm text-gray-800 truncate flex-1">{t.subject}</span>
                <Chip tone="gray">{t.stakeholder}</Chip>
                <span className="text-xs text-gray-400 hidden sm:block w-40 truncate">{t.stage}</span>
                <span className="text-gray-400 text-xs">{open ? '▴' : '▾'}</span>
              </button>
              {open && (
                <div className="px-4 pb-4 -mt-1">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed bg-gray-50 rounded-lg p-3 text-gray-700 font-sans border border-gray-100">
                    <strong className="block text-xs uppercase tracking-wider text-gray-400 mb-1.5">Subject: {t.subject}</strong>
                    {t.body}
                  </pre>
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500 overflow-x-auto">
                    <span className="font-mono text-gray-600">{t.code}</span>
                    {chain.map((c) => (
                      <span key={c.code} className="flex items-center gap-1.5 shrink-0">
                        <span>→</span>
                        <span className="font-mono text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">
                          {c.code}{c.followupAfterDays ? ` (+${c.followupAfterDays}d)` : ''}
                        </span>
                      </span>
                    ))}
                    {chain.length === 0 && <span className="text-gray-400">· end of chain (no auto follow-up)</span>}
                    <span className="ml-auto">
                      <RowActions
                        onEdit={() => { setEditing(t); setFormOpen(true) }}
                        onDelete={() => setRemoveTarget(t)}
                      />
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </SectionCard>

      <div className="mt-4 grid sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm">
          <div className="font-semibold text-gray-900 mb-1">Merge fields</div>
          <p className="text-xs text-gray-500 leading-relaxed">
            {'{name} {business} {proposal_no} {amount} {invoice_no} {due_date} …'} — filled from the
            record the template is sent against.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm">
          <div className="font-semibold text-gray-900 mb-1">Chains</div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Each template can name its follow-up + delay; sending schedules the next row instead of
            making you remember.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm">
          <div className="font-semibold text-gray-900 mb-1">Analytics tie-in</div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Response rates by template feed the growth pillar — same rows, no extra tracking.
          </p>
        </div>
      </div>

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.code}` : 'New template'}
        fields={editing ? TEMPLATE_FIELDS.filter((f) => f.key !== 'code') : TEMPLATE_FIELDS}
        submitLabel={editing ? 'Save changes' : 'Create template'}
        initial={editing ? {
          code: editing.code, stakeholder: editing.stakeholder, stage: editing.stage,
          subject: editing.subject, body: editing.body,
          followupTemplateCode: editing.followupTemplateCode ?? '',
          followupAfterDays: editing.followupAfterDays ?? 0,
        } : { stakeholder: 'lead', followupAfterDays: 0 }}
        onSubmit={(vals) => (editing ? updateTemplate(editing.code, vals) : createTemplate(vals))}
      />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget ? `Delete ${removeTarget.code}?` : ''}
        danger
        confirmLabel="Delete template"
        message="Only templates with nothing queued in the outbox can be deleted — skip or send those rows first."
        onConfirm={() => (removeTarget ? deleteTemplate(removeTarget.code) : { ok: false, error: 'Nothing selected.' })}
      />
    </>
  )
}
