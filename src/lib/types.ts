// ── Domain types (frontend mirror of the plan's schema; swap for API types later)

export type LeadStatus =
  | 'discovered' | 'contacted' | 'demo_built' | 'demo_shared'
  | 'proposal_sent' | 'negotiating' | 'won' | 'lost' | 'archived'

export type Lead = {
  id: number
  businessName: string
  contactName: string
  phone: string
  email: string
  source: string
  industry: string
  city: string
  status: LeadStatus
  nextFollowUpAt?: string
  lastInboundAt?: string
  lastOutboundAt?: string
  notes?: string
}

export type ProposalLine = { description: string; qty: number; unitPrice: number }
export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'

export type Proposal = {
  id: number
  no: string
  leadId: number
  leadName: string
  listPrice: number
  offeredPrice: number
  cost: number
  discountReason?: string
  status: ProposalStatus
  validUntil: string
  createdAt: string
  lines: ProposalLine[]
  maintenanceMonthly?: number
}

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'void'

export type Invoice = {
  id: number
  no: string
  clientName: string
  proposalNo?: string
  total: number
  status: InvoiceStatus
  dueAt: string
  paidAt?: string
  paidVia?: string
  lines: ProposalLine[]
}

export type Payment = {
  id: number
  invoiceId: number
  provider: 'tap' | 'moyasar' | 'bank'
  amount: number
  paidAt: string
  reference?: string
}

export type PayoutKind = 'delivery' | 'milestone' | 'bonus' | 'investor_return' | 'investor_principal'
export type PayoutStatus = 'accrued' | 'blocked' | 'payable' | 'paid' | 'cancelled'

export type Payout = {
  id: number
  payee: string
  payeeRole: 'team' | 'investor'
  kind: PayoutKind
  amount: number
  status: PayoutStatus
  triggerInvoiceId?: number
  note?: string
  paidAt?: string
}

export type OutboxStatus = 'scheduled' | 'ready' | 'sent' | 'skipped'

export type OutboxItem = {
  id: number
  contactableName: string
  stakeholder: 'lead' | 'client' | 'team' | 'investor' | 'vendor'
  templateCode: string
  subject: string
  body: string
  dueAt: string
  status: OutboxStatus
  cancelledBy?: 'inbound_reply'
}

export type CommsEntry = {
  id: number
  contactableName: string
  channel: 'email'
  direction: 'in' | 'out'
  snippet: string
  at: string
  templateCode?: string
}

export type StatusEvent = {
  id: number
  entity: string
  entityId: number
  from: string
  to: string
  note?: string
  at: string
}

export type CommsTemplate = {
  code: string
  stakeholder: string
  stage: string
  subject: string
  body: string
  followupTemplateCode?: string
  followupAfterDays?: number
}

export type CatalogVariant = { code: string; name: string; price: number; cost: number; deliveryDays: number }
export type CatalogAttributeValue = {
  code: string
  name: string
  priceExtra: number
  excludedWith?: string[] // "attrCode=valueCode" combos that become disabled
}
export type CatalogAttribute = {
  code: string
  name: string
  values: CatalogAttributeValue[]
}

export type CatalogTemplate = {
  id: number
  name: string
  hue: number
  fromPrice: number
  sold: number
  variants: CatalogVariant[]
  attributes: CatalogAttribute[]
}

export type DeployTarget = {
  id: number
  name: string
  clientName: string
  provider: 'vercel' | 'hostinger_vps' | 'generic_paas' | 'office_vps'
  env: 'staging' | 'production'
  status: 'never_deployed' | 'healthy' | 'degraded' | 'pending_agent'
  lastDeployAt?: string
  behindBy: number
  version: string
}

export type PurchaseOrder = {
  id: number
  no: string
  project: string
  vendor: string
  total: number
  fundedBy: 'own_cash' | 'investor_advance'
  status: 'draft' | 'ordered' | 'received' | 'installed' | 'invoiced'
  orderedAt?: string
  assignee?: string
  items: { description: string; qty: number; unitCost: number }[]
}

export type Investor = { id: number; name: string; email: string; deployed: number; returned: number }
export type TeamMember = { id: number; name: string; email: string; pending: number; paidYtd: number; status: 'active' | 'archived' }

export type Credential = {
  id: number
  provider: string
  kind: 'oauth' | 'api_key' | 'ssh_key'
  masked: string
  expiresAt?: string
  note?: string
}

export type ClientDevice = {
  id: number
  clientName: string
  kind: string
  serial?: string
  imageHue: number
  warrantyUntil?: string
}

export type RepoRow = { id: number; name: string; clientName: string; behindBy: number; version: string }

export type FundingRound = {
  id: number
  project: string
  target: number
  raised: number
  rule: 'fixed' | 'multiple' | 'revenue_share'
  sourceKind: 'salvage_round' | 'new_capital'
  status: 'seeking' | 'committed' | 'funded' | 'returned' | 'closed'
}

export type Client = {
  id: number
  name: string
  contactName: string
  email: string
  phone: string
  city: string
  industry: string
  status: 'active' | 'delivered' | 'archived'
  since: string
  notes?: string
}

export type Vendor = {
  id: number
  name: string
  category: string
  contactName: string
  phone: string
  email: string
  terms: string
  status: 'active' | 'archived'
}

export type Project = {
  id: number
  name: string
  clientName: string
  phase: string
  status: 'proposal' | 'procurement' | 'building' | 'deploying' | 'delivered' | 'maintenance'
  fundedBy: 'own_cash' | 'investor_advance'
  stake: number
}

export type Campaign = {
  id: number
  name: string
  status: 'active' | 'paused' | 'ended'
  audience: string
  channel: 'email'
  steps: { day: number; templateCode: string }[]
  enrolled: number
  replied: number
}

export type AppState = {
  seq: number
  leads: Lead[]
  proposals: Proposal[]
  invoices: Invoice[]
  payments: Payment[]
  payouts: Payout[]
  outbox: OutboxItem[]
  commsLog: CommsEntry[]
  statusEvents: StatusEvent[]
  commsTemplates: CommsTemplate[]
  catalog: CatalogTemplate[]
  deployTargets: DeployTarget[]
  purchaseOrders: PurchaseOrder[]
  investors: Investor[]
  team: TeamMember[]
  credentials: Credential[]
  devices: ClientDevice[]
  repos: RepoRow[]
  fundingRounds: FundingRound[]
  clients: Client[]
  vendors: Vendor[]
  projects: Project[]
  campaigns: Campaign[]
}
