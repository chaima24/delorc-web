import { client } from '@/api/client'
import type { Commune, ListParams, Page } from '@/api/tenant/geography'

/** Hospitals and clinics (docs/api/organisations.md). */
export type HcoType = 'hospital' | 'clinic'
export const HCO_TYPES: HcoType[] = ['hospital', 'clinic']

/** An organisation; a department is one with a parent. */
export interface Hco {
  id: number
  name: string
  type: HcoType
  phone: string | null
  commune_id: number
  address: string | null
  longitude: number | null
  latitude: number | null
  one_key_id: string
  parent_id: number | null
  /** Lists: professionals working there now, and departments. */
  hcps_count?: number
  children_count?: number
  /** Detail: professionals working there now, departments (this year's visits join with their module). */
  activity?: { hcps: number; departments: number; visits_year?: number }
  commune?: (Commune & { wilaya?: { id: number; name: string } }) | null
  parent?: { id: number; name: string } | null
  /** Detail: its departments, by name. */
  children?: Hco[]
  located_by?: { id: number; full_name: string } | null
  created_at: string | null
  updated_at?: string | null
}

export interface HcoPayload {
  name?: string
  type?: HcoType
  phone?: string | null
  commune_id?: number
  address?: string | null
  longitude?: number | null
  latitude?: number | null
  one_key_id?: string
  parent_id?: number | null
}

const one = (request: Promise<{ data: { data: Hco } }>) => request.then((response) => response.data.data)

export const fetchHcos = (params?: ListParams) =>
  client.get<{ data: Hco[]; meta: { total: number } }>('/hcos', { params })
    .then((response): Page<Hco> => ({ items: response.data.data, total: response.data.meta.total }))
/** { all, hospital, clinic } for the same filters as the list, without the type. */
export const fetchHcoTypeCounts = (params?: ListParams) =>
  client.get<{ data: Record<HcoType | 'all', number> }>('/hcos/type-counts', { params }).then((response) => response.data.data)
export const fetchHco = (id: number) => one(client.get(`/hcos/${id}`))
export const createHco = (body: HcoPayload) => one(client.post('/hcos', body))
export const updateHco = (id: number, body: HcoPayload) => one(client.put(`/hcos/${id}`, body))
export const deleteHco = (id: number) => client.delete(`/hcos/${id}`)

/** Every organisation, 100 at a time (for pickers). */
export async function fetchAllHcos(): Promise<Hco[]> {
  const rows: Hco[] = []
  for (let page = 1; ; page++) {
    const result = await fetchHcos({ page, per_page: 100, sort: 'name' })
    rows.push(...result.items)
    if (!result.items.length || rows.length >= result.total) return rows
  }
}
