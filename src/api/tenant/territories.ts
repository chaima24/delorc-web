import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'
import type { HcpType } from '@/api/tenant/hcps'

/** Territories (docs/api/territories.md): what each covers, who works it, the form's count and suggestions. */
export type ZoneType = 'RE' | 'SR' | 'HR'
export const ZONE_TYPES: ZoneType[] = ['RE', 'SR', 'HR']

export interface TerritoryRef {
  id: number
  name: string
}

export interface TerritoryPersonRef {
  id: number
  full_name: string
  email?: string
}

/** A picked item: a commune, a wilaya's sub-zone, a speciality… with the item it sits in. */
export interface TerritoryCoverItem {
  id: number
  name: string | null
  is_sub_zone: boolean
  parent_id: number | null
  parent_name?: string | null
}

/** The picks of one rule type. `linked` = the type reaches professionals. */
export interface TerritoryCover {
  type: string
  name: string
  linked: boolean
  items: TerritoryCoverItem[]
}

/** Résidence / Semi-résidence / Hors résidence for a wilaya (used by Expenses). */
export interface TerritoryZone {
  wilaya_id: number
  name: string | null
  type: ZoneType
}

export interface TerritoryStint {
  id: number
  start_date: string
  end_date: string | null
  state?: 'current' | 'upcoming' | 'past'
  user: TerritoryPersonRef
  assigned_by?: string | null
}

export interface TerritoryActivity {
  hcps: number
  by_type: Partial<Record<HcpType, number>>
  /** Null until visits exist. */
  visits_year: number | null
  visited_year: number | null
  children: number
  people: number
  people_total: number
}

export interface Territory {
  id: number
  name: string
  sector?: string | null
  description?: string | null
  parent_id: number | null
  parent?: TerritoryRef | null
  children?: TerritoryRef[]
  children_count?: number
  covers?: TerritoryCover[]
  zones?: TerritoryZone[]
  people?: TerritoryStint[]
  hcps_count?: number
  activity?: TerritoryActivity
  siblings?: TerritoryRef[]
  created_by?: { id: number; full_name: string } | null
  created_at?: string | null
  updated_at?: string | null
}

/** The picks of one rule type, as the form sends them. */
export interface CoverBlockPayload {
  type: string
  items: { id: number; is_sub_zone?: boolean }[]
}

export interface TerritoryDetailsPayload {
  name?: string
  sector?: string | null
  description?: string | null
  parent_id?: number | null
}

export interface TerritoryCoversPayload {
  covers: CoverBlockPayload[]
  zones: { wilaya_id: number; type: ZoneType }[]
}

export type CreateTerritoryPayload = TerritoryDetailsPayload & TerritoryCoversPayload & {
  name: string
  assign?: { user_ids: number[]; start_date: string } | null
}

/** Only the parts that change: details, or covers and zones. */
export type UpdateTerritoryPayload = TerritoryDetailsPayload & Partial<TerritoryCoversPayload>

export interface PersonSuggestion {
  id: number
  home: string | null
  teams: string[]
  suggested: boolean
  no_home: boolean
  /** The groups the person doesn't match ("Commune", "Spécialité"). */
  outside: string[]
}

export type HcpsByType = Partial<Record<HcpType, number>>

const data = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

export const fetchTerritories = (params?: ListParams) =>
  client.get<{ data: Territory[]; meta: { total: number } }>('/territories', { params })
    .then((response): Page<Territory> => ({ items: response.data.data, total: response.data.meta.total }))

export const fetchTerritoryCounts = (params?: ListParams) => data<{ all: number; nobody: number }>(client.get('/territories/counts', { params }))

export const fetchTerritoryCoverage = (covers: CoverBlockPayload[]) => data<{ count: number; by_type: HcpsByType }>(client.post('/territories/coverage', { covers }))

export const fetchPeopleSuggestions = (covers: CoverBlockPayload[]) => data<PersonSuggestion[]>(client.post('/territories/people-suggestions', { covers }))

export const fetchTerritory = (id: number | string) => data<Territory>(client.get(`/territories/${id}`))

export const createTerritory = (payload: CreateTerritoryPayload) => data<Territory>(client.post('/territories', payload))

export const updateTerritory = (id: number, payload: UpdateTerritoryPayload) => data<Territory>(client.put(`/territories/${id}`, payload))

export const deleteTerritory = (id: number) => client.delete(`/territories/${id}`)

export const fetchTerritoryPeople = (id: number) => data<TerritoryStint[]>(client.get(`/territories/${id}/people`))

export const assignTerritoryPerson = (id: number, payload: { user_id: number; start_date: string }) =>
  data<TerritoryStint[]>(client.post(`/territories/${id}/people`, payload))

export const endTerritoryStint = (id: number, stintId: number, endDate: string) =>
  data<TerritoryStint[]>(client.put(`/territories/${id}/people/${stintId}/end`, { end_date: endDate }))
