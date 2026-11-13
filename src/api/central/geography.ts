import { client } from '@/api/client'

export interface Country {
  id: number
  code: string
  name: string
  native_name: string | null
  phone_code: string | null
  is_active: boolean
  regions_count: number
  wilayas_count: number
  communes_count: number
  created_at: string
}

export interface Region {
  id: number
  name: string
  arabic_name: string | null
  wilayas_count: number
  created_at: string
}

/** What a region's form sends. */
export type RegionFields = { name: string; arabic_name: string | null }

export interface Place {
  id: number
  name: string
  arabic_name: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
}

export interface Wilaya extends Place {
  phone_code: string | null
  region: { id: number; name: string } | null
  communes_count: number
}

export interface Commune extends Place {
  post_code: string | null
  wilaya: { id: number; name: string } | null
}

export interface PlaceFilters {
  search?: string
  region?: number
  wilaya?: number
  /** `name`, or `-name` to reverse. */
  sort?: string
}

export interface CountryImport {
  country: string
  country_added: boolean
  regions_added: number
  wilayas_added: number
  communes_added: number
  unchanged: number
}

export type CountryFields = Pick<Country, 'name' | 'native_name' | 'phone_code'>
export type WilayaFields = Partial<Pick<Wilaya, 'name' | 'arabic_name' | 'phone_code' | 'latitude' | 'longitude'> & { region_id: number }>
export type CommuneFields = Partial<Pick<Commune, 'name' | 'arabic_name' | 'post_code' | 'latitude' | 'longitude'> & { wilaya_id: number }>

type Page<T> = { data: T[]; meta: { total: number } }
const one = <T>(response: { data: { data: T } }) => response.data.data

function listParams(filters: PlaceFilters, page: number, perPage: number): Record<string, string | number> {
  const params: Record<string, string | number> = { page, per_page: perPage }
  if (filters.search) params['filter[search]'] = filters.search
  if (filters.region) params['filter[region]'] = filters.region
  if (filters.wilaya) params['filter[wilaya]'] = filters.wilaya
  if (filters.sort) params.sort = filters.sort

  return params
}

export const countriesApi = {
  list: () => client.get<{ data: Country[] }>('/countries').then((response) => response.data.data),
  get: (code: string) => client.get(`/countries/${code}`).then(one<Country>),
  create: (country: CountryFields & { code: string }) => client.post('/countries', country).then(one<Country>),
  update: (code: string, changes: Partial<CountryFields & { is_active: boolean }>) => client.put(`/countries/${code}`, changes).then(one<Country>),
  remove: (code: string) => client.delete(`/countries/${code}`),
  export: (code: string) => client.get<Blob>(`/countries/${code}/export`, { responseType: 'blob' }).then((response) => response.data),
  import: (file: File) => {
    const body = new FormData()
    body.append('file', file)

    return client.post<{ data: CountryImport }>('/countries/import', body).then((response) => response.data.data)
  },
}

export const placesApi = {
  regions: (code: string) => client.get<{ data: Region[] }>(`/countries/${code}/regions`).then((response) => response.data.data),
  createRegion: (code: string, region: RegionFields) => client.post(`/countries/${code}/regions`, region).then(one<Region>),
  updateRegion: (id: number, region: RegionFields) => client.put(`/regions/${id}`, region).then(one<Region>),
  removeRegion: (id: number) => client.delete(`/regions/${id}`),

  wilayas: (code: string, filters: PlaceFilters, page: number, perPage: number) =>
    client.get<Page<Wilaya>>(`/countries/${code}/wilayas`, { params: listParams(filters, page, perPage) }).then((response) => response.data),
  /** Every wilaya of a country, for dropdowns. The API sends 100 rows at most per page, so this asks page after page. */
  allWilayas: async (code: string) => {
    const all: Wilaya[] = []
    for (let page = 1; ; page++) {
      const { data, meta } = await placesApi.wilayas(code, { sort: 'name' }, page, 100)
      all.push(...data)
      if (!data.length || all.length >= meta.total) return all
    }
  },
  createWilaya: (code: string, fields: WilayaFields) => client.post(`/countries/${code}/wilayas`, fields).then(one<Wilaya>),
  updateWilaya: (id: number, fields: WilayaFields) => client.put(`/wilayas/${id}`, fields).then(one<Wilaya>),
  removeWilaya: (id: number) => client.delete(`/wilayas/${id}`),

  communes: (code: string, filters: PlaceFilters, page: number, perPage: number) =>
    client.get<Page<Commune>>(`/countries/${code}/communes`, { params: listParams(filters, page, perPage) }).then((response) => response.data),
  createCommune: (code: string, fields: CommuneFields) => client.post(`/countries/${code}/communes`, fields).then(one<Commune>),
  updateCommune: (id: number, fields: CommuneFields) => client.put(`/communes/${id}`, fields).then(one<Commune>),
  removeCommune: (id: number) => client.delete(`/communes/${id}`),
}
