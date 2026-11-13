import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'

/** How professionnels de santé are classified (Studio › Professionnels de santé). Lists are pages: `{ items, total }`. */
export interface Speciality {
  id: number
  name: string
  type: 'medecin' | 'pharmacie' | 'grossiste'
  /** General medicine: a doctor of it counts as a generalist in a coaching session. */
  is_generalist: boolean
  /** Professionnels de santé and organisations with it (0 until their module). */
  customers_count?: number
  created_at?: string | null
}

export interface Segmentation {
  id: number
  name: string
  color: string
  position: number
  type: 'cycle_target' | 'survey'
  cycle_targets_count?: number
  created_at?: string | null
}

export interface Priority {
  id: number
  name: string
  order: number
  color: string
  campaigns_count?: number
  created_at?: string | null
}

/** The API checks `type` against its list (422 otherwise). */
export type SpecialityPayload = { name: string; type: string; is_generalist?: boolean }
export type SegmentationPayload = { name: string; color: string; position: number; type: string }
export type PriorityPayload = Pick<Priority, 'name' | 'order' | 'color'>

const page = <T>(path: string, params?: ListParams) =>
  client.get<{ data: T[]; meta: { total: number } }>(path, { params }).then((response): Page<T> => ({ items: response.data.data, total: response.data.meta.total }))
const one = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

export const fetchSpecialities = (params?: ListParams) => page<Speciality>('/specialities', params)
export const createSpeciality = (body: SpecialityPayload) => one<Speciality>(client.post('/specialities', body))
export const updateSpeciality = (id: number, body: SpecialityPayload) => one<Speciality>(client.put(`/specialities/${id}`, body))
export const deleteSpeciality = (id: number) => client.delete(`/specialities/${id}`)

export const fetchSegmentations = (params?: ListParams) => page<Segmentation>('/segmentations', params)
export const createSegmentation = (body: SegmentationPayload) => one<Segmentation>(client.post('/segmentations', body))
export const updateSegmentation = (id: number, body: SegmentationPayload) => one<Segmentation>(client.put(`/segmentations/${id}`, body))
export const deleteSegmentation = (id: number) => client.delete(`/segmentations/${id}`)

export const fetchPriorities = (params?: ListParams) => page<Priority>('/priorities', params)
export const createPriority = (body: PriorityPayload) => one<Priority>(client.post('/priorities', body))
export const updatePriority = (id: number, body: PriorityPayload) => one<Priority>(client.put(`/priorities/${id}`, body))
export const deletePriority = (id: number) => client.delete(`/priorities/${id}`)
