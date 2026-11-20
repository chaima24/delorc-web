import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'

/**
 * Veille concurrentielle (docs/api/competitive-informations.md). A competitive information is the screen's « note »:
 * what a rep saw a competitor do. Draft → sent → processed. Its details are the items picked from five lists.
 */

export type CompetitiveStatus = 'draft' | 'sent' | 'processed'
export const COMPETITIVE_STATUSES: CompetitiveStatus[] = ['draft', 'sent', 'processed']

export type CompetitiveList = 'source' | 'therapeutic' | 'action_type' | 'argument' | 'support'
export const COMPETITIVE_LISTS: CompetitiveList[] = ['source', 'therapeutic', 'action_type', 'argument', 'support']

/** One scale for the three levels. */
export type CompetitiveLevel = 'low' | 'medium' | 'high' | 'very_high'
export const COMPETITIVE_LEVELS: CompetitiveLevel[] = ['low', 'medium', 'high', 'very_high']

export const COMPETITIVE_TEXTS = [
  'principal_indication', 'key_message', 'question_comparison', 'competitor_force', 'competitor_weakness', 'differentiation_vs_our_offer',
] as const
export type CompetitiveText = (typeof COMPETITIVE_TEXTS)[number]

/** An item picked (with its text), or an « Autre » with `other_comment`. */
export interface CompetitiveDetail {
  id: number
  competitive_type_id: number | null
  content: string | null
  is_active: boolean | null
  other_comment: string | null
}

export interface CompetitiveFile { id: number; name: string; url: string | null; mime: string; size: number }

export interface CompetitiveHistoryLine {
  event: string
  by: string | null
  at: string
  old: Record<string, unknown> | null
  new: Record<string, unknown> | null
  comment: string | null
  added: string[] | null
  removed: string[] | null
}

export interface CompetitiveInformation extends Partial<Record<CompetitiveText, string | null>> {
  id: number
  number: string
  status: CompetitiveStatus
  seen_on: string
  user?: { id: number; full_name: string }
  laboratory: string
  product: string
  brand?: { id: number; name: string } | null
  interest_level: CompetitiveLevel | null
  urgency_level: CompetitiveLevel | null
  reliability_level: CompetitiveLevel | null
  /** Only on the page. */
  details?: Record<CompetitiveList, CompetitiveDetail[]>
  files?: CompetitiveFile[]
  /** Only on the list. */
  files_count?: number
  sent_at: string | null
  processed_by?: { id: number; full_name: string } | null
  processed_at: string | null
  processed_comment: string | null
  can?: { update: boolean; delete: boolean; send: boolean; process: boolean }
  history?: CompetitiveHistoryLine[]
  created_at: string | null
}

export interface CompetitiveDetailInput { type: CompetitiveList; competitive_type_id?: number | null; other_comment?: string | null }

export type CompetitivePayload = Partial<Record<CompetitiveText, string | null>> & {
  seen_on?: string
  laboratory?: string
  product?: string
  brand_id?: number | null
  interest_level?: CompetitiveLevel | null
  urgency_level?: CompetitiveLevel | null
  reliability_level?: CompetitiveLevel | null
  details?: CompetitiveDetailInput[]
  /** The lists a card saves, so a list emptied on screen is emptied too. */
  detail_types?: CompetitiveList[]
}

/** The active items of the five lists, for the form. */
export type CompetitiveForm = Record<CompetitiveList, { id: number; content: string }[]>

/** An item of a Réglages list. */
export interface CompetitiveType {
  id: number
  type: CompetitiveList
  content: string
  sort: number
  is_active: boolean
  notes_count?: number
}

const one = <T>(request: Promise<{ data: { data: T } }>) => request.then(response => response.data.data)

const URL = '/competitive-informations'

export const fetchCompetitiveInformations = (params?: ListParams) =>
  client.get<{ data: CompetitiveInformation[]; meta: { total: number; status_counts: Record<CompetitiveStatus, number> } }>(URL, { params })
    .then((response): Page<CompetitiveInformation> & { counts: Record<CompetitiveStatus, number> } => ({
      items: response.data.data, total: response.data.meta.total, counts: response.data.meta.status_counts,
    }))
export const fetchCompetitiveInformation = (id: number) => one<CompetitiveInformation>(client.get(`${URL}/${id}`))
export const fetchCompetitiveForm = () => one<CompetitiveForm>(client.get(`${URL}/form`))
export const createCompetitiveInformation = (payload: CompetitivePayload) => one<CompetitiveInformation>(client.post(URL, payload))
export const updateCompetitiveInformation = (id: number, payload: CompetitivePayload) => one<CompetitiveInformation>(client.put(`${URL}/${id}`, payload))
export const deleteCompetitiveInformation = (id: number) => client.delete(`${URL}/${id}`)
export const sendCompetitiveInformation = (id: number) => one<CompetitiveInformation>(client.post(`${URL}/${id}/send`))
export const processCompetitiveInformation = (id: number, comment: string | null) => one<CompetitiveInformation>(client.post(`${URL}/${id}/process`, { comment }))
export const uploadCompetitiveFiles = (id: number, files: File[]) => {
  const form = new FormData()
  files.forEach(file => form.append('files[]', file))

  return one<CompetitiveFile[]>(client.post(`${URL}/${id}/files`, form))
}
export const deleteCompetitiveFile = (id: number, fileId: number) => client.delete(`${URL}/${id}/files/${fileId}`)

// Veille concurrentielle › Réglages
export const fetchCompetitiveTypes = () => one<CompetitiveType[]>(client.get('/competitive-types'))
export const createCompetitiveType = (payload: { type: CompetitiveList; content: string }) => one<CompetitiveType>(client.post('/competitive-types', payload))
export const updateCompetitiveType = (id: number, payload: { content?: string; sort?: number; is_active?: boolean }) =>
  one<CompetitiveType>(client.put(`/competitive-types/${id}`, payload))
export const deleteCompetitiveType = (id: number) => client.delete(`/competitive-types/${id}`)
