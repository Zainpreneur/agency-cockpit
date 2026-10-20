import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/Layout'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import { useAppState, createCatalogTemplate, updateCatalogTemplate, deleteCatalogTemplate } from '../lib/store'
import { money } from '../lib/format'
import type { CatalogTemplate } from '../lib/types'

const CATALOG_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Template name', required: true, placeholder: 'Online store · booking site…' },
  { key: 'fromPrice', label: 'From price (SAR)', type: 'number', required: true, min: 0 },
  { key: 'hue', label: 'Card hue (0–360)', type: 'number', min: 0, hint: 'visual band colour for the gallery card' },
]

export function Catalogue() {
  const s = useAppState()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogTemplate | null>(null)
  const [removeTarget, setRemoveTarget] = useState<CatalogTemplate | null>(null)

  return (
    <>
      <PageHeader
        title="Catalogue"
        subtitle="Templates = variant + attribute engine (doc 17) — the proposal builder renders these as pills"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setEditing(null); setFormOpen(true) }}
              className="rounded-lg bg-white ring-1 ring-gray-300 text-gray-700 text-sm font-medium px-4 py-2 hover:bg-gray-50"
            >
              + New template
            </button>
            <Link to="/sales/proposals/new" className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700">
              Build a proposal →
            </Link>
          </div>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {s.catalog.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div
              className="h-36 flex items-end justify-between p-3"
              style={{ background: `linear-gradient(135deg, hsl(${t.hue} 70% 88%), hsl(${(t.hue + 40) % 360} 70% 74%))` }}
            >
              <span className="text-xs font-semibold text-gray-700 bg-white/75 rounded px-2 py-0.5">{t.sold} sold</span>
              <span className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 bg-white/60 rounded px-2 py-0.5">image_url → initials fallback</span>
                <span className="bg-white/70 rounded-lg p-0.5">
                  <RowActions
                    onEdit={() => { setEditing(t); setFormOpen(true) }}
                    onDelete={() => setRemoveTarget(t)}
                  />
                </span>
              </span>
            </div>
            <div className="p-4 border-t border-gray-100">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-gray-900">{t.name}</h2>
                <span className="text-sm font-semibold tabular-nums">from {money(t.fromPrice)}</span>
              </div>

              <div className="mt-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Variants</div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {t.variants.map((v) => (
                    <span key={v.code} className="rounded-full bg-gray-50 ring-1 ring-gray-200 px-2 py-0.5 text-[11px] text-gray-600">
                      {v.name} · {money(v.price)} · {v.deliveryDays}d
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Attributes</div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {t.attributes.map((a) => (
                    <span key={a.code} className="rounded-full bg-blue-50 ring-1 ring-blue-100 px-2 py-0.5 text-[11px] text-blue-700" title={a.values.map((v) => v.name).join(' / ')}>
                      {a.name} ({a.values.length})
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-500 tabular-nums">
                margins by variant:{' '}
                {t.variants.map((v) => `${v.name} ${Math.round(((v.price - v.cost) / v.price) * 100)}%`).join(' · ')}
                <span className="text-gray-400"> · owner-only numbers</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'New catalogue template'}
        fields={CATALOG_FIELDS}
        submitLabel={editing ? 'Save changes' : 'Create template'}
        initial={editing ? {
          name: editing.name, fromPrice: editing.fromPrice, hue: editing.hue,
        } : { fromPrice: 0, hue: 212 }}
        onSubmit={(vals) => (editing ? updateCatalogTemplate(editing.id, vals) : createCatalogTemplate(vals))}
      />
      <ConfirmModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={removeTarget ? `Delete ${removeTarget.name}?` : ''}
        danger
        confirmLabel="Delete template"
        message="Proposals that already quoted this keep their frozen price snapshots — only the catalogue entry goes."
        onConfirm={() => (removeTarget ? deleteCatalogTemplate(removeTarget.id) : { ok: false, error: 'Nothing selected.' })}
      />
    </>
  )
}
