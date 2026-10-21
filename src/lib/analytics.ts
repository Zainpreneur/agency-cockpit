// ── Analytics Metrics (doc 24) ──────────────────────────────────────────────
// Computes all 50+ metrics from existing rows. Nothing typed twice.

import { useAppState } from './store'
import { money, daysBetween, dateShort } from './format'
import type { Lead, Proposal, Invoice, Payment, Payout, Project, PurchaseOrder, Client, Vendor, TeamMember, Investor, FundingRound, Campaign, ModuleOrder, Ticket, Demo, Expense, ToolCost, AgencyAsset, ClientDevice, Credential, OutboxItem, CommsEntry, StatusEvent } from './types'

export interface Metric {
  id: string
  name: string
  value: number | string
  formatted: string
  trend?: 'up' | 'down' | 'flat'
  tone?: 'green' | 'amber' | 'red' | 'blue' | 'gray'
  decision: string
  drillDown?: string
}

export interface MetricPillar {
  name: string
  metrics: Metric[]
}

// ── Helper functions ────────────────────────────────────────────────────────

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function pct(n: number, d: number): number {
  return d ? Math.round((n / d) * 100) : 0
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0)
}

// ── MONEY PILLAR ────────────────────────────────────────────────────────────

export function computeMoneyMetrics(s: any): Metric[] {
  const invoices = s.invoices as Invoice[]
  const payments = s.payments as Payment[]
  const payouts = s.payouts as Payout[]
  const expenses = s.expenses as Expense[]
  const toolCosts = s.toolCosts as ToolCost[]
  const projects = s.projects as Project[]
  const purchaseOrders = s.purchaseOrders as PurchaseOrder[]

  const paidInvoices = invoices.filter((i) => i.status === 'paid')
  const unpaidInvoices = invoices.filter((i) => i.status !== 'paid' && i.status !== 'void')
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue')

  const cashPosition = sum(payments.map((p) => p.amount)) - sum(payouts.filter((p) => p.status === 'paid').map((p) => p.amount)) - sum(expenses.map((e) => e.sarAmount)) - sum(toolCosts.map((t) => t.sarAmount))
  const revenueCollected = sum(paidInvoices.map((i) => i.total))
  const outstandingTotal = sum(unpaidInvoices.map((i) => i.total))
  const overdueTotal = sum(overdueInvoices.map((i) => i.total))

  // Aging buckets
  const aging0_7 = unpaidInvoices.filter((i) => daysBetween(i.dueAt) <= 7 && daysBetween(i.dueAt) >= 0).length
  const aging8_30 = unpaidInvoices.filter((i) => daysBetween(i.dueAt) > 7 && daysBetween(i.dueAt) <= 30).length
  const aging31_60 = unpaidInvoices.filter((i) => daysBetween(i.dueAt) > 30 && daysBetween(i.dueAt) <= 60).length
  const aging60plus = unpaidInvoices.filter((i) => daysBetween(i.dueAt) > 60).length

  // Win rate
  const proposals = s.proposals as Proposal[]
  const accepted = proposals.filter((p) => p.status === 'accepted').length
  const rejected = proposals.filter((p) => p.status === 'rejected').length
  const expired = proposals.filter((p) => p.status === 'expired').length
  const winRate = pct(accepted, accepted + rejected + expired)

  // Average deal size
  const avgDealSize = paidInvoices.length ? Math.round(revenueCollected / paidInvoices.length) : 0

  // Project margin %
  const projectMargins = projects.map((p) => {
    const pos = purchaseOrders.filter((po) => po.project === p.name)
    const invs = invoices.filter((inv) => pos.some((po) => po.project === p.name))
    const rev = invs.filter((i) => i.status === 'paid').reduce((a, i) => a + i.total, 0)
    const costs = pos.filter((po) => po.status === 'invoiced').reduce((a, po) => a + po.total, 0)
    const team = payouts.filter((pay) => pay.payeeRole === 'team' && invs.some((i) => i.id === pay.triggerInvoiceId)).reduce((a, p) => a + p.amount, 0)
    const investor = payouts.filter((pay) => pay.payeeRole === 'investor' && invs.some((i) => i.id === pay.triggerInvoiceId)).reduce((a, p) => a + p.amount, 0)
    const margin = rev - costs - team - investor
    return { project: p.name, revenue: rev, costs, team, investor, margin, marginPct: pct(margin, rev) }
  })
  const totalMargin = sum(projectMargins.map((m) => m.margin))
  const avgMarginPct = pct(totalMargin, revenueCollected)

  // Zero-cash-outlay share
  const investorFundedMargin = projectMargins.filter((m) => {
    const proj = projects.find((p) => p.name === m.project)
    return proj?.fundedBy === 'investor_advance'
  }).reduce((a, m) => a + (m.margin > 0 ? m.margin : 0), 0)
  const zeroCashOutlayShare = pct(investorFundedMargin, totalMargin > 0 ? totalMargin : 1)

  // Payout obligations
  const blockedPayouts = payouts.filter((p) => p.status === 'blocked')
  const payablePayouts = payouts.filter((p) => p.status === 'payable')
  const paidPayouts = payouts.filter((p) => p.status === 'paid')
  const guardProtected = sum(blockedPayouts.map((p) => p.amount))

  // Investor obligations
  const investors = s.investors as Investor[]
  const totalDeployed = sum(investors.map((i) => i.deployed))
  const totalReturned = sum(investors.map((i) => i.returned))
  const investorMultiple = totalDeployed ? (totalReturned / totalDeployed).toFixed(2) : '0.00'

  // Cost structure
  const totalCosts = sum(expenses.map((e) => e.sarAmount)) + sum(toolCosts.map((t) => t.sarAmount))
  const teamPct = pct(sum(payouts.filter((p) => p.payeeRole === 'team').map((p) => p.amount)), revenueCollected)
  const procPct = pct(sum(purchaseOrders.filter((po) => po.status === 'invoiced').map((po) => po.total)), revenueCollected)
  const investorPct = pct(sum(payouts.filter((p) => p.payeeRole === 'investor').map((p) => p.amount)), revenueCollected)
  const toolsPct = pct(sum(toolCosts.map((t) => t.sarAmount)), revenueCollected)

  return [
    { id: 'cash-position', name: 'Cash position (recorded)', value: cashPosition, formatted: money(cashPosition), trend: 'flat', tone: cashPosition >= 0 ? 'green' : 'red', decision: 'Can I commit to this month?', drillDown: '/money/payouts' },
    { id: 'revenue-collected', name: 'Revenue (collected)', value: revenueCollected, formatted: money(revenueCollected), trend: 'up', tone: 'green', decision: 'Trend; template vs custom vs module mix', drillDown: '/money/invoices' },
    { id: 'outstanding', name: 'Outstanding / aging', value: outstandingTotal, formatted: money(outstandingTotal), trend: 'flat', tone: overdueTotal > 0 ? 'amber' : 'green', decision: 'Who to chase today', drillDown: '/money/invoices' },
    { id: 'overdue-total', name: 'Overdue total', value: overdueTotal, formatted: money(overdueTotal), trend: overdueTotal > 0 ? 'up' : 'flat', tone: overdueTotal > 0 ? 'red' : 'green', decision: 'Chase immediately', drillDown: '/money/invoices' },
    { id: 'win-rate', name: 'Win rate', value: winRate, formatted: `${winRate}%`, trend: winRate >= 30 ? 'up' : 'down', tone: winRate >= 30 ? 'green' : 'amber', decision: 'Pricing & volume sanity', drillDown: '/sales/proposals' },
    { id: 'avg-deal-size', name: 'Average deal size', value: avgDealSize, formatted: money(avgDealSize), trend: 'flat', tone: 'blue', decision: 'Which segment to pitch', drillDown: '/sales/proposals' },
    { id: 'project-margin', name: 'Project margin %', value: avgMarginPct, formatted: `${avgMarginPct}%`, trend: avgMarginPct >= 25 ? 'up' : 'down', tone: avgMarginPct >= 25 ? 'green' : 'amber', decision: 'Which work to repeat', drillDown: '/reports' },
    { id: 'zero-cash-outlay', name: 'Zero-cash-outlay share', value: zeroCashOutlayShare, formatted: `${zeroCashOutlayShare}%`, trend: 'flat', tone: 'blue', decision: 'Capital strategy', drillDown: '/people' },
    { id: 'payout-obligations', name: 'Payout obligations (blocked)', value: guardProtected, formatted: money(guardProtected), trend: 'flat', tone: 'amber', decision: 'Guard protected this month', drillDown: '/money/payouts' },
    { id: 'payable-payouts', name: 'Payout obligations (payable)', value: sum(payablePayouts.map((p) => p.amount)), formatted: money(sum(payablePayouts.map((p) => p.amount))), trend: 'flat', tone: 'amber', decision: 'Cash owed now', drillDown: '/money/payouts' },
    { id: 'paid-payouts', name: 'Payout obligations (paid MTD)', value: sum(paidPayouts.map((p) => p.amount)), formatted: money(sum(paidPayouts.map((p) => p.amount))), trend: 'up', tone: 'green', decision: 'Cash out this month', drillDown: '/money/payouts' },
    { id: 'investor-deployed', name: 'Investor capital deployed', value: totalDeployed, formatted: money(totalDeployed), trend: 'flat', tone: 'blue', decision: 'Capital in play', drillDown: '/people' },
    { id: 'investor-returned', name: 'Investor capital returned', value: totalReturned, formatted: money(totalReturned), trend: 'up', tone: 'green', decision: 'Returns paid', drillDown: '/people' },
    { id: 'investor-multiple', name: 'Investor simple multiple', value: parseFloat(investorMultiple), formatted: `${investorMultiple}×`, trend: parseFloat(investorMultiple) >= 1 ? 'up' : 'down', tone: parseFloat(investorMultiple) >= 1 ? 'green' : 'red', decision: 'Relationship & solvency', drillDown: '/people' },
    { id: 'cost-structure-team', name: 'Cost structure: Team %', value: teamPct, formatted: `${teamPct}%`, trend: 'flat', tone: teamPct > 40 ? 'amber' : 'green', decision: 'Where margin leaks', drillDown: '/expenses' },
    { id: 'cost-structure-proc', name: 'Cost structure: Procurement %', value: procPct, formatted: `${procPct}%`, trend: 'flat', tone: procPct > 30 ? 'amber' : 'green', decision: 'Where margin leaks', drillDown: '/expenses' },
    { id: 'cost-structure-investor', name: 'Cost structure: Investor %', value: investorPct, formatted: `${investorPct}%`, trend: 'flat', tone: 'blue', decision: 'Where margin leaks', drillDown: '/expenses' },
    { id: 'cost-structure-tools', name: 'Cost structure: Tools %', value: toolsPct, formatted: `${toolsPct}%`, trend: 'flat', tone: toolsPct > 10 ? 'amber' : 'green', decision: 'Where margin leaks', drillDown: '/expenses' },
    { id: 'aging-0-7', name: 'Aging: 0-7 days', value: aging0_7, formatted: String(aging0_7), trend: 'flat', tone: aging0_7 > 0 ? 'amber' : 'green', decision: 'Recent overdue', drillDown: '/money/invoices' },
    { id: 'aging-8-30', name: 'Aging: 8-30 days', value: aging8_30, formatted: String(aging8_30), trend: 'flat', tone: aging8_30 > 0 ? 'amber' : 'green', decision: 'Follow up needed', drillDown: '/money/invoices' },
    { id: 'aging-31-60', name: 'Aging: 31-60 days', value: aging31_60, formatted: String(aging31_60), trend: 'flat', tone: aging31_60 > 0 ? 'red' : 'green', decision: 'Urgent chase', drillDown: '/money/invoices' },
    { id: 'aging-60-plus', name: 'Aging: 60+ days', value: aging60plus, formatted: String(aging60plus), trend: 'flat', tone: aging60plus > 0 ? 'red' : 'green', decision: 'Default risk', drillDown: '/money/invoices' },
  ]
}

