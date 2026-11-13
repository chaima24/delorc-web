import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'

/** Engager › Aides de visite (docs/api/advs.md): the presentation of a brand a rep shows during a visit. */

export const ADV_TYPES = ['pdf', 'video', 'galerie', 'html5'] as const
export type AdvType = (typeof ADV_TYPES)[number]
export type AdvOrientation = 'horizontal' | 'vertical'

/** A file of the ADV: its cover, or one piece of its content. The link is signed for one hour. */
export interface AdvFile {
  id: number
  name: string | null
  url: string | null
  mime: string | null
  size: number | null
  sort_order: number
}

/** A team or a speciality the ADV is given to, with optional dates. */
export interface AdvAudience {
  id: number
  name: string
  start_date: string | null
  end_date: string | null
}

export interface Adv {
  id: number
  name: string
  type: AdvType
  orientation: AdvOrientation
  online: boolean
  recommendation: string | null
  brand: { id: number; name: string } | null
  main_slide: AdvFile | null
  /** Only on the panel. */
  slides?: AdvFile[]
  slides_count: number
  teams: AdvAudience[]
  specialities: AdvAudience[]
  /** Active people of its teams today (panel only). */
  people_count?: number
  visits_count: number
  created_by?: { id: number; full_name: string } | null
  created_at: string | null
}

export type AdvAudienceInput = { id: number; start_date?: string | null; end_date?: string | null }

export interface AdvPayload {
  name?: string
  brand_id?: number
  type?: AdvType
  orientation?: AdvOrientation
  online?: boolean
  recommendation?: string | null
  main_slide?: File | null
  /** New content files, in order. */
  slides?: File[]
  teams?: AdvAudienceInput[]
  specialities?: AdvAudienceInput[]
}

const one = (request: Promise<{ data: { data: Adv } }>) => request.then((response) => response.data.data)
const multipart = { headers: { 'Content-Type': 'multipart/form-data' } }

/** Files travel as multipart, so every field does: `teams[0][id]`, `slides[1][file]`… */
function formOf(payload: AdvPayload): FormData {
  const form = new FormData()
  const put = (key: string, value: unknown) => {
    if (value !== undefined) form.append(key, value instanceof File ? value : value === null ? '' : String(value))
  }
  put('name', payload.name)
  put('brand_id', payload.brand_id)
  put('type', payload.type)
  put('orientation', payload.orientation)
  if (payload.online !== undefined) put('online', payload.online ? 1 : 0)
  put('recommendation', payload.recommendation)
  if (payload.main_slide) put('main_slide', payload.main_slide)
  payload.slides?.forEach((file, i) => {
    put(`slides[${i}][file]`, file)
    put(`slides[${i}][sort_order]`, i + 1)
  })
  for (const key of ['teams', 'specialities'] as const) {
    payload[key]?.forEach((row, i) => {
      put(`${key}[${i}][id]`, row.id)
      put(`${key}[${i}][start_date]`, row.start_date ?? null)
      put(`${key}[${i}][end_date]`, row.end_date ?? null)
    })
  }
  return form
}

export const fetchAdvs = (params?: ListParams) =>
  client.get<{ data: Adv[]; meta: { total: number } }>('/advs', { params })
    .then((response): Page<Adv> => ({ items: response.data.data, total: response.data.meta.total }))
export const fetchAdv = (id: number) => one(client.get(`/advs/${id}`))
export const createAdv = (payload: AdvPayload) => one(client.post('/advs', formOf(payload), multipart))

/** Multipart can't travel as PUT: `_method` lets Laravel read it as one. An emptied list is sent as JSON. */
export function updateAdv(id: number, payload: AdvPayload) {
  const hasFiles = !!payload.main_slide || !!payload.slides?.length
  if (!hasFiles) return one(client.put(`/advs/${id}`, payload))
  const form = formOf(payload)
  form.append('_method', 'PUT')
  return one(client.post(`/advs/${id}`, form, multipart))
}

export const reorderAdvSlide = (id: number, attachmentId: number, sortOrder: number) =>
  one(client.patch(`/advs/${id}/slides/reorder`, { attachment_id: attachmentId, sort_order: sortOrder }))
export const deleteAdvSlide = (id: number, attachmentId: number) => one(client.delete(`/advs/${id}/slides/${attachmentId}`))
export const deleteAdv = (id: number) => client.delete(`/advs/${id}`)

/** What the lab uses and its plan's limit (`null` = unlimited). */
export const fetchAdvStorage = () =>
  client.get<{ data: { used_bytes: number; limit_gb: number | null } }>('/advs/storage').then((response) => response.data.data)
