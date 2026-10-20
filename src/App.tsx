import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Today } from './pages/Today'
import { Dashboard } from './pages/Dashboard'
import { LeadsBoard } from './pages/LeadsBoard'
import { LeadDetail } from './pages/LeadDetail'
import { ProposalsBoard } from './pages/ProposalsBoard'
import { ProposalBuilder } from './pages/ProposalBuilder'
import { Campaigns } from './pages/Campaigns'
import { Clients } from './pages/Clients'
import { ClientDetail } from './pages/ClientDetail'
import { Projects } from './pages/Projects'
import { Vendors } from './pages/Vendors'
import { Assets } from './pages/Assets'
import { Invoices } from './pages/Invoices'
import { Payouts } from './pages/Payouts'
import { People } from './pages/People'
import { Catalogue } from './pages/Catalogue'
import { Outbox } from './pages/Outbox'
import { Templates } from './pages/Templates'
import { Calendar } from './pages/Calendar'
import { Settings } from './pages/Settings'

type NavItem = { to: string; label: string; exact?: boolean }

const GROUPS: { title: string; items: NavItem[] }[] = [
  { title: '', items: [
    { to: '/', label: '☀ Today', exact: true },
    { to: '/dashboard', label: '◧ Dashboard' },
  ]},
  { title: 'Sales', items: [
    { to: '/sales/leads', label: 'Leads' },
    { to: '/sales/proposals', label: 'Proposals' },
    { to: '/sales/campaigns', label: 'Campaigns' },
    { to: '/sales/catalogue', label: 'Catalogue' },
  ]},
  { title: '', items: [{ to: '/clients', label: '👥 Clients' }] },
  { title: 'Delivery', items: [
    { to: '/projects', label: 'Projects' },
    { to: '/vendors', label: 'Vendors' },
    { to: '/assets', label: 'Assets' },
  ]},
  { title: 'Money', items: [
    { to: '/money/invoices', label: 'Invoices' },
    { to: '/money/payouts', label: 'Payouts' },
  ]},
  { title: 'People', items: [{ to: '/people', label: 'Team & investors' }] },
  { title: 'Comms', items: [
    { to: '/comms/outbox', label: 'Outbox' },
    { to: '/comms/templates', label: 'Templates' },
  ]},
  { title: '', items: [
    { to: '/calendar', label: '▦ Calendar' },
    { to: '/settings', label: '⚙ Settings' },
  ]},
]

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation()
  return (
    <nav className="flex flex-col gap-5 py-4">
      <div className="px-3">
        <div className="text-sm font-bold tracking-tight text-gray-900">Agency OS</div>
        <span className="mt-1 inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5 text-[11px] font-medium">
          Solo mode
        </span>
      </div>
      {GROUPS.map((group, gi) => (
        <div key={gi}>
          {group.title && (
            <div className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {group.title}
            </div>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.exact}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-1.5 text-sm transition ${
                      isActive || (item.to !== '/' && location.pathname.startsWith(item.to))
                        ? 'bg-gray-900 text-white font-medium'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function App() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-56 shrink-0 bg-white border-r border-gray-200 sticky top-0 h-screen overflow-y-auto">
        <Sidebar />
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 pb-24 md:pb-10">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sales/leads" element={<LeadsBoard />} />
            <Route path="/sales/leads/:id" element={<LeadDetail />} />
            <Route path="/sales/proposals" element={<ProposalsBoard />} />
            <Route path="/sales/proposals/new" element={<ProposalBuilder />} />
            <Route path="/sales/campaigns" element={<Campaigns />} />
            <Route path="/sales/catalogue" element={<Catalogue />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:id" element={<ClientDetail />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/money/invoices" element={<Invoices />} />
            <Route path="/money/payouts" element={<Payouts />} />
            <Route path="/people" element={<People />} />
            <Route path="/comms/outbox" element={<Outbox />} />
            <Route path="/comms/templates" element={<Templates />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex text-[11px]">
        {[
          { to: '/', label: 'Today' },
          { to: '/sales/leads', label: 'Leads' },
          { to: '/money/invoices', label: 'Money' },
          { to: '/comms/outbox', label: 'Outbox' },
          { to: '/settings', label: 'More' },
        ].map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.to === '/'}
            className={({ isActive }) =>
              `flex-1 py-2.5 text-center ${isActive ? 'text-blue-600 font-semibold' : 'text-gray-500'}`
            }
          >
            {i.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
