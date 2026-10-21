// ── React Query hooks for API data ────────────────────────────────────────
// These hooks replace useAppState() for entities that have backend endpoints.
// The mock store is still the fallback when VITE_USE_API is not set.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leadsApi, clientsApi, vendorsApi, projectsApi, invoicesApi, payoutsApi, campaignsApi } from '../lib/api'

const USE_API = import.meta.env.VITE_USE_API === 'true'

// ── Leads ──────────────────────────────────────────────────────────────────
export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: leadsApi.list,
    enabled: USE_API,
  })
}

export function useLead(id: number) {
  return useQuery({
    queryKey: ['leads', id],
    queryFn: () => leadsApi.get(id),
    enabled: USE_API && !!id,
  })
}

// ── Clients ────────────────────────────────────────────────────────────────
export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: clientsApi.list,
    enabled: USE_API,
  })
}

// ── Vendors ────────────────────────────────────────────────────────────────
export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: vendorsApi.list,
    enabled: USE_API,
  })
}

// ── Projects ───────────────────────────────────────────────────────────────
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
    enabled: USE_API,
  })
}

// ── Invoices ───────────────────────────────────────────────────────────────
export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: invoicesApi.list,
    enabled: USE_API,
  })
}

// ── Payouts ────────────────────────────────────────────────────────────────
export function usePayouts() {
  return useQuery({
    queryKey: ['payouts'],
    queryFn: payoutsApi.list,
    enabled: USE_API,
  })
}

// ── Campaigns ──────────────────────────────────────────────────────────────
export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: campaignsApi.list,
    enabled: USE_API,
  })
}

// ── Mutations ──────────────────────────────────────────────────────────────
export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: leadsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => leadsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}

export function useDeleteLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => leadsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  })
}