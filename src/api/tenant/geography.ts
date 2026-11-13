import { client } from '@/api/client'

/** The lab's own places (Studio › Géographie). Lists are pages: `{ items, total }`. */
export interface Page<T> {
  items: T[]
  total: number
}

/** Query of a list, as the API reads it: `{ page: 2, per_page: 25, sort: 'name', 'filter[wilaya_id]': 16, include: 'region' }`. */
export type ListParams = Record<string, string | number | undefined>

export interface Country {
  id: number
  code: string
  name: string
  regions_count: number
  wilayas_count: number
  communes_count: number
  /** When the country came into the lab: the lab's creation. */
  created_at: string | null
}

export interface Region {
  id: number
  name: string
  arabic_name: string | null
  wilayas?: Wilaya[]
  wilayas_count?: number
  communes_count?: number
  created_at?: string | null
}

export interface Wilaya {
  id: number
  name: string
  arabic_name: string | null
  region_id: number
  region?: Region
  latitude?: number | string | null
  longitude?: number | string | null
  communes_count?: number
  sub_zones_count?: number
  created_at?: string | null
}

export interface Commune {
  id: number
  name: string
  arabic_name: string | null
  wilaya_id: number
  wilaya?: Wilaya
  sub_wilaya_zone_id: number | null
  sub_wilaya_zone?: SubWilayaZone | null
  latitude?: number | string | null
  longitude?: number | string | null
  /** Professionnels de santé in the commune (0 until their module). */
  hcps_count?: number
  created_at?: string | null
}

export interface SubWilayaZone {
  id: number
  wilaya_id: number
  name: string
  parent?: Wilaya
  communes?: Commune[]
  communes_count?: number
  created_at?: string | null
}

type PlaceFields = { name: string; arabic_name: string | null; latitude?: number | null; longitude?: number | null }
export type RegionPayload = { name: string; arabic_name: string | null }
export type WilayaPayload = PlaceFields & { region_id: number }
export type CommunePayload = PlaceFields & { wilaya_id: number }
export type SubWilayaZonePayload = { wilaya_id: number; name: string; commune_ids: number[] }

const page = <T>(path: string, params?: ListParams) =>
  client.get<{ data: T[]; meta: { total: number } }>(path, { params }).then((response): Page<T> => ({ items: response.data.data, total: response.data.meta.total }))
const one = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

/** The lab's country: one row, read only. */
export const fetchCountries = () => client.get<{ data: Country[] }>('/countries').then((response) => response.data.data)

export const fetchRegions = (params?: ListParams) => page<Region>('/regions', params)
export const createRegion = (body: RegionPayload) => one<Region>(client.post('/regions', body))
export const updateRegion = (id: number, body: RegionPayload) => one<Region>(client.put(`/regions/${id}`, body))
export const deleteRegion = (id: number) => client.delete(`/regions/${id}`)

export const fetchWilayas = (params?: ListParams) => page<Wilaya>('/wilayas', params)
export const createWilaya = (body: WilayaPayload) => one<Wilaya>(client.post('/wilayas', body))
export const updateWilaya = (id: number, body: WilayaPayload) => one<Wilaya>(client.put(`/wilayas/${id}`, body))
export const deleteWilaya = (id: number) => client.delete(`/wilayas/${id}`)

export const fetchCommunes = (params?: ListParams) => page<Commune>('/communes', params)
export const createCommune = (body: CommunePayload) => one<Commune>(client.post('/communes', body))
export const updateCommune = (id: number, body: CommunePayload) => one<Commune>(client.put(`/communes/${id}`, body))
export const deleteCommune = (id: number) => client.delete(`/communes/${id}`)

export const fetchSubWilayaZones = (params?: ListParams) => page<SubWilayaZone>('/sub-wilaya-zones', params)
export const fetchSubWilayaZone = (id: number) => one<SubWilayaZone>(client.get(`/sub-wilaya-zones/${id}`, { params: { include: 'parent,communes' } }))
export const createSubWilayaZone = (body: SubWilayaZonePayload) => one<SubWilayaZone>(client.post('/sub-wilaya-zones', body))
export const updateSubWilayaZone = (id: number, body: SubWilayaZonePayload) => one<SubWilayaZone>(client.put(`/sub-wilaya-zones/${id}`, body))
export const deleteSubWilayaZone = (id: number) => client.delete(`/sub-wilaya-zones/${id}`)
