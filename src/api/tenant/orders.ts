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
export interface OrderSettings {
  strategic_percentage: number
  /** null = no limit. */
  max_backdate_days: number | null
  negotiated_discount: boolean
  negotiated_role_ids: number[]
}
export const fetchOrderSettings = () => one<OrderSettings>(client.get('/order-settings'))
export const saveOrderSettings = (payload: Partial<OrderSettings>) => one<OrderSettings>(client.put('/order-settings', payload))

// Bons de commande (docs/api/orders.md)
export interface OrderHcp { id: number; name: string; type: string; wilaya?: string | null }
export interface OrderLine {
  id?: number
  product: { id: number; name: string }
  product_ug_id: number | null
  quantity: number
  ug: number
  free_quantity: number
  unit_price: string | number
  vat: string | number
  is_strategic: boolean
  is_discountable: boolean
  total: string | number
  discount: string | number
  from_pack: boolean
}

export interface Order {
  id: number
  number: string
  ordered_at: string
  user?: { id: number; full_name: string }
  client?: OrderHcp
  supplier?: OrderHcp
  visit?: { id: number; visit_date: string } | null
  pack_commande?: { id: number; name: string } | null
  pack?: { id: number; name: string } | null
  bracket?: { id: number; min_threshold: number; max_threshold: number | null } | null
  discount_source: 'bracket' | 'negotiated' | null
  discount_rate: string
  strategic_percentage: number | null
  /** Only on the page. */
  lines?: OrderLine[]
  lines_count: number
  boxes: { paid: number; free: number }
  total_ht: string
  total_strategic: string
  total_discount: string
  total_tva: string
  total_ttc: string
  comment: string | null
  photo?: { id: number; name: string; url?: string; mime?: string } | null
  can?: { update: boolean; delete: boolean }
  history?: { event: string; by: string | null; at: string; old: Record<string, unknown> | null; new: Record<string, unknown> | null }[]
  created_by?: { id: number; full_name: string } | null
  created_at: string | null
}

export interface OrderLineInput { product_id: number; quantity: number; product_ug_id?: number | null }
export interface OrderPayload {
  ordered_at?: string
  client_hcp_id?: number
  supplier_hcp_id?: number
  user_id?: number
  visit_id?: number | null
  pack_commande_id?: number | null
  comment?: string | null
  lines?: OrderLineInput[]
}

/** The order as it would be saved (POST orders/preview): nothing is written. */
export interface OrderPreview {
  pack_id: number | null
  discount_pack_id: number | null
  discount_source: 'bracket' | 'negotiated' | null
  discount_rate: number
  strategic_percentage: number | null
  total_ht: number
  total_strategic: number
  total_discount: number
  total_tva: number
  total_ttc: number
  lines: (Omit<OrderLine, 'product' | 'id'> & { product_id: number; product_name: string })[]
  boxes: { paid: number; free: number }
  pack: { id: number; name: string } | null
  bracket: DiscountPack | null
  brackets: DiscountPack[]
  next_bracket: { min_threshold: number; discount: string; missing: number } | null
}

export interface OrderForm {
  max_backdate_days: number | null
  /** The roles of the negotiated discount, when it is on. */
  negotiated: number[]
  people: { id: number; full_name: string; role_ids: number[] }[]
  pack_commandes: { id: number; name: string; client_type: ClientType; lines: { product_id: number; name: string; quantity: number; product_ug_id: number | null; is_modifiable: boolean }[] }[]
}

export const fetchOrders = (params?: ListParams) =>
  client.get<{ data: Order[]; meta: { total: number; sum_ttc: number } }>('/orders', { params })
    .then((response) => ({ items: response.data.data, total: response.data.meta.total, sum: response.data.meta.sum_ttc }))
export const fetchOrder = (id: number) => one<Order>(client.get(`/orders/${id}`))
export const fetchOrderForm = () => one<OrderForm>(client.get('/orders/form'))
export const previewOrder = (payload: OrderPayload & { id?: number }) => one<OrderPreview>(client.post('/orders/preview', payload))
export const createOrder = (payload: OrderPayload) => one<Order>(client.post('/orders', payload))
export const updateOrder = (id: number, payload: OrderPayload) => one<Order>(client.put(`/orders/${id}`, payload))
export const deleteOrder = (id: number) => client.delete(`/orders/${id}`)
export const uploadOrderPhoto = (id: number, photo: File) => {
  const form = new FormData()
  form.append('photo', photo)

  return one(client.post(`/orders/${id}/photo`, form))
}
export const removeOrderPhoto = (id: number) => client.delete(`/orders/${id}/photo`)