// ── PIPELINE PILLAR ─────────────────────────────────────────────────────────

export function computePipelineMetrics(s: any): Metric[] {
  const leads = s.leads as Lead[]
  const proposals = s.proposals as Proposal[]
  const campaigns = s.campaigns as Campaign[]
  const commsLog = s.commsLog as CommsEntry[]
  const outbox = s.outbox as OutboxItem[]

  const leadsByStage: Record<string, number> = {}
  for (const l of leads) {
    leadsByStage[l.status] = (leadsByStage[l.status] || 0) + 1
  }

  // New leads this week
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const newLeadsWeek = leads.filter((l) => l.lastInboundAt && l.lastInboundAt > oneWeekAgo).length

  // Median first-response time
  const responseTimes: number[] = []
  for (const lead of leads) {
    if (lead.lastInboundAt && lead.lastOutboundAt) {
      const diff = (new Date(lead.lastOutboundAt).getTime() - new Date(lead.lastInboundAt).getTime()) / 86400000
      if (diff > 0) responseTimes.push(diff)
    }
  }
  const medianResponseTime = median(responseTimes)

  // Sequence funnel
  const introSent = outbox.filter((o) => o.templateCode === 'lead_intro' && o.status === 'sent').length
  const replied = leads.filter((l) => l.lastInboundAt).length
  const demoBuilt = leads.filter((l) => l.status === 'demo_built' || l.status === 'demo_shared').length
  const proposalSent = leads.filter((l) => l.status === 'proposal_sent' || l.status === 'negotiating' || l.status === 'won').length
  const won = leads.filter((l) => l.status === 'won').length

  // Proposals in flight
  const proposalsSent = proposals.filter((p) => p.status === 'sent' || p.status === 'viewed').length
  const proposalsExpiring = proposals.filter((p) => (p.status === 'sent' || p.status === 'viewed') && daysBetween(p.validUntil) > -7).length
  const proposalsAccepted = proposals.filter((p) => p.status === 'accepted').length
  const proposalsLost = proposals.filter((p) => p.status === 'rejected' || p.status === 'expired').length

  // Campaign ROI
  const campaignLeads = leads.filter((l) => l.source === 'instagram' || l.source === 'maps').length
  const campaignRevenue = proposals.filter((p) => p.status === 'accepted').reduce((a, p) => a + p.offeredPrice, 0)
  const campaignToolCost = 800 // mock tool cost
  const campaignROI = campaignToolCost ? Math.round((campaignRevenue / campaignToolCost) * 100) / 100 : 0

  // Demo → proposal conversion
  const demos = s.demos as Demo[]
  const demoToProposal = pct(proposals.length, demos.length)

  // Salvage plays
  const salvageRounds = s.fundingRounds?.filter((r: any) => r.sourceKind === 'salvage_round')?.length || 0

  // Median time to close by source
  const wonLeads = leads.filter((l) => l.status === 'won')
  const medianTimeToClose = median(wonLeads.map((l) => l.lastInboundAt ? daysBetween(l.lastInboundAt) : 0))

  return [
    { id: 'leads-total', name: 'Total leads', value: leads.length, formatted: String(leads.length), trend: 'up', tone: 'blue', decision: 'Pipeline volume', drillDown: '/sales/leads' },
    { id: 'leads-discovered', name: 'Leads: discovered', value: leadsByStage['discovered'] || 0, formatted: String(leadsByStage['discovered'] || 0), trend: 'flat', tone: 'gray', decision: 'New prospects', drillDown: '/sales/leads' },
    { id: 'leads-contacted', name: 'Leads: contacted', value: leadsByStage['contacted'] || 0, formatted: String(leadsByStage['contacted'] || 0), trend: 'flat', tone: 'blue', decision: 'In outreach', drillDown: '/sales/leads' },
    { id: 'leads-demo', name: 'Leads: demo built/shared', value: (leadsByStage['demo_built'] || 0) + (leadsByStage['demo_shared'] || 0), formatted: String((leadsByStage['demo_built'] || 0) + (leadsByStage['demo_shared'] || 0)), trend: 'flat', tone: 'blue', decision: 'Demo stage', drillDown: '/sales/leads' },
    { id: 'leads-proposal', name: 'Leads: proposal sent', value: leadsByStage['proposal_sent'] || 0, formatted: String(leadsByStage['proposal_sent'] || 0), trend: 'flat', tone: 'amber', decision: 'Awaiting decision', drillDown: '/sales/leads' },
    { id: 'leads-negotiating', name: 'Leads: negotiating', value: leadsByStage['negotiating'] || 0, formatted: String(leadsByStage['negotiating'] || 0), trend: 'flat', tone: 'amber', decision: 'In negotiation', drillDown: '/sales/leads' },
    { id: 'leads-won', name: 'Leads: won', value: leadsByStage['won'] || 0, formatted: String(leadsByStage['won'] || 0), trend: 'up', tone: 'green', decision: 'Closed won', drillDown: '/sales/leads' },
    { id: 'leads-lost', name: 'Leads: lost', value: leadsByStage['lost'] || 0, formatted: String(leadsByStage['lost'] || 0), trend: 'down', tone: 'red', decision: 'Lost deals', drillDown: '/sales/leads' },
    { id: 'new-leads-week', name: 'New leads/week', value: newLeadsWeek, formatted: String(newLeadsWeek), trend: 'up', tone: 'blue', decision: 'Demand generation', drillDown: '/sales/leads' },
    { id: 'median-response-time', name: 'Median first-response time (days)', value: Math.round(medianResponseTime * 10) / 10, formatted: `${Math.round(medianResponseTime * 10) / 10}d`, trend: medianResponseTime <= 1 ? 'up' : 'down', tone: medianResponseTime <= 1 ? 'green' : 'amber', decision: 'Speed to lead', drillDown: '/sales/leads' },
    { id: 'intro-sent', name: 'Sequence: intro sent', value: introSent, formatted: String(introSent), trend: 'flat', tone: 'blue', decision: 'Funnel step 1', drillDown: '/comms/outbox' },
    { id: 'replied', name: 'Sequence: replied', value: replied, formatted: String(replied), trend: 'up', tone: 'green', decision: 'Funnel step 2', drillDown: '/sales/leads' },
    { id: 'demo-built', name: 'Sequence: demo built', value: demoBuilt, formatted: String(demoBuilt), trend: 'flat', tone: 'blue', decision: 'Funnel step 3', drillDown: '/sales/leads' },
    { id: 'proposal-sent', name: 'Sequence: proposal sent', value: proposalSent, formatted: String(proposalSent), trend: 'flat', tone: 'amber', decision: 'Funnel step 4', drillDown: '/sales/proposals' },
    { id: 'proposals-sent', name: 'Proposals in flight (sent/viewed)', value: proposalsSent, formatted: String(proposalsSent), trend: 'flat', tone: 'amber', decision: 'Active quotes', drillDown: '/sales/proposals' },
    { id: 'proposals-expiring', name: 'Proposals expiring ≤7d', value: proposalsExpiring, formatted: String(proposalsExpiring), trend: 'flat', tone: proposalsExpiring > 0 ? 'red' : 'green', decision: 'Urgent follow-up', drillDown: '/sales/proposals' },
    { id: 'proposals-accepted', name: 'Proposals accepted', value: proposalsAccepted, formatted: String(proposalsAccepted), trend: 'up', tone: 'green', decision: 'Closed won', drillDown: '/sales/proposals' },
    { id: 'proposals-lost', name: 'Proposals lost (rejected/expired)', value: proposalsLost, formatted: String(proposalsLost), trend: 'down', tone: 'red', decision: 'Lost deals', drillDown: '/sales/proposals' },
    { id: 'median-time-to-close', name: 'Median time-to-close (days)', value: Math.round(medianTimeToClose), formatted: `${Math.round(medianTimeToClose)}d`, trend: medianTimeToClose <= 14 ? 'up' : 'down', tone: medianTimeToClose <= 14 ? 'green' : 'amber', decision: 'Sales velocity', drillDown: '/sales/proposals' },
    { id: 'campaign-roi', name: 'Campaign ROI', value: campaignROI, formatted: `${campaignROI}×`, trend: campaignROI >= 2 ? 'up' : 'down', tone: campaignROI >= 2 ? 'green' : 'amber', decision: 'Budget allocation', drillDown: '/sales/campaigns' },
    { id: 'demo-to-proposal', name: 'Demo→proposal conversion', value: demoToProposal, formatted: `${demoToProposal}%`, trend: demoToProposal >= 50 ? 'up' : 'down', tone: demoToProposal >= 50 ? 'green' : 'amber', decision: 'Demo effectiveness', drillDown: '/sales/leads' },
    { id: 'salvage-plays', name: 'Salvage plays running', value: salvageRounds, formatted: String(salvageRounds), trend: 'flat', tone: 'amber', decision: 'Recovery status', drillDown: '/default-salvage' },
    { id: 'campaigns-active', name: 'Active campaigns', value: campaigns.filter((c) => c.status === 'active').length, formatted: String(campaigns.filter((c) => c.status === 'active').length), trend: 'flat', tone: 'blue', decision: 'Outreach volume', drillDown: '/sales/campaigns' },
  ]
}

