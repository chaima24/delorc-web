import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'
import type { Person } from '@/api/tenant/campaigns'

/**
 * Module 13 (docs/api/materials.md): a campaign gives a material (type visit or event, a brand, specialities, a unit
 * cost) to the field people of its teams; each rep has their own stock line, which visits take from.
 */

export type MaterialType = 'visit' | 'event'
export interface StockCounts { people: number; quantity: number; carried: number; handed_out: number; left: number }

export interface StockLine {
  id: number
  user: Person | null
  team: string | null
  start_date: string
  end_date: string
  /** Given (without what was carried in). */
  quantity: number
  carried: number
  handed_out: number
  carried_out: number
  left: number
  budget_handed_out: number | null
}

export interface MaterialDistribution {
  id: number
  campaign: { id: number; code: string; name: string; start_date: string; end_date: string }
  materiel: { id: number; name: string; role: { id: number; name: string } | null }
  brand: { id: number; name: string }
  type: MaterialType
  specialities: { id: number; name: string }[]
  unit_cost: number | null
  period: 'campaign' | 'cycle'
  month: string | null
  leftover: 'stays' | 'ends'
  counts: StockCounts
  budget: { given: number | null; handed_out: number | null }
  /** Only on its page. */
  stocks?: StockLine[]
  created_by: Person | null
  created_at: string | null
}

export interface TabFigures { quantity: number; carried: number; handed_out: number; left: number; budget_given: number; budget_handed_out: number }

export interface MaterialRecipient {
  user_id: number
  name: string
  team: string | null
  role: string | null
  cycle: { id: number; start_date: string; end_date: string } | null
  /** Per-cycle mode: false when they have no cycle that month. */
  can: boolean
  /** What they still have of this material and brand (information). */
  still_has: number
}

export interface DistributionPayload {
  campaign_id?: number
  materiel_id?: number
  type?: MaterialType
  brand_id?: number
  month?: string | null
  speciality_ids?: number[]
  unit_cost?: number | null
  stocks?: { user_id: number; quantity: number }[]
}

export interface MaterialStock {
  id: number
  user: Person
  materiel: { id: number; name: string }
  brand: { id: number; name: string }
  campaign: { id: number; code: string; name: string }
  distribution_id: number
  type: MaterialType
  leftover: 'stays' | 'ends'
  start_date: string
  end_date: string
  quantity: number
  carried: number
  handed_out: number
  carried_out: number
  left: number
  /** Only from `fetchMaterialStock`: the visits it was handed out in. */
  visits?: { visit_id: number; date: string; target: string | null; quantity: number }[]
}

/** A line offered in a visit report: the rep's own stock for this professional on that day, one per campaign. */
export interface OfferedMaterial {
  material_stock_id: number
  materiel: string
  brand: string
  campaign: { id: number; code: string; name: string }
  end_date: string
  ended: boolean
  left: number
}

const one = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

export const fetchMaterialDistributions = (campaignId: number, params?: Record<string, string | undefined>) =>
  client.get<{ data: MaterialDistribution[]; meta: { figures: TabFigures } }>(`/campaigns/${campaignId}/material-distributions`, { params })
    .then((response) => ({ items: response.data.data, figures: response.data.meta.figures }))
export const fetchMaterialRecipients = (campaignId: number, params: { materiel_id: number; brand_id: number; type: MaterialType; month?: string | null }) =>
  client.get<{ data: MaterialRecipient[] }>(`/campaigns/${campaignId}/material-recipients`, { params }).then((response) => response.data.data)
export const fetchMaterialDistribution = (id: number) => one<MaterialDistribution>(client.get(`/material-distributions/${id}`))
export const createMaterialDistribution = (payload: DistributionPayload) => one<MaterialDistribution>(client.post('/material-distributions', payload))
export const updateMaterialDistribution = (id: number, payload: DistributionPayload) => one<MaterialDistribution>(client.put(`/material-distributions/${id}`, payload))
export const deleteMaterialDistribution = (id: number) => client.delete(`/material-distributions/${id}`)

export const fetchMaterialStocks = (params?: ListParams) =>
  client.get<{ data: MaterialStock[]; meta: { total: number } }>('/material-stocks', { params })
    .then((response): Page<MaterialStock> => ({ items: response.data.data, total: response.data.meta.total }))

export const fetchMaterialStock = (id: number) => one<MaterialStock>(client.get(`/material-stocks/${id}`))
export const fetchVisitMaterials = (params: { user_id?: number; visitable_type: 'hcp' | 'hco'; visitable_id: number; date: string; visit_id?: number | null }) =>
  client.get<{ data: OfferedMaterial[] }>('/visits/materials', { params }).then((response) => response.data.data)
