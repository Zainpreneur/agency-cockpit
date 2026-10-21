import { useState } from 'react'
import { PageHeader, SectionCard, EmptyRow, Stat } from '../components/Layout'
import { Chip, StatusChip } from '../components/StatusChip'
import { DataTable, exportToCSV } from '../components/PipelineBoard'
import { useAppState } from '../lib/store'
import { money, dateShort } from '../lib/format'

// Branch type (doc 9)
type Branch = {
  id: number
  name: string
  businessId: number
  businessName: string
  address: string
  city: string
  manager: string
  status: 'active' | 'inactive' | 'onboarding'
  posCount: number
  revenue: number
}

// Mock data for multi-branch
const MOCK_BRANCHES: Branch[] = [
  { id: 1, name: 'Main Branch', businessId: 1, businessName: 'Desert Carwash', address: 'King Fahd Rd', city: 'Riyadh', manager: 'Majed', status: 'active', posCount: 3, revenue: 28500 },
  { id: 2, name: 'North Branch', businessId: 1, businessName: 'Desert Carwash', address: 'Olaya St', city: 'Riyadh', manager: 'Ahmed', status: 'active', posCount: 2, revenue: 19200 },
  { id: 3, name: 'East Branch', businessId: 1, businessName: 'Desert Carwash', address: 'King Abdulaziz Rd', city: 'Dammam', manager: 'Khalid', status: 'active', posCount: 2, revenue: 15800 },
  { id: 4, name: 'West Branch', businessId: 1, businessName: 'Desert Carwash', address: 'Jeddah Corniche', city: 'Jeddah', manager: 'Sara', status: 'active', posCount: 3, revenue: 22100 },
  { id: 5, name: 'South Branch', businessId: 1, businessName: 'Desert Carwash', address: 'King Khalid Rd', city: 'Riyadh', manager: 'Omar', status: 'inactive', posCount: 1, revenue: 8500 },
  { id: 6, name: 'Main Branch', businessId: 2, businessName: 'Alnoor Hotel', address: 'Alnoor St', city: 'Jeddah', manager: 'Faisal', status: 'active', posCount: 5, revenue: 45000 },
  { id: 7, name: 'North Branch', businessId: 2, businessName: 'Alnoor Hotel', address: 'Al Tahliya', city: 'Riyadh', manager: 'Reem', status: 'active', posCount: 2, revenue: 18700 },
  { id: 8, name: 'Main Branch', businessId: 3, businessName: 'Gulf Spa', address: 'Tahlia St', city: 'Riyadh', manager: 'Reem', status: 'active', posCount: 2, revenue: 12500 },
  { id: 9, name: 'Dammam Branch', businessId: 4, businessName: 'Aqua Pets', address: 'Corniche', city: 'Dammam', manager: 'Hala', status: 'onboarding', posCount: 0, revenue: 0 },
]

export function MultiBranch() {
  const s = useAppState()
  const [selectedBusiness, setSelectedBusiness] = useState<number | null>(null)

  const filtered = selectedBusiness
    ? MOCK_BRANCHES.filter((b) => b.businessId === selectedBusiness)
    : MOCK_BRANCHES

  const businesses = [...new Set(MOCK_BRANCHES.map((b) => ({ id: b.businessId, name: b.businessName })))]

  const totalRevenue = filtered.reduce((a, b) => a + b.revenue, 0)
  const totalPos = filtered.reduce((a, b) => a + b.posCount, 0)

  const TABLE_COLUMNS = [
    { key: 'name', label: 'Branch', render: (b: Branch) => (
      <div>
        <div className="font-medium text-gray-900">{b.name}</div>
        <div className="text-xs text-gray-400">{b.address}</div>
      </div>
    ) },
    { key: 'businessName', label: 'Business', render: (b: Branch) => (
      <span className="text-gray-700">{b.businessName}</span>
    ), groupable: true },
    { key: 'city', label: 'City', render: (b: Branch) => (
      <span className="text-gray-600">{b.city}</span>
    ) },
    { key: 'manager', label: 'Manager', render: (b: Branch) => (
      <span className="text-gray-600">{b.manager}</span>
    ) },
    { key: 'posCount', label: 'POS Count', render: (b: Branch) => (
      <span className="tabular-nums text-gray-600">{b.posCount}</span>
    ), align: 'right' as const },
    { key: 'revenue', label: 'Revenue', render: (b: Branch) => (
      <span className="tabular-nums font-medium">{money(b.revenue)}</span>
    ), align: 'right' as const, sortable: true },
    { key: 'status', label: 'Status', render: (b: Branch) => (
      <StatusChip status={b.status} />
    ), groupable: true },
  ]

  return (
    <>
      <PageHeader
        title="Multi-Branch"
        subtitle="Multi-branch clients (doc 9) — branches are data, not deployments. (business_id, branch_id) scoping."
      />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setSelectedBusiness(null)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${selectedBusiness === null ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
          >
            All
          </button>
          {businesses.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBusiness(b.id)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${selectedBusiness === b.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Branches" value={String(filtered.length)} />
        <Stat label="Active" value={String(filtered.filter((b) => b.status === 'active').length)} tone="green" />
        <Stat label="POS Units" value={String(totalPos)} />
        <Stat label="Total Revenue" value={money(totalRevenue)} tone="green" />
      </div>

      <DataTable
        columns={TABLE_COLUMNS}
        items={filtered}
        getId={(b) => b.id}
        defaultSort={{ key: 'revenue', direction: 'desc' }}
        onExportCSV={(items) => exportToCSV(items, TABLE_COLUMNS, 'branches')}
        exportFilename="branches"
      />
    </>
  )
}