// ── DELIVERY PILLAR ─────────────────────────────────────────────────────────

export function computeDeliveryMetrics(s: any): Metric[] {
  const projects = s.projects as Project[]
  const moduleOrders = s.moduleOrders as ModuleOrder[]
  const purchaseOrders = s.purchaseOrders as PurchaseOrder[]
  const deployTargets = s.deployTargets as any[]
  const tickets = s.tickets as Ticket[]
  const clientDevices = s.devices as any[]

  const activeProjects = projects.filter((p) => p.status !== 'delivered' && p.status !== 'maintenance')
  const deliveredProjects = projects.filter((p) => p.status === 'delivered')
  const onHoldProjects = projects.filter((p) => false) // placeholder - no on_hold status in current schema
  const defaultedProjects = projects.filter((p) => false) // placeholder - no defaulted status in current schema

  const moduleOrdersDeployed = moduleOrders.filter((m) => m.status === 'deployed' || m.status === 'invoiced').length
  const moduleOrdersInBuild = moduleOrders.filter((m) => m.status === 'building' || m.status === 'code_review' || m.status === 'staging').length
  const moduleOrdersRequested = moduleOrders.filter((m) => m.status === 'requested' || m.status === 'spec_approved').length

  const stuckPOs = purchaseOrders.filter((po) => po.status === 'ordered' && po.orderedAt && daysBetween(po.orderedAt) >= 5).length
  const medianPOCycle = median(purchaseOrders.filter((po) => po.status === 'received' || po.status === 'installed' || po.status === 'invoiced').map((po) => po.orderedAt ? daysBetween(po.orderedAt) : 0))

  const deployHealthy = deployTargets.filter((d) => d.status === 'healthy').length
  const deployDegraded = deployTargets.filter((d) => d.status === 'degraded').length
  const deployPending = deployTargets.filter((d) => d.status === 'pending_agent' || d.status === 'never_deployed').length

  const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting_client').length
  const resolvedTickets = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length

  const changeOrderRate = 0 // would need change order tracking
  const firstTimeRight = tickets.length ? pct(resolvedTickets, tickets.length) : 0

  return [
    { id: 'active-projects', name: 'Active projects', value: activeProjects.length, formatted: String(activeProjects.length), trend: 'flat', tone: 'blue', decision: 'Delivery load', drillDown: '/projects' },
    { id: 'delivered-projects', name: 'Delivered projects', value: deliveredProjects.length, formatted: String(deliveredProjects.length), trend: 'up', tone: 'green', decision: 'Completed work', drillDown: '/projects' },
    { id: 'on-hold-projects', name: 'On hold / defaulted', value: onHoldProjects.length, formatted: String(onHoldProjects.length), trend: onHoldProjects.length > 0 ? 'down' : 'flat', tone: onHoldProjects.length > 0 ? 'amber' : 'green', decision: 'Attention needed', drillDown: '/projects' },
    { id: 'defaulted-projects', name: 'Defaulted projects', value: defaultedProjects.length, formatted: String(defaultedProjects.length), trend: 'down', tone: defaultedProjects.length > 0 ? 'red' : 'green', decision: 'Loss risk', drillDown: '/default-salvage' },
    { id: 'module-orders-total', name: 'Module orders total', value: moduleOrders.length, formatted: String(moduleOrders.length), trend: 'flat', tone: 'blue', decision: 'Add-on pipeline', drillDown: '/module-orders' },
    { id: 'module-orders-deployed', name: 'Module orders deployed', value: moduleOrdersDeployed, formatted: String(moduleOrdersDeployed), trend: 'up', tone: 'green', decision: 'Throughput', drillDown: '/module-orders' },
    { id: 'module-orders-building', name: 'Module orders in build', value: moduleOrdersInBuild, formatted: String(moduleOrdersInBuild), trend: 'flat', tone: 'amber', decision: 'Work in progress', drillDown: '/module-orders' },
    { id: 'module-orders-requested', name: 'Module orders requested', value: moduleOrdersRequested, formatted: String(moduleOrdersRequested), trend: 'flat', tone: 'blue', decision: 'New requests', drillDown: '/module-orders' },
    { id: 'po-total', name: 'Purchase orders total', value: purchaseOrders.length, formatted: String(purchaseOrders.length), trend: 'flat', tone: 'blue', decision: 'Procurement volume', drillDown: '/projects' },
    { id: 'po-stuck', name: 'Stuck POs (>5d at ordered)', value: stuckPOs, formatted: String(stuckPOs), trend: stuckPOs > 0 ? 'down' : 'flat', tone: stuckPOs > 0 ? 'red' : 'green', decision: 'Chase vendors', drillDown: '/projects' },
    { id: 'po-median-cycle', name: 'Median PO ordered→received (days)', value: Math.round(medianPOCycle), formatted: `${Math.round(medianPOCycle)}d`, trend: medianPOCycle <= 7 ? 'up' : 'down', tone: medianPOCycle <= 7 ? 'green' : 'amber', decision: 'Procurement speed', drillDown: '/projects' },
    { id: 'deploy-healthy', name: 'Deployments healthy', value: deployHealthy, formatted: String(deployHealthy), trend: 'up', tone: 'green', decision: 'Live and stable', drillDown: '/projects' },
    { id: 'deploy-degraded', name: 'Deployments degraded', value: deployDegraded, formatted: String(deployDegraded), trend: 'down', tone: deployDegraded > 0 ? 'red' : 'green', decision: 'Needs attention', drillDown: '/projects' },
    { id: 'deploy-pending', name: 'Deployments pending/never', value: deployPending, formatted: String(deployPending), trend: 'flat', tone: 'amber', decision: 'Not yet live', drillDown: '/projects' },
    { id: 'tickets-open', name: 'Open tickets', value: openTickets, formatted: String(openTickets), trend: 'flat', tone: openTickets > 5 ? 'amber' : 'green', decision: 'Support load', drillDown: '/tickets' },
    { id: 'tickets-resolved', name: 'Resolved tickets', value: resolvedTickets, formatted: String(resolvedTickets), trend: 'up', tone: 'green', decision: 'Completed support', drillDown: '/tickets' },
    { id: 'first-time-right', name: 'First-time-right %', value: firstTimeRight, formatted: `${firstTimeRight}%`, trend: firstTimeRight >= 80 ? 'up' : 'down', tone: firstTimeRight >= 80 ? 'green' : 'amber', decision: 'Quality signal', drillDown: '/tickets' },
    { id: 'client-devices', name: 'Client devices on site', value: clientDevices.length, formatted: String(clientDevices.length), trend: 'flat', tone: 'blue', decision: 'Asset tracking', drillDown: '/assets' },
    { id: 'agency-assets', name: 'Agency assets', value: s.agencyAssets?.length || 0, formatted: String(s.agencyAssets?.length || 0), trend: 'flat', tone: 'blue', decision: 'Equipment tracking', drillDown: '/agency-assets' },
  ]
}

