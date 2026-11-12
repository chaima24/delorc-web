import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'

/** Activities (docs/api/activities.md): what a person does that is not a visit. */

export const DURATIONS = [
  { value: 1, key: 'all_day' },
  { value: 2, key: 'morning' },
  { value: 3, key: 'afternoon' },
  { value: 4, key: 'custom_time' },
  { value: 5, key: 'two_days' },
  { value: 6, key: 'three_days' },
  { value: 7, key: 'four_days' },
  { value: 8, key: 'five_days' },
  { value: 9, key: 'custom_end_date' },
] as const

export const DURATION_HOURS = 4
export const DURATION_UNTIL = 9

/** field: a field day · off: off-field work · non: non-working. */
export type ActivityKind = 'off' | 'non' | 'field'

export interface ActivityTarget {
  id: number
  target_type: 'hcp' | 'user' | 'territory' | null
  target_id: number
  /** A professional (`name`, `type`), a person (`full_name`) or a territory (`name`). */
  target: { id: number; name?: string; full_name?: string; type?: string } | null
}

export interface Activity {
  id: number
  activity_type_id: number
  /** Whose day it is. */
  user_id: number
  title: string
  observation: string | null
  duration_type: number
  start_at: string | null
  end_at: string | null
  activity_type?: { id: number; activity: string; value: string; type: string } | null
  user?: { id: number; full_name: string; role: string | null } | null
  targets?: ActivityTarget[]
  kind?: ActivityKind
  /** The working days it covers (½ or 1 each). */
  days?: number
  created_by?: { id: number; full_name: string } | null
  created_at?: string | null
}

export interface ActivityPayload {
  activity_type_id?: number
  user_id?: number | null
  title?: string
  observation?: string | null
  activity_date?: string
  duration_type?: number
  start_time?: string
  end_time?: string
  end_date?: string
  target_ids?: number[]
}

/** One person's day in the team calendar: what shows, and the share of the day taken from visits. */
export interface ActivityCalendarDay {
  kind: ActivityKind
  weight: number
  activity_ids: number[]
}

export interface ActivityCalendar {
  /** The working days of the period. */
  days: string[]
  people: { id: number; full_name: string; role: string | null; days: Record<string, ActivityCalendarDay> }[]
}

const one = (request: Promise<{ data: { data: Activity } }>) => request.then((response) => response.data.data)

export const fetchActivities = (params?: ListParams) =>
  client.get<{ data: Activity[]; meta: { total: number } }>('/activities', { params })
    .then((response): Page<Activity> => ({ items: response.data.data, total: response.data.meta.total }))
export const fetchActivity = (id: number) => one(client.get(`/activities/${id}`))
export const createActivity = (body: ActivityPayload) => one(client.post('/activities', body))
export const updateActivity = (id: number, body: ActivityPayload) => one(client.put(`/activities/${id}`, body))
export const deleteActivity = (id: number) => client.delete(`/activities/${id}`)
export const fetchActivityCalendar = (params: ListParams & { from: string; to: string }) =>
  client.get<{ data: ActivityCalendar }>('/activities/calendar', { params }).then((response) => response.data.data)

/** Every activity matching the params (one month of the list), 100 at a time. */
export async function fetchAllActivities(params: ListParams): Promise<Activity[]> {
  const rows: Activity[] = []
  for (let page = 1; ; page++) {
    const result = await fetchActivities({ ...params, page, per_page: 100 })
    rows.push(...result.items)
    if (!result.items.length || rows.length >= result.total) break
  }
  return rows
}

/** Which picker a type's "linked to" uses. `cycle_target` comes with cycles. */
const PICKERS: Record<string, 'hcp' | 'user' | 'territory' | 'cycle_target'> = {
  pharmacy: 'hcp',
  wholesaler: 'hcp',
  wholesaler_pharmacy: 'hcp',
  medical_representative: 'user',
  territory: 'territory',
  cycle_target: 'cycle_target',
}
export const activityTargetKind = (value?: string) => (value ? PICKERS[value] ?? null : null)
