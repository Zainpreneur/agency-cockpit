import type { AppState } from './types'
import { d } from './format'

// Seed data built from the plan's running scenarios (doc 19 Alnoor POS,
// Aqua Pets booking site, Desert Carwash, Gulf Spa…). Dates are relative to
// load time so queues always look live.

export const mockData: AppState = {
  seq: 500,

  leads: [
    { id: 1, businessName: 'Alnoor Hotel', contactName: 'Faisal Alnoor', phone: '+966 55 010 4411', email: 'faisal@alnoorhotel.sa', source: 'referral', industry: 'hotel', city: 'Jeddah', status: 'negotiating', lastInboundAt: d(0), lastOutboundAt: d(-2), nextFollowUpAt: d(1), notes: 'Wants POS across 2 restaurants. Existing salon project in Riyadh → sister business.' },
    { id: 2, businessName: 'Aqua Pets', contactName: 'Noura Saad', phone: '+966 50 223 8890', email: 'noura@aquapets.sa', source: 'whatsapp_chat', industry: 'pet shop', city: 'Riyadh', status: 'proposal_sent', lastInboundAt: d(-3), lastOutboundAt: d(-2), nextFollowUpAt: d(0), notes: 'Booking + boarding reservations. Quote expires in 2 days.' },
    { id: 3, businessName: 'Desert Carwash', contactName: 'Majed', phone: '+966 55 778 1020', email: 'majed@desertcarwash.sa', source: 'google_maps', industry: 'carwash', city: 'Riyadh', status: 'contacted', lastOutboundAt: d(-3), nextFollowUpAt: d(1) },
    { id: 4, businessName: 'Gulf Spa', contactName: 'Reem', phone: '+966 53 445 9012', email: 'reem@gulfspa.sa', source: 'inbound', industry: 'salon', city: 'Riyadh', status: 'demo_shared', lastOutboundAt: d(-6), nextFollowUpAt: d(2) },
    { id: 5, businessName: 'Furniture Mart', contactName: 'Yousef', phone: '+966 54 101 3344', email: 'yousef@furnituremart.sa', source: 'referral', industry: 'furniture', city: 'Dammam', status: 'discovered', nextFollowUpAt: d(3) },
    { id: 6, businessName: 'Ocean Treats', contactName: 'Hala', phone: '+966 56 300 7788', email: 'hala@oceantreats.sa', source: 'whatsapp_chat', industry: 'restaurant', city: 'Jeddah', status: 'contacted', lastOutboundAt: d(-1), nextFollowUpAt: d(4) },
  ],

  proposals: [
    {
      id: 1, no: 'PROP-2026-014', leadId: 1, leadName: 'Alnoor Hotel',
      listPrice: 12000, offeredPrice: 10000, cost: 5400,
      discountReason: 'Repeat client — sister business already with us',
      status: 'accepted', validUntil: d(-1), createdAt: d(-6),
      lines: [
        { description: 'POS software (Restaurant Suite)', qty: 1, unitPrice: 6000 },
        { description: 'POS terminals + printers package', qty: 1, unitPrice: 4000 },
      ],
    },
    {
      id: 2, no: 'PROP-2026-015', leadId: 2, leadName: 'Aqua Pets',
      listPrice: 3500, offeredPrice: 3000, cost: 1400,
      status: 'sent', validUntil: d(2), createdAt: d(-4),
      lines: [
        { description: 'Booking website (Standard variant)', qty: 1, unitPrice: 2400 },
        { description: 'WhatsApp updates add-on', qty: 1, unitPrice: 600 },
      ],
      maintenanceMonthly: 150,
    },
    {
      id: 3, no: 'PROP-2026-016', leadId: 6, leadName: 'Ocean Treats',
      listPrice: 2200, offeredPrice: 2200, cost: 900,
      status: 'draft', validUntil: d(14), createdAt: d(0),
      lines: [{ description: 'Digital menu + ordering (Basic variant)', qty: 1, unitPrice: 2200 }],
    },
  ],

  invoices: [
    {
      id: 38, no: 'INV-38', clientName: 'Desert Carwash', total: 2400,
      status: 'overdue', dueAt: d(-16),
      lines: [{ description: 'Booking module — final payment', qty: 1, unitPrice: 2400 }],
    },
    {
      id: 42, no: 'INV-42', clientName: 'Alnoor Hotel', proposalNo: 'PROP-2026-014', total: 5000,
      status: 'sent', dueAt: d(3),
      lines: [{ description: 'POS deployment — milestone 2 of 2', qty: 1, unitPrice: 5000 }],
    },
    {
      id: 44, no: 'INV-44', clientName: 'Gulf Spa', total: 1200,
      status: 'paid', dueAt: d(-5), paidAt: d(-5), paidVia: 'tap',
      lines: [{ description: 'Booking site — deposit', qty: 1, unitPrice: 1200 }],
    },
    {
      id: 45, no: 'INV-45', clientName: 'Gulf Spa', total: 1500,
      status: 'draft', dueAt: d(14),
      lines: [{ description: 'Booking site — final payment', qty: 1, unitPrice: 1500 }],
    },
  ],

  payments: [
    { id: 1, invoiceId: 44, provider: 'tap', amount: 1200, paidAt: d(-5), reference: 'pi_3Ok441' },
  ],

  payouts: [
    { id: 7, payee: 'Ahmed', payeeRole: 'investor', kind: 'investor_return', amount: 1300, status: 'payable', triggerInvoiceId: 44, note: 'September return — INV-44 paid' },
    { id: 8, payee: 'Omar', payeeRole: 'team', kind: 'delivery', amount: 1200, status: 'paid', triggerInvoiceId: 44, paidAt: d(-5) },
    { id: 9, payee: 'Omar', payeeRole: 'team', kind: 'delivery', amount: 500, status: 'blocked', triggerInvoiceId: 42, note: 'Alnoor POS deployment fee' },
    { id: 10, payee: 'Ahmed', payeeRole: 'investor', kind: 'investor_principal', amount: 3000, status: 'blocked', triggerInvoiceId: 42, note: 'Salvage round tranche — waiting on INV-42' },
    { id: 11, payee: 'Khalid', payeeRole: 'team', kind: 'milestone', amount: 800, status: 'blocked', triggerInvoiceId: 38, note: 'Carwash module milestone — INV-38 is overdue' },
  ],

  outbox: [
    { id: 1, contactableName: 'Aqua Pets', stakeholder: 'lead', templateCode: 'proposal_followup', subject: 'Following up on your booking site quote', body: 'Hi Noura,\n\nJust following up on the quote we sent for your booking site — it expires in a couple of days, happy to walk you through it or adjust anything.\n\nBest,\nZain', dueAt: d(0), status: 'ready' },
    { id: 2, contactableName: 'Desert Carwash', stakeholder: 'client', templateCode: 'invoice_reminder_1', subject: 'Friendly reminder — INV-38', body: 'Hi Majed,\n\nA quick reminder that invoice INV-38 (SAR 2,400) was due on ' + new Date(Date.now() - 16 * 86400000).toLocaleDateString('en-GB') + '. You can pay by link or bank transfer — details below.\n\nThank you,\nZain', dueAt: d(0), status: 'ready' },
    { id: 3, contactableName: 'Omar', stakeholder: 'team', templateCode: 'assignment_brief', subject: 'New assignment — Alnoor POS deployment', body: 'Hi Omar,\n\nNew assignment: deploy Alnoor Hotel POS to their office VPS. Spec, access, and flat fee (SAR 500 on client payment) attached in the brief.\n\nZain', dueAt: d(0), status: 'ready' },
    { id: 4, contactableName: 'Alnoor Hotel', stakeholder: 'client', templateCode: 'milestone_update', subject: 'Update — POS deployment underway', body: 'Hi Faisal,\n\nQuick update: hardware is on order and deployment prep has started. You will get a walkthrough invitation once it is live.\n\nZain', dueAt: d(1), status: 'scheduled' },
    { id: 5, contactableName: 'Ahmed', stakeholder: 'investor', templateCode: 'investor_monthly', subject: 'Your October position', body: 'Hi Ahmed,\n\nYour position: deployed SAR 20,000 · returned SAR 15,500 · current SAR 4,500 across Alnoor salvage and Gulf Spa.\n\nFull breakdown on request.\nZain', dueAt: d(3), status: 'scheduled' },
    { id: 6, contactableName: 'Desert Carwash', stakeholder: 'lead', templateCode: 'lead_followup_1', subject: 'Checking in', body: 'Hi Majed,\n\nFollowing up on the booking module we discussed. Anything unclear, happy to send a quick demo link.\n\nZain', dueAt: d(-3), status: 'sent' },
    { id: 7, contactableName: 'Gulf Spa', stakeholder: 'lead', templateCode: 'demo_ready', subject: 'Your demo is ready', body: 'Hi Reem,\n\nYour demo is ready to view — no login needed: [demo link]\n\nZain', dueAt: d(-6), status: 'sent' },
  ],

  commsLog: [
    { id: 1, contactableName: 'Alnoor Hotel', channel: 'email', direction: 'out', snippet: 'proposal_send — PROP-2026-014, SAR 10,000', at: d(-6), templateCode: 'proposal_send' },
    { id: 2, contactableName: 'Alnoor Hotel', channel: 'email', direction: 'in', snippet: 'Looks good — send us the invoice, we will pay this week.', at: d(-2) },
    { id: 3, contactableName: 'Alnoor Hotel', channel: 'email', direction: 'out', snippet: 'invoice_send — INV-42, SAR 5,000', at: d(-2), templateCode: 'invoice_send' },
    { id: 4, contactableName: 'Alnoor Hotel', channel: 'email', direction: 'in', snippet: 'One question — does the package include the second terminal?', at: d(0) },
    { id: 5, contactableName: 'Aqua Pets', channel: 'email', direction: 'out', snippet: 'proposal_send — PROP-2026-015, SAR 3,000', at: d(-4), templateCode: 'proposal_send' },
    { id: 6, contactableName: 'Aqua Pets', channel: 'email', direction: 'in', snippet: 'Studying it with the family, will confirm soon.', at: d(-3) },
    { id: 7, contactableName: 'Aqua Pets', channel: 'email', direction: 'out', snippet: 'Checking in on next steps', at: d(-2) },
    { id: 8, contactableName: 'Desert Carwash', channel: 'email', direction: 'out', snippet: 'lead_followup_1', at: d(-3), templateCode: 'lead_followup_1' },
    { id: 9, contactableName: 'Gulf Spa', channel: 'email', direction: 'out', snippet: 'demo_ready — demo link sent', at: d(-6), templateCode: 'demo_ready' },
    { id: 10, contactableName: 'Desert Carwash', channel: 'email', direction: 'out', snippet: 'invoice_reminder_1 — INV-38 overdue', at: d(-15), templateCode: 'invoice_reminder_1' },
  ],

  statusEvents: [],

  commsTemplates: [
    { code: 'lead_intro', stakeholder: 'lead', stage: 'discovered → contacted', subject: 'Quick hello from Zainpreneur', body: 'Hi {name},\n\nI saw {business} and had an idea that could bring you more customers online. Worth a 2-minute look?\n\nZain', followupTemplateCode: 'lead_followup_1', followupAfterDays: 3 },
    { code: 'lead_followup_1', stakeholder: 'lead', stage: 'contacted', subject: 'Following up', body: 'Hi {name},\n\nFollowing up on my last note — happy to send a quick demo of what your site could look like.\n\nZain', followupTemplateCode: 'lead_followup_2', followupAfterDays: 5 },
    { code: 'lead_followup_2', stakeholder: 'lead', stage: 'contacted', subject: 'Last note from me', body: 'Hi {name},\n\nLast note from my side — if the timing is wrong, no worries at all. I will check back next quarter.\n\nZain' },
    { code: 'proposal_send', stakeholder: 'lead', stage: 'proposal_sent', subject: 'Your proposal from Zainpreneur', body: 'Hi {name},\n\nYour proposal is ready: {proposal_no} — {amount}. Valid until {valid_until}.\n\nHappy to walk you through it.\nZain', followupTemplateCode: 'proposal_followup', followupAfterDays: 3 },
    { code: 'proposal_followup', stakeholder: 'lead', stage: 'proposal_sent', subject: 'Following up on your quote', body: 'Hi {name},\n\nJust following up on the quote — happy to answer any questions or adjust the scope.\n\nZain', followupTemplateCode: 'proposal_losing_interest', followupAfterDays: 5 },
    { code: 'proposal_losing_interest', stakeholder: 'lead', stage: 'negotiating', subject: 'Anything I can clarify?', body: 'Hi {name},\n\nAnything I can clarify on the proposal? If it is out of budget we can phase the work.\n\nZain' },
    { code: 'demo_ready', stakeholder: 'lead', stage: 'demo_shared', subject: 'Your demo is ready', body: 'Hi {name},\n\nYour demo is ready to view — no login needed: {demo_link}\n\nZain', followupTemplateCode: 'demo_followup', followupAfterDays: 3 },
    { code: 'demo_followup', stakeholder: 'lead', stage: 'demo_shared', subject: 'What did you think of the demo?', body: 'Hi {name},\n\nWhat did you think of the demo? Anything you would change?\n\nZain' },
    { code: 'invoice_send', stakeholder: 'client', stage: 'invoice', subject: 'Invoice {invoice_no}', body: 'Hi {name},\n\nInvoice {invoice_no} for {amount} is ready. Pay by link or bank transfer — details inside.\n\nThank you,\nZain', followupTemplateCode: 'invoice_reminder_1', followupAfterDays: 7 },
    { code: 'invoice_reminder_1', stakeholder: 'client', stage: 'invoice_overdue', subject: 'Friendly reminder — {invoice_no}', body: 'Hi {name},\n\nA quick reminder that {invoice_no} ({amount}) was due on {due_date}. Let me know if anything is blocking payment.\n\nThank you,\nZain', followupTemplateCode: 'invoice_reminder_2', followupAfterDays: 7 },
    { code: 'invoice_reminder_2', stakeholder: 'client', stage: 'invoice_overdue', subject: 'Second reminder — {invoice_no}', body: 'Hi {name},\n\nFollowing up again on {invoice_no} ({amount}). If there is an issue on your side, happy to talk it through.\n\nZain', followupTemplateCode: 'invoice_final_notice', followupAfterDays: 7 },
    { code: 'invoice_final_notice', stakeholder: 'client', stage: 'invoice_overdue', subject: 'Final reminder — {invoice_no}', body: 'Hi {name},\n\nFinal reminder for {invoice_no} ({amount}). After this we will need to pause support and deployment work until it is settled.\n\nZain' },
    { code: 'payment_received_thanks', stakeholder: 'client', stage: 'invoice_paid', subject: 'Payment received — thank you', body: 'Hi {name},\n\nPayment for {invoice_no} received — thank you! Next milestone work kicks off now.\n\nZain' },
    { code: 'milestone_update', stakeholder: 'client', stage: 'delivery', subject: 'Update — {project}', body: 'Hi {name},\n\nQuick update on {project}: {progress}. Next step: {next_step}.\n\nZain', followupTemplateCode: 'milestone_update', followupAfterDays: 7 },
    { code: 'deployment_ready', stakeholder: 'client', stage: 'deployment', subject: 'Your site is live', body: 'Hi {name},\n\n{project} is live at {url}. Login details and a 2-minute walkthrough video are attached — nothing technical needed.\n\nZain' },
    { code: 'acceptance_request', stakeholder: 'client', stage: 'delivery', subject: 'Ready to approve {project}?', body: 'Hi {name},\n\n{project} is ready for your approval. Reply "accepted" and we will invoice the final milestone.\n\nZain' },
    { code: 'assignment_brief', stakeholder: 'team', stage: 'assignment', subject: 'New assignment — {project}', body: 'Hi {name},\n\nNew assignment: {deliverable}. Flat fee {fee} on client payment. Spec and access details below.\n\nZain', followupTemplateCode: 'task_checkin', followupAfterDays: 3 },
    { code: 'task_checkin', stakeholder: 'team', stage: 'assignment', subject: 'Check-in — {project}', body: 'Hi {name},\n\nQuick check-in on {deliverable} — on track for {deadline}?\n\nZain' },
    { code: 'payout_released', stakeholder: 'team', stage: 'payout', subject: 'Payout released', body: 'Hi {name},\n\nYour payout of {amount} for {deliverable} has been released. Thank you — good work.\n\nZain' },
    { code: 'intake_request', stakeholder: 'client', stage: 'intake', subject: 'Two quick questions before we start', body: 'Hi {name},\n\nBefore we start {project}, reply to this email with:\n\n1. What do you sell?\n2. Who are your customers?\n3. What should customers be able to do online? (book / order / pay / see prices / contact / track)\n4. Which of those matters most?\n5. Anything else?\n\nZain', followupTemplateCode: 'intake_reminder', followupAfterDays: 3 },
    { code: 'intake_reminder', stakeholder: 'client', stage: 'intake', subject: 'Those quick questions 🙂', body: 'Hi {name},\n\nJust nudging on the 5 questions from my last email — one-line answers are perfect.\n\nZain' },
    { code: 'investor_new_round', stakeholder: 'investor', stage: 'funding', subject: 'New funding round — {project}', body: 'Hi {name},\n\nNew round open for {project}: target {target}, {rule}. You get first look as a prior backer.\n\nZain', followupTemplateCode: 'investor_reminder', followupAfterDays: 4 },
    { code: 'investor_reminder', stakeholder: 'investor', stage: 'funding', subject: 'Round closing soon — {project}', body: 'Hi {name},\n\nThe {project} round closes {deadline} — happy to answer any questions before you decide.\n\nZain' },
    { code: 'investor_monthly', stakeholder: 'investor', stage: 'monthly', subject: 'Your monthly position', body: 'Hi {name},\n\nYour position: deployed {deployed} · returned {returned} · current {current}.\n\nFull breakdown on request.\nZain', followupTemplateCode: 'investor_quarterly', followupAfterDays: 30 },
    { code: 'investor_quarterly', stakeholder: 'investor', stage: 'quarterly', subject: 'Quarterly summary', body: 'Hi {name},\n\nQuarterly summary: {summary}. I will send the detailed ledger whenever you want it.\n\nZain' },
    { code: 'vendor_po', stakeholder: 'vendor', stage: 'procurement', subject: 'Purchase order {po_no}', body: 'Hi {name},\n\nPurchase order {po_no} for {amount}. Please confirm lead time and send a proforma invoice.\n\nZain', followupTemplateCode: 'vendor_chase', followupAfterDays: 5 },
    { code: 'vendor_chase', stakeholder: 'vendor', stage: 'procurement', subject: 'Order status — {po_no}', body: 'Hi {name},\n\nChecking status on {po_no} — our client is waiting on this delivery.\n\nZain' },
    { code: 'vendor_receipt_request', stakeholder: 'vendor', stage: 'procurement', subject: 'Receipt for {po_no}', body: 'Hi {name},\n\nCould you send the receipt/invoice for {po_no}? I need it for my records.\n\nZain' },
    { code: 'deployment_complete', stakeholder: 'team', stage: 'deployment', subject: 'Deployment closed — {project}', body: 'Hi {name},\n\nDeployment for {project} is closed and verified. Your payout flips payable as soon as the client pays.\n\nZain' },
    { code: 'deposit_received', stakeholder: 'client', stage: 'deposit', subject: 'Deposit received — we are a go', body: 'Hi {name},\n\nDeposit received — we are a go. Procurement and scheduling start now; first update comes within the week.\n\nZain' },
    { code: 'intake_received', stakeholder: 'client', stage: 'intake', subject: 'Got it — thanks', body: 'Hi {name},\n\nPerfect, that is all I needed. Scope confirmed — we start now.\n\nZain' },
  ],

  catalog: [
    {
      id: 1, name: 'Hotel Suite', hue: 212, fromPrice: 8000, sold: 3,
      variants: [
        { code: 'basic', name: 'Basic', price: 8000, cost: 4400, deliveryDays: 21 },
        { code: 'standard', name: 'Standard', price: 12000, cost: 6600, deliveryDays: 30 },
        { code: 'premium', name: 'Premium', price: 18000, cost: 9900, deliveryDays: 42 },
      ],
      attributes: [
        { code: 'pages', name: 'Pages', values: [
          { code: 'p5', name: '5 pages', priceExtra: 0 },
          { code: 'p8', name: '8 pages', priceExtra: 800 },
          { code: 'p12', name: '12 pages', priceExtra: 1500 },
        ]},
        { code: 'languages', name: 'Languages', values: [
          { code: 'ar', name: 'Arabic', priceExtra: 0 },
          { code: 'en', name: 'English', priceExtra: 0 },
          { code: 'ar_en', name: 'Arabic + English', priceExtra: 900 },
        ]},
        { code: 'pos_terminal', name: 'POS terminals', values: [
          { code: 'none', name: 'No terminals', priceExtra: 0 },
          { code: 'one', name: '1 terminal', priceExtra: 1500 },
          { code: 'two', name: '2 terminals', priceExtra: 2800 },
        ]},
        { code: 'online_ordering', name: 'Online ordering', values: [
          { code: 'off', name: 'No', priceExtra: 0 },
          { code: 'pickup', name: 'Pickup only', priceExtra: 1200 },
          { code: 'delivery', name: 'With delivery', priceExtra: 2400, excludedWith: ['pos_terminal=none'] },
        ]},
      ],
    },
    {
      id: 2, name: 'Carwash Pro', hue: 158, fromPrice: 5000, sold: 5,
      variants: [
        { code: 'basic', name: 'Basic', price: 5000, cost: 2800, deliveryDays: 14 },
        { code: 'standard', name: 'Standard', price: 7500, cost: 4100, deliveryDays: 21 },
        { code: 'premium', name: 'Premium', price: 11000, cost: 6000, deliveryDays: 30 },
      ],
      attributes: [
        { code: 'branches', name: 'Branches', values: [
          { code: 'b1', name: '1 branch', priceExtra: 0 },
          { code: 'b2', name: '2 branches', priceExtra: 1800 },
          { code: 'b3', name: '3+ branches', priceExtra: 3200 },
        ]},
        { code: 'addons', name: 'Add-ons', values: [
          { code: 'none', name: 'None', priceExtra: 0 },
          { code: 'waitsms', name: 'Wait-time SMS', priceExtra: 700 },
          { code: 'loyalty', name: 'Loyalty cards', priceExtra: 1100 },
        ]},
      ],
    },
    {
      id: 3, name: 'Restaurant Delight', hue: 32, fromPrice: 4000, sold: 2,
      variants: [
        { code: 'basic', name: 'Basic', price: 4000, cost: 2200, deliveryDays: 12 },
        { code: 'standard', name: 'Standard', price: 6500, cost: 3600, deliveryDays: 18 },
        { code: 'premium', name: 'Premium', price: 9500, cost: 5200, deliveryDays: 26 },
      ],
      attributes: [
        { code: 'menu', name: 'Menu style', values: [
          { code: 'static', name: 'Static menu', priceExtra: 0 },
          { code: 'qr', name: 'QR ordering', priceExtra: 900 },
          { code: 'full', name: 'Full ordering + payments', priceExtra: 2100 },
        ]},
        { code: 'reservation', name: 'Reservations', values: [
          { code: 'no', name: 'Not needed', priceExtra: 0 },
          { code: 'yes', name: 'Table reservations', priceExtra: 1300 },
        ]},
      ],
    },
  ],

  deployTargets: [
    { id: 1, name: 'alnoor-pos', clientName: 'Alnoor Hotel', provider: 'office_vps', env: 'production', status: 'pending_agent', behindBy: 0, version: 'v1.2.0' },
    { id: 2, name: 'aqua-pets-site', clientName: 'Aqua Pets', provider: 'vercel', env: 'production', status: 'healthy', lastDeployAt: d(-2), behindBy: 2, version: 'v0.9.3' },
    { id: 3, name: 'desert-carwash', clientName: 'Desert Carwash', provider: 'hostinger_vps', env: 'production', status: 'degraded', lastDeployAt: d(-5), behindBy: 1, version: 'v2.0.1' },
  ],

  purchaseOrders: [
    {
      id: 7, no: 'PO-7', project: 'Alnoor POS deployment', vendor: 'Al-Rashid Trading',
      total: 9000, fundedBy: 'investor_advance', status: 'ordered', orderedAt: d(-6), assignee: 'Omar',
      items: [
        { description: 'POS terminal (thermal printer bundled)', qty: 2, unitCost: 3200 },
        { description: 'Cash drawer', qty: 2, unitCost: 650 },
        { description: 'Network cabling + setup kit', qty: 1, unitCost: 1300 },
      ],
    },
    {
      id: 5, no: 'PO-5', project: 'Ocean Treats menu site', vendor: 'TechSouq',
      total: 1800, fundedBy: 'own_cash', status: 'received', orderedAt: d(-3),
      items: [{ description: 'Tablet stands', qty: 6, unitCost: 300 }],
    },
  ],

  investors: [
    { id: 1, name: 'Ahmed', email: 'ahmed@example.com', deployed: 20000, returned: 15500 },
    { id: 2, name: 'Sara', email: 'sara@example.com', deployed: 10000, returned: 10500 },
  ],

  team: [
    { id: 1, name: 'Omar', email: 'omar@example.com', pending: 500, paidYtd: 8400 },
    { id: 2, name: 'Khalid', email: 'khalid@example.com', pending: 800, paidYtd: 5200 },
  ],

  credentials: [
    { id: 1, provider: 'Vercel', kind: 'api_key', masked: '••••••••••••7f2a', expiresAt: d(24), note: 'Deploy token — aqua-pets-site' },
    { id: 2, provider: 'Tap Payments', kind: 'api_key', masked: '••••••••••••c190', expiresAt: d(210), note: 'Payment links' },
    { id: 3, provider: 'Google (client-owned)', kind: 'oauth', masked: 'OAuth · scopes: business.manage', note: 'Alnoor Google Business Profile' },
    { id: 4, provider: 'Office VPS', kind: 'ssh_key', masked: 'ed25519 ·••••9d01', note: 'Root access — agent pending install' },
  ],

  devices: [
    { id: 1, clientName: 'Alnoor Hotel', kind: 'POS terminal', serial: 'POS-88412', imageHue: 212, warrantyUntil: d(360) },
    { id: 2, clientName: 'Alnoor Hotel', kind: 'Thermal printer', serial: 'PRN-2201', imageHue: 200, warrantyUntil: d(340) },
    { id: 3, clientName: 'Desert Carwash', kind: 'Card terminal', serial: 'CTM-5510', imageHue: 158, warrantyUntil: d(190) },
    { id: 4, clientName: 'Ocean Treats', kind: 'Tablet stand', serial: 'TST-0074', imageHue: 32, warrantyUntil: d(400) },
  ],

  repos: [
    { id: 1, name: 'alnoor-pos', clientName: 'Alnoor Hotel', behindBy: 0, version: 'v1.2.0' },
    { id: 2, name: 'aqua-pets-site', clientName: 'Aqua Pets', behindBy: 2, version: 'v0.9.3' },
    { id: 3, name: 'desert-carwash', clientName: 'Desert Carwash', behindBy: 1, version: 'v2.0.1' },
  ],

  fundingRounds: [
    { id: 1, project: 'Alnoor POS deployment', target: 20000, raised: 20000, rule: 'fixed', sourceKind: 'salvage_round', status: 'funded' },
    { id: 2, project: 'Ocean Treats menu site', target: 6000, raised: 3500, rule: 'multiple', sourceKind: 'new_capital', status: 'seeking' },
  ],
}