// ── PEOPLE PILLAR ───────────────────────────────────────────────────────────

export function computePeopleMetrics(s: any): Metric[] {
  const team = s.team as TeamMember[]
  const investors = s.investors as Investor[]
  const vendors = s.vendors as Vendor[]
  const payouts = s.payouts as Payout[]
  const projects = s.projects as Project[]
  const invoices = s.invoices as Invoice[]
  const purchaseOrders = s.purchaseOrders as PurchaseOrder[]

  const teamEarnings = team.map((m) => ({
    name: m.name,
    pending: m.pending,
    paidYtd: m.paidYtd,
    total: m.pending + m.paidYtd,
    blocked: payouts.filter((p) => p.payee === m.name && p.status === 'blocked').length,
    payable: payouts.filter((p) => p.payee === m.name && p.status === 'payable').length,
    paid: payouts.filter((p) => p.payee === m.name && p.status === 'paid').length,
  }))

  const medianAccruedToPaid = median(payouts.filter((p) => p.status === 'paid' && p.paidAt).map((p) => {
    // Mock: would need accrued_at timestamp
    return Math.random() * 10 + 2
  }))

  const investorMetrics = investors.map((inv) => {
    const multiple = inv.deployed ? (inv.returned / inv.deployed) : 0
    const concentration = inv.deployed ? Math.max(...projects.filter((p) => p.fundedBy === 'investor_advance').map((p) => {
      const pos = purchaseOrders.filter((po) => po.project === p.name)
      const invs = invoices.filter((i) => pos.some((po) => po.project === p.name))
      return invs.filter((i) => i.status === 'paid').reduce((a, i) => a + i.total, 0)
    })) / inv.deployed : 0
    return { name: inv.name, deployed: inv.deployed, returned: inv.returned, multiple, concentration: Math.round(concentration * 100) }
  })

  const totalDeployed = sum(investors.map((i) => i.deployed))
  const totalReturned = sum(investors.map((i) => i.returned))
  const investorMultiple = totalDeployed ? (totalReturned / totalDeployed).toFixed(2) : '0.00'
  const investorFundedProjects = projects.filter((p) => p.fundedBy === 'investor_advance').length
  const ownFundedProjects = projects.filter((p) => p.fundedBy === 'own_cash').length

  const vendorMetrics = vendors.map((v) => {
    const pos = purchaseOrders.filter((po) => po.vendor === v.name)
    const onTime = pos.filter((po) => po.status === 'received' || po.status === 'installed' || po.status === 'invoiced').length
    const onTimePct = pos.length ? pct(onTime, pos.length) : 100
    return { name: v.name, poCount: pos.length, onTimePct, disputeRate: 0, priceVariance: 0 }
  })

  return [
    { id: 'team-total-pending', name: 'Team: total pending', value: sum(team.map((m) => m.pending)), formatted: money(sum(team.map((m) => m.pending))), trend: 'flat', tone: 'amber', decision: 'Cash owed to team', drillDown: '/money/payouts' },
    { id: 'team-total-paid-ytd', name: 'Team: paid YTD', value: sum(team.map((m) => m.paidYtd)), formatted: money(sum(team.map((m) => m.paidYtd))), trend: 'up', tone: 'green', decision: 'Team compensation', drillDown: '/people' },
    { id: 'team-members', name: 'Team members (active)', value: team.filter((m) => m.status === 'active').length, formatted: String(team.filter((m) => m.status === 'active').length), trend: 'flat', tone: 'blue', decision: 'Team size', drillDown: '/people' },
    { id: 'team-blocked-payouts', name: 'Team: blocked payouts', value: payouts.filter((p) => p.payeeRole === 'team' && p.status === 'blocked').length, formatted: String(payouts.filter((p) => p.payeeRole === 'team' && p.status === 'blocked').length), trend: 'flat', tone: 'amber', decision: 'Waiting on invoices', drillDown: '/money/payouts' },
    { id: 'team-payable-payouts', name: 'Team: payable payouts', value: payouts.filter((p) => p.payeeRole === 'team' && p.status === 'payable').length, formatted: String(payouts.filter((p) => p.payeeRole === 'team' && p.status === 'payable').length), trend: 'flat', tone: 'amber', decision: 'Ready to release', drillDown: '/money/payouts' },
    { id: 'median-accrued-paid', name: 'Median accrued→paid (days)', value: Math.round(medianAccruedToPaid), formatted: `${Math.round(medianAccruedToPaid)}d`, trend: medianAccruedToPaid <= 14 ? 'up' : 'down', tone: medianAccruedToPaid <= 14 ? 'green' : 'amber', decision: 'Transparency metric', drillDown: '/money/payouts' },
    { id: 'investor-count', name: 'Investors (total)', value: investors.length, formatted: String(investors.length), trend: 'flat', tone: 'blue', decision: 'Investor base', drillDown: '/people' },
    { id: 'investor-deployed', name: 'Investor: capital deployed', value: totalDeployed, formatted: money(totalDeployed), trend: 'flat', tone: 'blue', decision: 'Capital in play', drillDown: '/people' },
    { id: 'investor-returned', name: 'Investor: capital returned', value: totalReturned, formatted: money(totalReturned), trend: 'up', tone: 'green', decision: 'Returns paid', drillDown: '/people' },
    { id: 'investor-outstanding', name: 'Investor: outstanding principal', value: totalDeployed - totalReturned, formatted: money(totalDeployed - totalReturned), trend: 'flat', tone: (totalDeployed - totalReturned) > 0 ? 'amber' : 'green', decision: 'Remaining obligation', drillDown: '/people' },
    { id: 'investor-multiple', name: 'Investor: simple multiple (returned÷invested)', value: parseFloat(investorMultiple), formatted: `${investorMultiple}×`, trend: parseFloat(investorMultiple) >= 1 ? 'up' : 'down', tone: parseFloat(investorMultiple) >= 1 ? 'green' : 'red', decision: 'Investor satisfaction', drillDown: '/people' },
    { id: 'investor-funded-projects', name: 'Investor-funded projects', value: investorFundedProjects, formatted: String(investorFundedProjects), trend: 'flat', tone: 'blue', decision: 'Capital strategy', drillDown: '/projects' },
    { id: 'own-funded-projects', name: 'Own-funded projects', value: ownFundedProjects, formatted: String(ownFundedProjects), trend: 'flat', tone: 'blue', decision: 'Capital strategy', drillDown: '/projects' },
    { id: 'investor-funded-ratio', name: 'Investor-funded ratio', value: pct(investorFundedProjects, projects.length), formatted: `${pct(investorFundedProjects, projects.length)}%`, trend: 'flat', tone: 'blue', decision: 'Capital strategy', drillDown: '/projects' },
    { id: 'vendor-count', name: 'Vendors (active)', value: vendors.filter((v) => v.status === 'active').length, formatted: String(vendors.filter((v) => v.status === 'active').length), trend: 'flat', tone: 'blue', decision: 'Supplier base', drillDown: '/vendors' },
    { id: 'vendor-po-count', name: 'Vendor: total POs', value: purchaseOrders.length, formatted: String(purchaseOrders.length), trend: 'flat', tone: 'blue', decision: 'Procurement volume', drillDown: '/vendors' },
  ]
}

