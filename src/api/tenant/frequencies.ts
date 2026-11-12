import { client } from '@/api/client'
import type { UncoveredPerson } from '@/api/tenant/objectives'

/** Frequency grids (docs/api/objectives-frequencies.md): how many times each professional of a cycle is visited during it. */

/** One cell: visits per cycle for a line (a speciality, a kind in `hcp_type`, or neither = all the others) × a segment. */
export interface FrequencyCell {
  id?: number
  /** "s:12", "k:pharmacie" or "other". */
  line?: string
  speciality_id: number | null
  hcp_type: string | null
  segmentation_id: number
  frequency: number
}

export interface FrequencyLine {
  key: string
  speciality: { id: number; name: string } | null
  hcp_type: string | null
}

/** A grid: the cells of one role + team (`team` null = all teams) from a date, named by role_id + team_id + start_date. */
export interface FrequencyGrid {
  key: string
  role_id: number
  team_id: number | null
  start_date: string
  end_date: string | null
  /** `visits`: the kinds of professionals the role visits (Studio › Rôles). */
  role: { id: number; name: string; visits: string[] } | null
  team: { id: number; name: string } | null
  created_by?: { id: number; full_name: string } | null
  lines: FrequencyLine[]
  cells: FrequencyCell[]
  /** Who uses it today. */
  people_count?: number
  /** One grid only. */
  people?: { id: number; full_name: string }[]
  /** One grid only; cycle targets are 0 until cycles. */
  versions?: { start_date: string; end_date: string | null; cycle_targets_count: number }[]
  cycle_targets_count?: number
}

/** Names one grid. */
export interface FrequencyGridRef {
  role_id: number
  team_id: number | null
  start_date: string
}

const refParams = (ref: FrequencyGridRef) => ({ role_id: ref.role_id, team_id: ref.team_id ?? undefined, start_date: ref.start_date })
const one = (request: Promise<{ data: { data: FrequencyGrid } }>) => request.then((response) => response.data.data)

/** The grids, not paged. */
export const fetchFrequencyGrids = (state: 'current' | 'past' | 'all' = 'current') =>
  client.get<{ data: FrequencyGrid[] }>('/frequencies', { params: { 'filter[state]': state } }).then((response) => response.data.data)
export const fetchFrequencyGrid = (ref: FrequencyGridRef) => one(client.get('/frequencies/grid', { params: refParams(ref) }))
export const createFrequencyGrid = (body: FrequencyGridRef & { cells: FrequencyCell[] }) => one(client.post('/frequencies', body))
/** New cells from `from`: the grid's current ones end the day before (same date as its start = corrected in place). */
export const changeFrequencyGrid = (ref: FrequencyGridRef, body: { from: string; cells: FrequencyCell[] }) =>
  one(client.put('/frequencies/grid', { ...ref, ...body }))
export const deleteFrequencyGrid = (ref: FrequencyGridRef) => client.delete('/frequencies/grid', { data: refParams(ref) })
export const fetchPeopleWithoutGrid = () =>
  client.get<{ data: UncoveredPerson[] }>('/frequencies/uncovered').then((response) => response.data.data)
