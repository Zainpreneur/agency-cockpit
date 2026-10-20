import { useState } from 'react'
import { PageHeader, SectionCard, Stat } from '../components/Layout'
import { Chip } from '../components/StatusChip'
import { FormModal, type FieldDef } from '../components/FormModal'
import { ConfirmModal } from '../components/ConfirmModal'
import { RowActions } from '../components/RowActions'
import {
  useAppState,
  addTeamMember, updateTeamMember, archiveTeamMember, removeTeamMember,
  addInvestor, updateInvestor, removeInvestor,
  createFundingRound, updateFundingRound, deleteFundingRound,
} from '../lib/store'
import { money } from '../lib/format'
import type { TeamMember, Investor } from '../lib/types'

const TEAM_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'email', label: 'Email', type: 'email' },
]

const INVESTOR_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'email', label: 'Email', type: 'email' },
]

const ROUND_FIELDS: FieldDef[] = [
  { key: 'project', label: 'Project', required: true },
  { key: 'target', label: 'Target (SAR)', type: 'number', required: true, min: 1 },
  {
    key: 'rule', label: 'Return rule', type: 'select',
    options: [
      { value: 'fixed', label: 'Fixed return' },
      { value: 'multiple', label: '× multiple' },
      { value: 'revenue_share', label: 'Revenue share' },
    ],
  },
  {
    key: 'sourceKind', label: 'Capital source', type: 'select',
    options: [
      { value: 'new_capital', label: 'New capital' },
      { value: 'recycled', label: 'Recycled returns' },
      { value: 'investor_advance', label: 'Investor advance' },
    ],
  },
  {
    key: 'status', label: 'Status', type: 'select',
    options: [
      { value: 'seeking', label: 'Seeking' },
      { value: 'funded', label: 'Funded' },
      { value: 'closed', label: 'Closed' },
    ],
  },
  { key: 'raised', label: 'Raised so far (SAR)', type: 'number', min: 0, hint: 'can only move forward' },
]