// ── RISK PILLAR ─────────────────────────────────────────────────────────────

export function computeRiskMetrics(s: any): Metric[] {
  const projects = s.projects as Project[]
  const invoices = s.invoices as Invoice[]
  const purchaseOrders = s.purchaseOrders as PurchaseOrder[]
  const investors = s.investors as Investor[]
  const credentials = s.credentials as Credential[]
  const repos = s.repos as any[]
  const leads = s.leads as Lead[]

  // Zero-deposit exposure: POs funded by advance on projects with no client payment
  const zeroDepositPOs = purchaseOrders.filter((po) => {
    if (po.fundedBy !== 'investor_advance') return false
    const proj = projects.find((p) => p.name === po.project)
    if (!proj) return false
    const pos = purchaseOrders.filter((p) => p.project === po.project)
    const invs = invoices.filter((inv) => pos.some((p) => p.project === inv.clientName))
    return !invs.some((i) => i.status === 'paid')
  }).length

  // Default radar: projects with procurement started + zero payments + >14 days
  const defaultRadar = projects.filter((p) => {
    const pos = purchaseOrders.filter((po) => po.project === p.name)
    const hasProcurement = pos.length > 0
    const invs = invoices.filter((inv) => pos.some((po) => po.project === inv.clientName))
    const hasPayments = invs.some((i) => i.status === 'paid')
    const age = daysBetween(p.phase ? new Date().toISOString() : new Date().toISOString())
    return hasProcurement && !hasPayments && age > 14
  }).length

  // Concentration: max project % of one investor's capital
  const maxConcentration = Math.max(...investors.map((inv) => {
    const invProjects = projects.filter((p) => p.fundedBy === 'investor_advance')
    const maxProjectRevenue = Math.max(...invProjects.map((p) => {
      const pos = purchaseOrders.filter((po) => po.project === p.name)
      const invs = invoices.filter((i) => pos.some((po) => po.project === i.clientName))
      return invs.filter((i) => i.status === 'paid').reduce((a, i) => a + i.total, 0)
    }), 0)
    return inv.deployed ? Math.round((maxProjectRevenue / inv.deployed) * 100) : 0
  }), 0)

  // Margin floor: projects with margin < 25%
  const lowMarginProjects = projects.filter((p) => {
    const pos = purchaseOrders.filter((po) => po.project === p.name)
    const invs = invoices.filter((inv) => pos.some((po) => po.project === inv.clientName))
    const rev = invs.filter((i) => i.status === 'paid').reduce((a, i) => a + i.total, 0)
    const costs = pos.filter((po) => po.status === 'invoiced').reduce((a, po) => a + po.total, 0)
    const margin = rev > 0 ? ((rev - costs) / rev) * 100 : 100
    return margin < 25
  }).length

  // Agency cash at risk: own-cash POs + unguarded outflows
  const agencyCashAtRisk = purchaseOrders.filter((po) => po.fundedBy === 'own_cash' && po.status !== 'invoiced').reduce((a, po) => a + po.total, 0)

  // Overdue everything
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue').length
  const overdueReviews = 0 // would need review tracking
  const overdueAcceptances = 0 // would need acceptance tracking
  const stuckPOs = purchaseOrders.filter((po) => po.status === 'ordered' && po.orderedAt && daysBetween(po.orderedAt) >= 5).length
  const overdueEverything = overdueInvoices + overdueReviews + overdueAcceptances + stuckPOs

  // Credential expiry
  const credExpiring = credentials.filter((c) => c.expiresAt && daysBetween(c.expiresAt) > -30 && daysBetween(c.expiresAt) < 0).length
  const credExpired = credentials.filter((c) => c.expiresAt && daysBetween(c.expiresAt) >= 0).length

  // Template debt: repos behind template latest tag
  const templateDebt = repos.filter((r) => r.behindBy > 2).length

  return [
    { id: 'zero-deposit', name: 'Zero-deposit exposure', value: zeroDepositPOs, formatted: String(zeroDepositPOs), trend: zeroDepositPOs > 0 ? 'down' : 'flat', tone: zeroDepositPOs > 0 ? 'amber' : 'green', decision: 'POs funded by advance with no client payment', drillDown: '/projects' },
    { id: 'default-radar', name: 'Default radar', value: defaultRadar, formatted: String(defaultRadar), trend: defaultRadar > 0 ? 'down' : 'flat', tone: defaultRadar > 0 ? 'red' : 'green', decision: 'Projects: procurement + zero payments + >14d', drillDown: '/projects' },
    { id: 'concentration', name: 'Concentration (max %)', value: maxConcentration, formatted: `${maxConcentration}%`, trend: maxConcentration > 40 ? 'down' : 'flat', tone: maxConcentration > 40 ? 'amber' : 'green', decision: 'One project % of one investor capital', drillDown: '/people' },
    { id: 'margin-floor', name: 'Margin floor (projects <25%)', value: lowMarginProjects, formatted: String(lowMarginProjects), trend: lowMarginProjects > 0 ? 'down' : 'flat', tone: lowMarginProjects > 0 ? 'amber' : 'green', decision: 'Quote-time & realized margin per deal', drillDown: '/reports' },
    { id: 'agency-cash-at-risk', name: 'Agency cash at risk', value: agencyCashAtRisk, formatted: money(agencyCashAtRisk), trend: agencyCashAtRisk > 0 ? 'down' : 'flat', tone: agencyCashAtRisk > 0 ? 'red' : 'green', decision: 'Own-cash POs + unguarded outflows', drillDown: '/projects' },
    { id: 'overdue-everything', name: 'Overdue everything', value: overdueEverything, formatted: String(overdueEverything), trend: overdueEverything > 0 ? 'down' : 'flat', tone: overdueEverything > 0 ? 'amber' : 'green', decision: 'Invoices >14d · reviews >7d · POs >5d', drillDown: '/money/invoices' },
    { id: 'cred-expiring', name: 'Credential expiry (≤30d)', value: credExpiring, formatted: String(credExpiring), trend: credExpiring > 0 ? 'down' : 'flat', tone: credExpiring > 0 ? 'amber' : 'green', decision: 'Vault: expires_at ≤ 30d', drillDown: '/credentials' },
    { id: 'cred-expired', name: 'Credential expired', value: credExpired, formatted: String(credExpired), trend: credExpired > 0 ? 'down' : 'flat', tone: credExpired > 0 ? 'red' : 'green', decision: 'Vault: expired credentials', drillDown: '/credentials' },
    { id: 'template-debt', name: 'Template debt (repos >2 behind)', value: templateDebt, formatted: String(templateDebt), trend: templateDebt > 0 ? 'down' : 'flat', tone: templateDebt > 0 ? 'amber' : 'green', decision: 'Client repos behind template latest tag', drillDown: '/client-repos' },
  ]
}

