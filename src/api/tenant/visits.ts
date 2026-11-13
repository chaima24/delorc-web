import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'

/** Visites (docs/api/visits.md): one person's visit to a professional or an organisation on one day. */

export type VisitStatus = 'planned' | 'done' | 'cancelled'
export type VisitTargetType = 'hcp' | 'hco'

export interface VisitBrand {
  id: number
  name: string
  /** Interest, 1 to 5. */
  feedback: number | null
  /** Boxes seen on the shelves (pharmacies, wholesalers, organisations). */
  stock: number | null
}

export interface VisitAdv {
  id: number
  name: string
  type: string
  brand: string | null
  feedback: number | null
}

/** Another visit of the same person to the same target, in short. */
export interface VisitShort {
  id: number
  visit_date: string
  status?: VisitStatus
  next_objective: string | null
  brands: { name: string; feedback: number | null }[]
}

export interface VisitCycle {
  id: number
  start_date: string
  end_date: string
  /** Visits done to this professional in the cycle, and how many the grid asks (null when off-list). */
  done?: number | null
  to_do?: number | null
}

export interface Visit {
  id: number
  uuid: string
  status: VisitStatus
  /** Planned and its day has passed. */
  late: boolean
  off_list: boolean
  visit_date: string
  visit_time: string | null
  user: { id: number; full_name: string; role: string | null; team: string | null } | null
  target: { type: VisitTargetType; id: number; name: string | null; kind: string | null; speciality: string | null; commune: string | null }
  canal: { id: number; name: string } | null
  cycle: VisitCycle | null
  brands: VisitBrand[]
  objective: string | null
  next_objective: string | null
  cancel_reason: { id: number; name: string } | null
  cancel_note: string | null
  created_by: { id: number; full_name: string } | null
  created_at: string | null
  // The page only.
  advs?: VisitAdv[]
  coaches?: { id: number; full_name: string; role: string | null }[]
  participants?: { id: number; name: string }[]
  replacement?: { id: number; name: string } | null
  comment?: string | null
  previous?: VisitShort | null
  next?: VisitShort | null
}

export interface VisitPayload {
  user_id?: number
  visitable_type?: VisitTargetType
  visitable_id?: number
  visit_date?: string
  visit_time?: string | null
  canal_id?: number
  status?: 'planned' | 'done'
  objective?: string | null
  next_objective?: string | null
  comment?: string | null
  hcp_replacement_id?: number | null
  brands?: { brand_id: number; feedback?: number | null; stock?: number | null }[]
  advs?: { adv_id: number; feedback?: number | null }[]
  coaches?: number[]
  participants?: number[]
}

export interface VisitSummary {
  done: number
  done_off_list: number
  planned: number
  planned_until: string | null
  late: number
  cancelled: number
  cancelled_reasons: { name: string; count: number }[]
}

export interface VisitPerson {
  id: number
  full_name: string
  role: string | null
  team: string | null
}

/** What the add page shows beside the form. */
export interface VisitContext {
  cycle: VisitCycle | null
  off_list: boolean
  last_visit: VisitShort | null
  same_day_visit_id: number | null
}

export interface VisitOfferedAdv {
  id: number
  name: string
  type: string
  brand: string | null
  slides_count: number
}

export interface VisitTargetQuery {
  user_id?: number
  visitable_type: VisitTargetType
  visitable_id: number
  date: string
}

const one = (request: Promise<{ data: { data: Visit } }>) => request.then((response) => response.data.data)
const data = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

export const fetchVisits = (params?: ListParams) =>
  client.get<{ data: Visit[]; meta: { total: number } }>('/visits', { params })
    .then((response): Page<Visit> => ({ items: response.data.data, total: response.data.meta.total }))
export const fetchVisitSummary = () => data<VisitSummary>(client.get('/visits/summary'))
export const fetchVisitPeople = () => data<VisitPerson[]>(client.get('/visits/people'))
export const fetchVisitContext = (params: VisitTargetQuery) => data<VisitContext>(client.get('/visits/context', { params }))
export const fetchVisitAdvs = (params: VisitTargetQuery & { brand_ids: number[] }) => data<VisitOfferedAdv[]>(client.get('/visits/advs', { params }))
export const fetchVisit = (id: number) => one(client.get(`/visits/${id}`))
export const createVisit = (payload: VisitPayload) => one(client.post('/visits', payload))
export const updateVisit = (id: number, payload: VisitPayload) => one(client.put(`/visits/${id}`, payload))
export const cancelVisit = (id: number, payload: { cancel_reason_id: number; cancel_note?: string | null }) => one(client.post(`/visits/${id}/cancel`, payload))
export const deleteVisit = (id: number) => client.delete(`/visits/${id}`)
/** Every active person, for "Accompagné par". */
export const fetchVisitCoaches = () => data<{ id: number; full_name: string; role: string | null }[]>(client.get('/visits/coaches'))
