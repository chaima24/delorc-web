import { client } from '@/api/client'

/** Objectives (docs/api/objectives-frequencies.md): what one person must do a day, per role + team, changed from a date. */

/** The numbers of an objective, all "a day" (old column names: business = pharmacy visits, commande = orders). */
export const OBJECTIVE_NUMBERS = ['doctor', 'business', 'wholesaler', 'commande', 'coaching'] as const
export type ObjectiveNumber = typeof OBJECTIVE_NUMBERS[number]
export type ObjectiveNumbers = Record<ObjectiveNumber, number>

export interface ObjectivePerson {
  id: number
  full_name: string
  avatar?: { url?: string | null } | null
}

/** One row: a role + team (`team` null = all teams), from a date. A cycle's goal = these numbers × its field days. */
export interface Objective extends ObjectiveNumbers {
  id: number
  role_id: number
  team_id: number | null
  start_date: string
  end_date: string | null
  /** `visits`: the kinds of professionals the role visits (Studio › Rôles). */
  role?: { id: number; name: string; visits: string[] }
  team?: { id: number; name: string } | null
  created_by?: { id: number; full_name: string } | null
  /** 0 until cycles. */
  cycles_count?: number
  /** Who uses it today. */
  people_count?: number
  /** One objective only. */
  people?: ObjectivePerson[]
  /** One objective only: every version of the same role + team, newest first. */
  versions?: Objective[]
  /** One objective only: next month, for "Pour un mois". */
  next_month?: { start: string; end: string; working_days: number }
  created_at?: string | null
}

/** An active person of a field role with no row today nor later. */
export interface UncoveredPerson {
  id: number
  full_name: string
  role: { id: number; name: string } | null
  team: { id: number; name: string } | null
}

export type ObjectiveState = 'current' | 'past' | 'all'
export type ObjectivePayload = Partial<ObjectiveNumbers> & { role_id: number; team_id: number | null; start_date: string }

const one = (request: Promise<{ data: { data: Objective } }>) => request.then((response) => response.data.data)

/** The whole list (roles × teams), not paged. */
export const fetchObjectives = (state: ObjectiveState = 'current') =>
  client.get<{ data: Objective[] }>('/objectives', { params: { 'filter[state]': state } }).then((response) => response.data.data)
export const fetchObjective = (id: number) => one(client.get(`/objectives/${id}`))
export const createObjective = (body: ObjectivePayload) => one(client.post('/objectives', body))
/** New numbers from `from`: the current ones end the day before (same date as the start = corrected in place). */
export const changeObjective = (id: number, body: Partial<ObjectiveNumbers> & { from: string }) => one(client.put(`/objectives/${id}`, body))
export const deleteObjective = (id: number) => client.delete(`/objectives/${id}`)
export const fetchUncoveredPeople = () =>
  client.get<{ data: UncoveredPerson[] }>('/objectives/uncovered').then((response) => response.data.data)
