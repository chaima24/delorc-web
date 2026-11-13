import { client } from '@/api/client'
import type { VisitStatus, VisitTargetType } from '@/api/tenant/visits'

/** Visites › Planning (docs/api/visit-planning.md): one person's calendar, the side list, reopened days, the lab's settings. */

export interface CalendarVisit {
  id: number
  visit_date: string
  visit_time: string | null
  status: VisitStatus
  late: boolean
  /** The entry delay has passed for that day (for the viewer). */
  locked: boolean
  off_list: boolean
  after_deadline: boolean
  target: { type: VisitTargetType; id: number; name: string | null; speciality: string | null; commune: string | null }
}

/** A day that is not a plain working day for the person. */
export interface CalendarDay {
  date: string
  kind: 'holiday' | 'activity' | 'half'
  name: string | null
}

export interface PlanningWindow {
  state: 'free' | 'not_open' | 'open' | 'closed'
  opens_on: string | null
  closes_on: string | null
  /** A visit can be planned today. */
  allowed: boolean
}

export interface CalendarCycle {
  id: number
  start_date: string
  end_date: string
  to_do: number
  planned: number
  done: number
  planning: PlanningWindow
}

export interface VisitCalendar {
  user: { id: number; full_name: string }
  visits: CalendarVisit[]
  days: CalendarDay[]
  /** Day numbers, 0 = Sunday. */
  weekend_days: number[]
  cycles: CalendarCycle[]
  max_doctors_per_day: number | null
  default_canal: { id: number; name: string } | null
}

export interface PlanningProfessional {
  hcp: { id: number; name: string; type: string; speciality: string | null; commune: string | null }
  segment: { id: number; name: string; color: string | null } | null
  to_do: number | null
  done: number | null
  planned: number | null
  /** Visits still to plan in the cycle (null outside the list). */
  left: number | null
  off_list: boolean
}

export interface VisitOpenDay {
  id: number
  user_id: number
  date: string
  valid_until: string
  note: string | null
  created_by: { id: number; full_name: string } | null
}

export interface VisitSettings {
  max_doctors_per_day: number | null
  plan_after_deadline: boolean
  default_canal_id: number | null
  add_after_delay: boolean
  default_canal?: { id: number; name: string } | null
}

const data = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

export const fetchVisitCalendar = (params: { user_id?: number; from: string; to: string }) => data<VisitCalendar>(client.get('/visits/calendar', { params }))
export const fetchPlanningProfessionals = (params: { user_id?: number; date: string; q?: string; left?: 0 | 1; per_page?: number }) =>
  client.get<{ data: PlanningProfessional[]; meta: { total: number; left: number; cycle_id: number | null } }>('/visits/calendar/professionals', { params })
    .then((response) => ({ items: response.data.data, ...response.data.meta }))
export const fetchVisitOpenDays = (userId?: number) => data<VisitOpenDay[]>(client.get('/visits/open-days', { params: { user_id: userId } }))
export const openVisitDays = (payload: { user_id: number; from: string; to: string; note?: string | null }) => data<VisitOpenDay[]>(client.post('/visits/open-days', payload))
export const fetchVisitSettings = () => data<VisitSettings>(client.get('/visit-settings'))
export const saveVisitSettings = (payload: Omit<VisitSettings, 'default_canal'>) => data<VisitSettings>(client.put('/visit-settings', payload))
