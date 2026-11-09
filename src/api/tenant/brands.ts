import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'

/** A brand and the teams that promote it. Products join with their module. */
export interface Brand {
  id: number
  name: string
  products_count: number
  products: { id: number; name: string }[]
  teams?: { id: number; name: string }[]
  uses?: Record<string, number>
  created_at: string | null
}

export interface BrandPayload {
  name?: string
  teams?: number[]
}

const one = (request: Promise<{ data: { data: Brand } }>) => request.then((response) => response.data.data)

export const fetchBrands = (params?: ListParams) =>
  client.get<{ data: Brand[]; meta: { total: number } }>('/brands', { params })
    .then((response): Page<Brand> => ({ items: response.data.data, total: response.data.meta.total }))
export const fetchBrand = (id: number) => one(client.get(`/brands/${id}`))
export const createBrand = (body: BrandPayload) => one(client.post('/brands', body))
export const updateBrand = (id: number, body: BrandPayload) => one(client.put(`/brands/${id}`, body))
export const deleteBrand = (id: number) => client.delete(`/brands/${id}`)

/** Every brand at once, for checklists and filters. */
export async function fetchAllBrands(): Promise<Brand[]> {
  return (await fetchBrands({ per_page: 100, sort: 'name' })).items
}
