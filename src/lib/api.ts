// ── API Client — connects frontend to the Hono backend ────────────────────
// When the backend is available, these functions replace the mock store.
// TanStack Query wraps these for caching, refetching, and optimistic updates.

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'API error')
  }
  return res.json()
}

// ── Leads ──────────────────────────────────────────────────────────────────
export const leadsApi = {
  list: () => apiFetch<any[]>('/api/leads'),
  get: (id: number) => apiFetch<any>(`/api/leads/${id}`),
  create: (data: any) => apiFetch<any>('/api/leads', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<any>(`/api/leads/${id}`, { method: 'DELETE' }),
}

// ── Clients ────────────────────────────────────────────────────────────────
export const clientsApi = {
  list: () => apiFetch<any[]>('/api/clients'),
  get: (id: number) => apiFetch<any>(`/api/clients/${id}`),
  create: (data: any) => apiFetch<any>('/api/clients', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<any>(`/api/clients/${id}`, { method: 'DELETE' }),
}

// ── Vendors ────────────────────────────────────────────────────────────────
export const vendorsApi = {
  list: () => apiFetch<any[]>('/api/vendors'),
  create: (data: any) => apiFetch<any>('/api/vendors', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<any>(`/api/vendors/${id}`, { method: 'DELETE' }),
}

// ── Projects ───────────────────────────────────────────────────────────────
export const projectsApi = {
  list: () => apiFetch<any[]>('/api/projects'),
  create: (data: any) => apiFetch<any>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<any>(`/api/projects/${id}`, { method: 'DELETE' }),
}

// ── Invoices ────────────────────────────────────────────────────────────────
export const invoicesApi = {
  list: () => apiFetch<any[]>('/api/invoices'),
  create: (data: any) => apiFetch<any>('/api/invoices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<any>(`/api/invoices/${id}`, { method: 'DELETE' }),
}

// ── Payouts ────────────────────────────────────────────────────────────────
export const payoutsApi = {
  list: () => apiFetch<any[]>('/api/payouts'),
  create: (data: any) => apiFetch<any>('/api/payouts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/payouts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<any>(`/api/payouts/${id}`, { method: 'DELETE' }),
}

// ── Campaigns ──────────────────────────────────────────────────────────────
export const campaignsApi = {
  list: () => apiFetch<any[]>('/api/campaigns'),
  create: (data: any) => apiFetch<any>('/api/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => apiFetch<any>(`/api/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<any>(`/api/campaigns/${id}`, { method: 'DELETE' }),
}

// ── Settings ───────────────────────────────────────────────────────────────
export const settingsApi = {
  list: () => apiFetch<any[]>('/api/settings'),
  update: (key: string, value: string) => apiFetch<any>(`/api/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
}

// ── GitHub Integration ─────────────────────────────────────────────────────
export const githubApi = {
  listRepos: () => apiFetch<any[]>('/api/github/repos'),
  getRepo: (owner: string, repo: string) => apiFetch<any>(`/api/github/repos/${owner}/${repo}`),
  syncCatalogue: () => apiFetch<any>('/api/github/sync-catalogue', { method: 'POST' }),
  listReleases: (owner: string, repo: string) => apiFetch<any[]>(`/api/github/releases/${owner}/${repo}`),
  getLatestRelease: (owner: string, repo: string) => apiFetch<any>(`/api/github/releases/${owner}/${repo}/latest`),
  listIssues: (owner: string, repo: string, state?: string) => apiFetch<any[]>(`/api/github/issues/${owner}/${repo}${state ? `?state=${state}` : ''}`),
  createIssue: (owner: string, repo: string, data: any) => apiFetch<any>(`/api/github/issues/${owner}/${repo}`, { method: 'POST', body: JSON.stringify(data) }),
  listPRs: (owner: string, repo: string, state?: string) => apiFetch<any[]>(`/api/github/prs/${owner}/${repo}${state ? `?state=${state}` : ''}`),
  createPR: (owner: string, repo: string, data: any) => apiFetch<any>(`/api/github/prs/${owner}/${repo}`, { method: 'POST', body: JSON.stringify(data) }),
  mergePR: (owner: string, repo: string, number: number) => apiFetch<any>(`/api/github/prs/${owner}/${repo}/${number}/merge`, { method: 'POST' }),
  createDemoRepo: (data: any) => apiFetch<any>('/api/github/demo-repo', { method: 'POST', body: JSON.stringify(data) }),
  enablePages: (owner: string, repo: string, source: any) => apiFetch<any>(`/api/github/pages/${owner}/${repo}`, { method: 'POST', body: JSON.stringify({ source }) }),
  getUser: () => apiFetch<any>('/api/github/user'),
}