export function People() {
  const s = useAppState()

  const [memberOpen, setMemberOpen] = useState(false)
  const [editMember, setEditMember] = useState<TeamMember | null>(null)
  const [memberAction, setMemberAction] = useState<{ kind: 'archive' | 'remove'; member: TeamMember } | null>(null)

  const [investorOpen, setInvestorOpen] = useState(false)
  const [editInvestor, setEditInvestor] = useState<Investor | null>(null)
  const [investorRemove, setInvestorRemove] = useState<Investor | null>(null)

  const [roundOpen, setRoundOpen] = useState(false)
  const [editRoundId, setEditRoundId] = useState<number | null>(null)
  const [roundRemove, setRoundRemove] = useState<number | null>(null)

  const totalPending = s.team.reduce((a, m) => a + m.pending, 0)
  const deployed = s.investors.reduce((a, i) => a + i.deployed, 0)
  const returned = s.investors.reduce((a, i) => a + i.returned, 0)

  const round = editRoundId !== null ? s.fundingRounds.find((r) => r.id === editRoundId) : null
  const removingRound = roundRemove !== null ? s.fundingRounds.find((r) => r.id === roundRemove) : null

  return (
    <>
      <PageHeader
        title="Team & investors"
        subtitle="Flat fee per deliverable only — no hourly or monthly pay, ever (doc 7)"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setEditMember(null); setMemberOpen(true) }}
              className="rounded-lg bg-white ring-1 ring-gray-300 text-gray-700 text-sm font-medium px-4 py-2 hover:bg-gray-50"
            >
              + Team member
            </button>
            <button
              onClick={() => { setEditInvestor(null); setInvestorOpen(true) }}
              className="rounded-lg bg-white ring-1 ring-gray-300 text-gray-700 text-sm font-medium px-4 py-2 hover:bg-gray-50"
            >
              + Investor
            </button>
            <button
              onClick={() => { setEditRoundId(null); setRoundOpen(true) }}
              className="rounded-lg bg-blue-600 text-white text-sm font-medium px-4 py-2 hover:bg-blue-700"
            >
              + Funding round
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Team pending" value={money(totalPending)} tone={totalPending ? 'amber' : undefined} />
        <Stat label="Team paid YTD" value={money(s.team.reduce((a, m) => a + m.paidYtd, 0))} tone="green" />
        <Stat label="Investor capital" value={money(deployed)} />
        <Stat label="Returned" value={money(returned)} tone="green" />
      </div>

      <div className="space-y-4">
        <SectionCard title="Team" hint="payout rows only — comp plan is fixed per assignment">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2.5 font-medium">Member</th>
                  <th className="px-4 py-2.5 font-medium">Comp plan</th>
                  <th className="px-4 py-2.5 font-medium text-right">Pending</th>
                  <th className="px-4 py-2.5 font-medium text-right">Paid YTD</th>
                  <th className="px-4 py-2.5 font-medium">Blocked on</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {s.team.map((m) => {
                  const blockedOn = s.payouts.filter((p) => p.payee === m.name && p.status === 'blocked')
                  return (
                    <tr key={m.id} className={`hover:bg-gray-50/70 ${m.status === 'archived' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{m.name}</span>
                          {m.status === 'archived' && <Chip tone="gray">archived</Chip>}
                        </div>
                        <div className="text-xs text-gray-400">{m.email}</div>
                      </td>
                      <td className="px-4 py-3"><Chip tone="gray">flat fee per deliverable</Chip></td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{money(m.pending)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{money(m.paidYtd)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {blockedOn.length === 0 ? '—' : blockedOn.map((p) => s.invoices.find((i) => i.id === p.triggerInvoiceId)?.no).filter(Boolean).join(', ')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <RowActions
                            onEdit={() => { setEditMember(m); setMemberOpen(true) }}
                            onDelete={() => setMemberAction({ kind: 'archive', member: m })}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 pt-3 text-xs text-gray-400">
            Rolling someone off? Archive keeps their payout history; hard delete is only offered
            once no payout rows reference them.
          </div>
        </SectionCard>

        <SectionCard title="Investors" hint="positions are derived from payouts and funding rows — no hand-kept balances">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2.5 font-medium">Investor</th>
                  <th className="px-4 py-2.5 font-medium text-right">Deployed</th>
                  <th className="px-4 py-2.5 font-medium text-right">Returned</th>
                  <th className="px-4 py-2.5 font-medium text-right">Current</th>
                  <th className="px-4 py-2.5 font-medium">Flow</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {s.investors.map((inv) => {
                  const current = inv.deployed - inv.returned
                  const pcts = Math.round((inv.returned / Math.max(inv.deployed, 1)) * 100)
                  const blocked = s.payouts.filter((p) => p.payee === inv.name && p.status === 'blocked')
                  const payable = s.payouts.filter((p) => p.payee === inv.name && p.status === 'payable')
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50/70">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{inv.name}</div>
                        <div className="text-xs text-gray-400">{inv.email}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(inv.deployed)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-600">{money(inv.returned)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">{money(current)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-gray-500 tabular-nums">{pcts}% returned</span>
                          {blocked.length > 0 && <Chip tone="gray">blocked on {s.invoices.find((i) => i.id === blocked[0].triggerInvoiceId)?.no}</Chip>}
                          {payable.length > 0 && <Chip tone="amber">{money(payable.reduce((a, p) => a + p.amount, 0))} payable</Chip>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <RowActions
                            onEdit={() => { setEditInvestor(inv); setInvestorOpen(true) }}
                            onDelete={() => setInvestorRemove(inv)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Funding rounds" hint="salvage rounds offer burned investors first (doc 21)">
          {s.fundingRounds.length === 0 && (
            <div className="px-4 py-6 text-sm text-gray-400 text-center">No rounds yet.</div>
          )}
          {s.fundingRounds.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-gray-900">{r.project}</div>
                <div className="text-xs text-gray-500">
                  {r.rule === 'fixed' ? 'fixed return' : r.rule === 'multiple' ? '× multiple' : 'revenue share'} · {r.sourceKind.replace('_', ' ')}
                </div>
              </div>
              <Chip tone={r.status === 'seeking' ? 'amber' : r.status === 'funded' ? 'green' : 'blue'}>
                {money(r.raised)} / {money(r.target)}
              </Chip>
              <RowActions
                onEdit={() => { setEditRoundId(r.id); setRoundOpen(true) }}
                onDelete={() => setRoundRemove(r.id)}
              />
            </div>
          ))}
        </SectionCard>
      </div>

      <FormModal
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        title={editMember ? `Edit ${editMember.name}` : 'New team member'}
        fields={TEAM_FIELDS}
        submitLabel={editMember ? 'Save changes' : 'Add member'}
        initial={editMember ? { name: editMember.name, email: editMember.email } : undefined}
        onSubmit={(vals) => (editMember ? updateTeamMember(editMember.id, vals) : addTeamMember(vals))}
      />
      <ConfirmModal
        open={!!memberAction}
        onClose={() => setMemberAction(null)}
        title={memberAction ? `${memberAction.kind === 'archive' ? 'Archive' : 'Remove'} ${memberAction.member.name}?` : ''}
        danger
        confirmLabel={memberAction?.kind === 'archive' ? 'Archive member' : 'Remove member'}
        message={
          <>
            {memberAction?.kind === 'archive'
              ? 'Archiving keeps them off new assignments but preserves every payout row. Money history is append-only — nothing here is erased.'
              : 'Hard delete only works once no payout rows reference this member.'}
            {memberAction && memberAction.kind === 'archive' && (
              <button
                onClick={() => setMemberAction({ kind: 'remove', member: memberAction.member })}
                className="mt-3 block text-xs text-red-600 hover:underline"
              >
                Actually, try a hard delete instead →
              </button>
            )}
          </>
        }
        onConfirm={() =>
          memberAction === null
            ? { ok: false, error: 'Nothing selected.' }
            : memberAction.kind === 'archive'
              ? archiveTeamMember(memberAction.member.id)
              : removeTeamMember(memberAction.member.id)
        }
      />

      <FormModal
        open={investorOpen}
        onClose={() => setInvestorOpen(false)}
        title={editInvestor ? `Edit ${editInvestor.name}` : 'New investor'}
        fields={INVESTOR_FIELDS}
        submitLabel={editInvestor ? 'Save changes' : 'Add investor'}
        initial={editInvestor ? { name: editInvestor.name, email: editInvestor.email } : undefined}
        onSubmit={(vals) => (editInvestor ? updateInvestor(editInvestor.id, vals) : addInvestor(vals))}
      />
      <ConfirmModal
        open={!!investorRemove}
        onClose={() => setInvestorRemove(null)}
        title={investorRemove ? `Remove ${investorRemove.name}?` : ''}
        danger
        confirmLabel="Remove investor"
        message="Investors with capital in play can't be removed — settle their position first (the store enforces it)."
        onConfirm={() => (investorRemove ? removeInvestor(investorRemove.id) : { ok: false, error: 'Nothing selected.' })}
      />

      <FormModal
        open={roundOpen}
        onClose={() => setRoundOpen(false)}
        title={round ? `Edit round — ${round.project}` : 'New funding round'}
        fields={ROUND_FIELDS}
        submitLabel={round ? 'Save changes' : 'Open round'}
        initial={round ? {
          project: round.project, target: round.target, rule: round.rule,
          sourceKind: round.sourceKind, status: round.status, raised: round.raised,
        } : { rule: 'fixed', sourceKind: 'new_capital', status: 'seeking', raised: 0 }}
        onSubmit={(vals) => (round ? updateFundingRound(round.id, vals) : createFundingRound(vals))}
      />
      <ConfirmModal
        open={!!removingRound}
        onClose={() => setRoundRemove(null)}
        title={removingRound ? `Delete round — ${removingRound.project}?` : ''}
        danger
        confirmLabel="Delete round"
        message="Only rounds nobody has funded can be deleted — once capital lands, close the round instead."
        onConfirm={() => (roundRemove !== null ? deleteFundingRound(roundRemove) : { ok: false, error: 'Nothing selected.' })}
      />
    </>
  )
}
