import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'

/** The lists reps pick from in the field (Studio › Terrain). Lists are pages: `{ items, total }`. */
export interface RoleRef {
  id: number
  name: string
}

export type ActivityTypeValue = 'cycle_target' | 'pharmacy' | 'wholesaler_pharmacy' | 'wholesaler' | 'territory' | 'medical_representative'
export type ActivityDayType = 'off_field_work_days' | 'field_days' | 'non_working_days'

export interface ActivityType {
  id: number
  activity: string
  value: ActivityTypeValue
  type: ActivityDayType
  /** With `include=roles`, and after a save. */
  roles?: RoleRef[]
  activities_count?: number
  created_at?: string | null
}

export interface EventType {
  id: number
  event: string
  events_count?: number
  created_at?: string | null
}

export interface Canal {
  id: number
  name: string
  visits_count?: number
  created_at?: string | null
}

export interface Materiel {
  id: number
  name: string
  role_id: number
  role?: RoleRef
  distributions_count?: number
  created_at?: string | null
}

export interface Holiday {
  id: number
  name: string
  /** Y-m-d */
  date: string
  /** Same date each year: offered by "Copier l'année dernière". */
  every_year: boolean
  on_weekend: boolean
  creator?: RoleRef | null
  /** On one holiday only: what it changes. */
  impact?: { on_weekend: boolean; month: string; working_days: number; working_days_without: number; cycles: number }
  created_at?: string | null
}

export interface HolidayListMeta {
  year: number
  /** Carbon day numbers (0 = Sunday). */
  weekend: number[]
  working_days_off: number
  previous_year_count: number
}

/** One line of "Ajouter": `days` makes it several calendar days from `date`. */
export interface HolidayItem {
  name: string
  date: string
  days?: number
  every_year?: boolean
}

export type ActivityTypePayload = { activity: string; value: string; type: string; role_ids: number[] }
export type EventTypePayload = { event: string }
export type CanalPayload = { name: string }
export type MaterielPayload = { name: string; role_id: number }

const page = <T>(path: string, params?: ListParams) =>
  client.get<{ data: T[]; meta: { total: number } }>(path, { params }).then((response): Page<T> => ({ items: response.data.data, total: response.data.meta.total }))
const one = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

/** The roles that can use an activity type (empty until loaded). */
export const activityTypeRoles = (item: ActivityType | null | undefined): RoleRef[] => item?.roles ?? []

export const fetchActivityTypes = (params?: ListParams) => page<ActivityType>('/activity-types', params)
export const createActivityType = (body: ActivityTypePayload) => one<ActivityType>(client.post('/activity-types', body))
export const updateActivityType = (id: number, body: ActivityTypePayload) => one<ActivityType>(client.put(`/activity-types/${id}`, body))
export const deleteActivityType = (id: number) => client.delete(`/activity-types/${id}`)

export const fetchEventTypes = (params?: ListParams) => page<EventType>('/event-types', params)
export const createEventType = (body: EventTypePayload) => one<EventType>(client.post('/event-types', body))
export const updateEventType = (id: number, body: EventTypePayload) => one<EventType>(client.put(`/event-types/${id}`, body))
export const deleteEventType = (id: number) => client.delete(`/event-types/${id}`)

export const fetchCanals = (params?: ListParams) => page<Canal>('/canals', params)
export const createCanal = (body: CanalPayload) => one<Canal>(client.post('/canals', body))
export const updateCanal = (id: number, body: CanalPayload) => one<Canal>(client.put(`/canals/${id}`, body))
export const deleteCanal = (id: number) => client.delete(`/canals/${id}`)

export const fetchMateriels = (params?: ListParams) => page<Materiel>('/materiels', params)
export const createMateriel = (body: MaterielPayload) => one<Materiel>(client.post('/materiels', body))
export const updateMateriel = (id: number, body: MaterielPayload) => one<Materiel>(client.put(`/materiels/${id}`, body))
export const deleteMateriel = (id: number) => client.delete(`/materiels/${id}`)

/** One year at a time, with the lab's weekend. */
export const fetchHolidays = (year: number) =>
  client.get<{ data: Holiday[]; meta: HolidayListMeta }>('/holidays', { params: { year } }).then((response) => response.data)
export const fetchHoliday = (id: number) => one<Holiday>(client.get(`/holidays/${id}`))
export const createHolidays = (items: HolidayItem[]) => one<Holiday[]>(client.post('/holidays', { items }))
export const updateHoliday = (id: number, body: Pick<Holiday, 'name' | 'date' | 'every_year'>) => one<Holiday>(client.put(`/holidays/${id}`, body))
export const deleteHoliday = (id: number) => client.delete(`/holidays/${id}`)

/** The lab's weekend days (Carbon day numbers: 0 = Sunday … 6 = Saturday). 1 to 3 days. */
export const fetchWorkingWeek = () => one<{ weekend_days: number[] }>(client.get('/working-week'))
export const updateWorkingWeek = (weekendDays: number[]) => one<{ weekend_days: number[] }>(client.put('/working-week', { weekend_days: weekendDays }))