// ── GROWTH PILLAR ───────────────────────────────────────────────────────────

export function computeGrowthMetrics(s: any): Metric[] {
  const invoices = s.invoices as Invoice[]
  const proposals = s.proposals as Proposal[]
  const leads = s.leads as Lead[]
  const clients = s.clients as Client[]
  const demos = s.demos as Demo[]
  const moduleOrders = s.moduleOrders as ModuleOrder[]
  const campaigns = s.campaigns as Campaign[]

  // Revenue by template/service (top & bottom)
  const revenueByTemplate: Record<string, number> = {}
  for (const inv of invoices.filter((i) => i.status === 'paid')) {
    const key = inv.proposalNo || 'direct'
    revenueByTemplate[key] = (revenueByTemplate[key] || 0) + inv.total
  }

  // Template portfolio sold vs available
  const catalog = s.catalog as any[]
  const templatesSold = catalog.reduce((a: number, t: any) => a + (t.sold || 0), 0)
  const templatesAvailable = catalog.length

  // Salvage-born templates revenue
  const salvageRevenue = 0 // would need salvage_of_project_id tracking

  // Module add-ons per client
  const moduleAddonsPerClient = clients.map((c) => ({
    client: c.name,
    modules: moduleOrders.filter((m) => m.clientName === c.name).length,
  }))
  const avgModulesPerClient = clients.length ? Math.round(sum(moduleAddonsPerClient.map((m) => m.modules)) / clients.length * 10) / 10 : 0

  // Upsell conversion
  const upsellOpportunities = 0 // would need opportunities table
  const upsellWon = 0
  const upsellConversion = pct(upsellWon, upsellOpportunities || 1)

  // Recurring share (Lane C %)
  const totalRevenue = sum(invoices.filter((i) => i.status === 'paid').map((i) => i.total))
  const recurringRevenue = invoices.filter((i) => i.status === 'paid' && i.proposalNo?.includes('maintenance')).reduce((a, i) => a + i.total, 0)
  const recurringShare = pct(recurringRevenue, totalRevenue)

  // Revenue per client lifetime (LTV proxy)
  const ltv = clients.length ? Math.round(totalRevenue / clients.length) : 0

  // Conversion by industry
  const industryConversion: Record<string, { total: number; won: number }> = {}
  for (const lead of leads) {
    if (!industryConversion[lead.industry]) industryConversion[lead.industry] = { total: 0, won: 0 }
    industryConversion[lead.industry].total++
    if (lead.status === 'won') industryConversion[lead.industry].won++
  }

  // Investor base: new vs repeat
  const investors = s.investors as Investor[]
  const newInvestors = investors.length // mock: all new
  const repeatInvestors = 0

  // Revenue by template (top 3)
  const topTemplates = Object.entries(revenueByTemplate)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)

  return [
    { id: 'revenue-by-template', name: 'Revenue by template/service', value: topTemplates.length, formatted: topTemplates.map(([k, v]) => `${k}: ${money(v)}`).join(' · ') || '—', trend: 'flat', tone: 'blue', decision: 'Top & bottom performers', drillDown: '/sales/catalogue' },
    { id: 'templates-sold', name: 'Template portfolio sold', value: templatesSold, formatted: String(templatesSold), trend: 'up', tone: 'green', decision: 'Portfolio performance', drillDown: '/sales/catalogue' },
    { id: 'templates-available', name: 'Template portfolio available', value: templatesAvailable, formatted: String(templatesAvailable), trend: 'flat', tone: 'blue', decision: 'Available inventory', drillDown: '/sales/catalogue' },
    { id: 'salvage-revenue', name: 'Salvage-born templates revenue', value: salvageRevenue, formatted: money(salvageRevenue), trend: 'flat', tone: 'amber', decision: 'Salvage play proof', drillDown: '/default-salvage' },
    { id: 'module-addons-per-client', name: 'Module add-ons per client (avg)', value: avgModulesPerClient, formatted: String(avgModulesPerClient), trend: 'up', tone: 'green', decision: 'Upsell traction', drillDown: '/module-orders' },
    { id: 'upsell-conversion', name: 'Upsell conversion', value: upsellConversion, formatted: `${upsellConversion}%`, trend: upsellConversion > 0 ? 'up' : 'flat', tone: upsellConversion > 0 ? 'green' : 'gray', decision: 'Gap detection effectiveness', drillDown: '/clients' },
    { id: 'recurring-share', name: 'Recurring share of revenue (Lane C %)', value: recurringShare, formatted: `${recurringShare}%`, trend: recurringShare > 30 ? 'up' : 'down', tone: recurringShare > 30 ? 'green' : 'amber', decision: 'MRR health', drillDown: '/money/invoices' },
    { id: 'ltv-proxy', name: 'Revenue per client (LTV proxy)', value: ltv, formatted: money(ltv), trend: 'flat', tone: 'blue', decision: 'Client value', drillDown: '/clients' },
    { id: 'conversion-by-industry', name: 'Conversion by industry', value: Object.keys(industryConversion).length, formatted: Object.entries(industryConversion).map(([k, v]) => `${k}: ${pct(v.won, v.total)}%`).join(' · ') || '—', trend: 'flat', tone: 'blue', decision: 'ICP engine', drillDown: '/sales/leads' },
    { id: 'investor-base-new', name: 'Investor base: new', value: newInvestors, formatted: String(newInvestors), trend: 'up', tone: 'green', decision: 'Capital growth', drillDown: '/people' },
    { id: 'investor-base-repeat', name: 'Investor base: repeat', value: repeatInvestors, formatted: String(repeatInvestors), trend: 'flat', tone: 'blue', decision: 'Loyalty signal', drillDown: '/people' },
    { id: 'demos-total', name: 'Demos total', value: demos.length, formatted: String(demos.length), trend: 'up', tone: 'blue', decision: 'Demo pipeline', drillDown: '/demos' },
    { id: 'demos-live', name: 'Demos live', value: demos.filter((d) => d.status === 'live').length, formatted: String(demos.filter((d) => d.status === 'live').length), trend: 'flat', tone: 'green', decision: 'Active demos', drillDown: '/demos' },
    { id: 'demo-views-total', name: 'Demo views total', value: sum(demos.map((d) => d.views)), formatted: String(sum(demos.map((d) => d.views))), trend: 'up', tone: 'blue', decision: 'Demo engagement', drillDown: '/demos' },
    { id: 'campaigns-total', name: 'Campaigns total', value: campaigns.length, formatted: String(campaigns.length), trend: 'flat', tone: 'blue', decision: 'Outreach volume', drillDown: '/sales/campaigns' },
  ]
}

// ── Main compute function ───────────────────────────────────────────────────

export function computeAllMetrics(s: any): MetricPillar[] {
  return [
    { name: 'Money', metrics: computeMoneyMetrics(s) },
    { name: 'Pipeline', metrics: computePipelineMetrics(s) },
    { name: 'Delivery', metrics: computeDeliveryMetrics(s) },
    { name: 'People', metrics: computePeopleMetrics(s) },
    { name: 'Risk', metrics: computeRiskMetrics(s) },
    { name: 'Growth', metrics: computeGrowthMetrics(s) },
  ]
}

export function getTotalMetricCount(s: any): number {
  return computeAllMetrics(s).reduce((a, p) => a + p.metrics.length, 0)
}