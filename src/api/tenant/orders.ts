import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'

/**
 * Orders, part 16a (docs/api/orders-setup.md). A pack is the screen's « Offre commerciale »: a period and its discount
 * brackets. A pack commande is the « Pack de commande »: a ready-made basket. The order itself comes in 16b.
 */

export type PackState = 'current' | 'upcoming' | 'ended' | 'off'

/** min ≤ order total < max (null = « et plus »): `discount` %, or `or_discount` % under the strategic threshold. */
export interface DiscountPack {
  id?: number
  min_threshold: number
  max_threshold: number | null
  discount: string | number
  or_discount: string | number
}

export interface Pack {
  id: number
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  state: PackState
  objective_budget: string | null
  target: string | null
  purchase_order_count: number | null
  /** Only on the page. */
  discount_packs?: DiscountPack[]
  /** Only on the list. */
  discount_packs_count?: number
  discount_min?: string | null
  discount_max?: string | null
  /** 0 until the orders (16b). */
  orders_count: number
  created_by?: { id: number; full_name: string } | null
  created_at: string | null
}

export interface PackPayload {
  name?: string
  start_date?: string
  end_date?: string
  is_active?: boolean
  objective_budget?: string | number | null
  target?: string | number | null
  purchase_order_count?: number | null
  discount_packs?: DiscountPack[]
}

export type ClientType = 'pharmacy' | 'wholesaler'

export interface PackCommandeLine {
  id?: number
  product: { id: number; name: string; ug_options: { id: number; ug: number }[] }
  quantity: number
  product_ug: { id: number; ug: number } | null
  is_modifiable: boolean
}

export interface PackCommande {
  id: number
  name: string
  description: string | null
  client_type: ClientType
  is_active: boolean
  /** Only on the page. */
  products?: PackCommandeLine[]
  /** Only on the list. */
  products_count?: number
  orders_count: number
  created_by?: { id: number; full_name: string } | null
  created_at: string | null
}

export interface PackCommandePayload {
  name?: string
  client_type?: ClientType
  description?: string | null
  is_active?: boolean
  products?: { product_id: number; quantity: number; product_ug_id: number | null; is_modifiable: boolean }[]
}

const one = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)
const page = <T>(request: Promise<{ data: { data: T[]; meta: { total: number } } }>) =>
  request.then((response): Page<T> => ({ items: response.data.data, total: response.data.meta.total }))

// Offres commerciales
export const fetchPacks = (params?: ListParams) => page<Pack>(client.get('/packs', { params }))
export const fetchPack = (id: number) => one<Pack>(client.get(`/packs/${id}`))
export const createPack = (payload: PackPayload) => one<Pack>(client.post('/packs', payload))
export const updatePack = (id: number, payload: PackPayload) => one<Pack>(client.put(`/packs/${id}`, payload))
export const deletePack = (id: number) => client.delete(`/packs/${id}`)

// Packs de commande
export const fetchPackCommandes = (params?: ListParams) => page<PackCommande>(client.get('/pack-commandes', { params }))
export const fetchPackCommande = (id: number) => one<PackCommande>(client.get(`/pack-commandes/${id}`))
export const createPackCommande = (payload: PackCommandePayload) => one<PackCommande>(client.post('/pack-commandes', payload))
export const updatePackCommande = (id: number, payload: PackCommandePayload) => one<PackCommande>(client.put(`/pack-commandes/${id}`, payload))
export const deletePackCommande = (id: number) => client.delete(`/pack-commandes/${id}`)

// Réglages
export interface OrderSettings { strategic_percentage: number }
export const fetchOrderSettings = () => one<OrderSettings>(client.get('/order-settings'))
export const saveOrderSettings = (payload: OrderSettings) => one<OrderSettings>(client.put('/order-settings', payload))
