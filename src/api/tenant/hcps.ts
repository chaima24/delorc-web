import { client } from '@/api/client'
import type { Commune, ListParams, Page } from '@/api/tenant/geography'

/** Professionnels de santé (docs/api/professionals.md). Import, duplicates and proposals come with their parts. */
export type HcpType = 'doctor' | 'pharmacie' | 'dentiste' | 'wholestore' | 'distributor'
export type HcpGender = 'male' | 'female'
/** `pending` and `refused` (proposals) come with part 5d. */
export type HcpStatus = 'active' | 'inactive'
export type HcpContactedBy = 'phone' | 'email' | 'other'

export const HCP_TYPES: HcpType[] = ['doctor', 'pharmacie', 'dentiste', 'wholestore', 'distributor']
/** People (they have a gender); the others are businesses. */
export const PERSON_TYPES: HcpType[] = ['doctor', 'dentiste']

/** Where a professional works: organisation + speciality + dates (no end date = still there). */
export interface HcpWorkplace {
  id: number
  hcp_id: number
  hco_id: number
  speciality_id: number
  start_date: string | null
  end_date: string | null
  hco?: { id: number; name: string; type?: string } | null
  speciality?: { id: number; name: string } | null
}

/** Figures on the record: visits, cycle targets and the latest consent join with their modules. */
export interface HcpActivity {
  visits_year?: number
  visits_total?: number
  last_visit?: { id: number; visited_at: string | null; user: string | null } | null
  current_cycle?: { targets: number; planned: number; done: number } | null
  consent?: { approval: boolean | null; signed_at: string | null; is_active: boolean } | null
  counts?: { visits: number; cycle_targets: number; consents: number }
}

export interface Hcp {
  id: number
  /** "m1042": type letter + id. */
  generated_id: string
  name: string
  type: HcpType
  gender: HcpGender | null
  email: string | null
  phone: string | null
  fax: string | null
  contacted_by: HcpContactedBy
  status: HcpStatus
  verified: boolean
  commune_id: number
  address: string | null
  latitude: number | null
  longitude: number | null
  one_key_id: string
  wkp_id: string
  commune?: (Commune & { wilaya?: { id: number; name: string } }) | null
  added_by?: { id: number; full_name: string } | null
  located_by?: { id: number; full_name: string } | null
  /** Detail: every workplace, past ones too, current first. */
  workplaces?: HcpWorkplace[]
  /** The ones not ended. */
  current_workplaces?: HcpWorkplace[]
  activity?: HcpActivity
  /** Look-alikes only: what matched. */
  match?: ('name' | 'phone' | 'email')[]
  created_at: string | null
  updated_at?: string | null
}

export type HcpTypeCounts = Record<HcpType | 'all', number>

export const HCP_MISSING = ['gps', 'phone', 'email', 'workplace', 'verified'] as const
export type HcpMissing = typeof HCP_MISSING[number]
export type HcpMissingCounts = Record<HcpMissing, number>

export interface HcpWorkplacePayload {
  hco_id?: number
  speciality_id?: number
  start_date?: string
  end_date?: string | null
}

/** Fields sent when adding (all) or saving one section of the page (some). */
export interface HcpPayload {
  type?: HcpType
  name?: string
  gender?: HcpGender | null
  email?: string | null
  phone?: string | null
  fax?: string | null
  contacted_by?: HcpContactedBy
  commune_id?: number
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  status?: HcpStatus
  verified?: boolean
  one_key_id?: string
  wkp_id?: string
  /** Add only. */
  workplaces?: Required<Omit<HcpWorkplacePayload, 'end_date'>>[]
}

export interface HcpMapPoint {
  id: number
  name: string
  type: HcpType
  lat: number
  lng: number
}

const one = (request: Promise<{ data: { data: Hcp } }>) => request.then((response) => response.data.data)
const data = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

export const fetchHcps = (params?: ListParams) =>
  client.get<{ data: Hcp[]; meta: { total: number } }>('/hcps', { params })
    .then((response): Page<Hcp> => ({ items: response.data.data, total: response.data.meta.total }))
/** { all, doctor, … } for the same filters as the list, without the type (the type tabs). */
export const fetchHcpTypeCounts = (params?: ListParams) => data<HcpTypeCounts>(client.get('/hcps/type-counts', { params }))
/** How many of the matching ones lack each thing (the data-quality chips). */
export const fetchHcpMissingCounts = (params?: ListParams) => data<HcpMissingCounts>(client.get('/hcps/missing-counts', { params }))
/** Every matching professional with GPS (same filters as the list) and how many have none. */
export const fetchHcpMapPoints = (params?: ListParams) =>
  data<{ points: HcpMapPoint[]; without_gps: number }>(client.get('/hcps/map', { params }))
/** Up to 5 look-alikes of what is being typed. */
export const fetchHcpDuplicates = (params: { name?: string; phone?: string; email?: string; except?: number }) =>
  data<Hcp[]>(client.get('/hcps/duplicates', { params }))
export const fetchHcp = (id: number) => one(client.get(`/hcps/${id}`))
export const createHcp = (body: HcpPayload) => one(client.post('/hcps', body))
export const updateHcp = (id: number, body: HcpPayload) => one(client.put(`/hcps/${id}`, body))
export const deleteHcp = (id: number) => client.delete(`/hcps/${id}`)

export const addHcpWorkplace = (hcpId: number, body: HcpWorkplacePayload) => data<HcpWorkplace>(client.post(`/hcps/${hcpId}/workplaces`, body))
export const updateHcpWorkplace = (hcpId: number, workplaceId: number, body: HcpWorkplacePayload) =>
  data<HcpWorkplace>(client.put(`/hcps/${hcpId}/workplaces/${workplaceId}`, body))
export const deleteHcpWorkplace = (hcpId: number, workplaceId: number) => client.delete(`/hcps/${hcpId}/workplaces/${workplaceId}`)

/** Excel import (part 5b): one file row, raw cell text per field; `row` = its line in the file. */
export type HcpImportField = 'name' | 'type' | 'gender' | 'speciality' | 'hco' | 'since' | 'wilaya' | 'commune' | 'address'
  | 'latitude' | 'longitude' | 'phone' | 'email' | 'fax' | 'contacted_by' | 'status' | 'one_key_id' | 'wkp_id'
export type HcpImportRow = { row: number } & Partial<Record<HcpImportField, string>>

export interface HcpImportProblem {
  field: string
  /** required · too_long · unknown · not_found · not_in_wilaya · ambiguous · invalid · taken · workplace_incomplete */
  code: string
  value?: string
  other?: string | null
}

export interface HcpImportResult {
  row: number
  action: 'create' | 'update' | 'unchanged' | 'error'
  name: string
  errors: HcpImportProblem[]
  warnings: HcpImportProblem[]
}

/** What each row would do; nothing saved. */
export const checkHcpImport = (rows: HcpImportRow[]) => data<HcpImportResult[]>(client.post('/hcps/import/check', { rows }))
/** Saves the rows without problems; same answer, after saving. */
export const runHcpImport = (rows: HcpImportRow[]) => data<HcpImportResult[]>(client.post('/hcps/import', { rows }))
