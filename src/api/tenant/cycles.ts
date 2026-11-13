import { client } from '@/api/client'
import type { ListParams } from '@/api/tenant/geography'

/** Cycles (docs/api/cycles.md): one person's working period. The visit figures are counted from the cycle's visits (docs/api/visits.md). */

export type CycleState = 'upcoming' | 'running' | 'ended'
export type CycleGoalKey = 'doctor' | 'pharmacy' | 'wholesaler' | 'orders' | 'coaching'
/** A working day: activity, half, not yet, field (a past day with a visit done) or none (a past day with nothing). */
export type CycleDayKind = 'activity' | 'half' | 'future' | 'field' | 'none'
export type CycleFill = 'previous' | 'territory' | 'none'
export type CycleProState = 'no_segment' | 'not_seen' | 'started' | 'reached' | 'over' | 'none_needed'

export interface Ref { id: number; name: string }

export interface CyclePerson {
  id: number
  full_name: string
  avatar?: { url?: string | null } | null
  role: { id: number; name: string; visits: string[] } | null
  team: { id: number; name: string | null } | null
}

/** The figures the list and the panel share. */
export interface CycleFiguresSummary {
  state: CycleState
  working_days: number
  days_passed: number
  field_days: number
  goal_visits: number
  professionals: number
  to_do: number
  no_segment: number
  list_short: boolean
  /** Visits done in the cycle (off-list included), planned to come, planned and late. */
  visits_done: number
  /** Coaching sessions the person received, validated by the coach, inside the cycle. */
  coaching_done: number
  visits_off_list: number
  visits_planned: number
  late: number
  /** Professionals of the list seen at least once, and the same as a % (null with an empty list). */
  seen: number
  coverage: number | null
  /** Visits done a field day so far (null before the first one). */
  pace: number | null
}

export interface CycleBoardRow extends CycleFiguresSummary {
  id: number
  start_date: string
  end_date: string
  user: CyclePerson | null
  territory: Ref | null
  has_next: boolean
}

export interface CycleBoardMeta {
  total: number
  month: string
  start: string
  end: string
  working_days: number
  days_passed: number
  ending_soon: number[]
  ending_soon_cycles: number[]
  without_cycle: { id: number; full_name: string; role: Ref | null; team: { id: number; name: string | null } | null }[]
}

export interface CycleDay {
  date: string
  kind: CycleDayKind
  today: boolean
  activity_ids: number[]
  /** Visits done that day. */
  visits: number
}

export interface CycleDetail extends CycleFiguresSummary {
  id: number
  start_date: string
  end_date: string
  user: CyclePerson | null
  territory: Ref | null
  objective: { id: number; role: string | null; team: string | null } | null
  has_grid: boolean
  next: { id: number; start_date: string; end_date: string } | null
  previous: { id: number; start_date: string; end_date: string } | null
  created_by: { id: number; full_name: string } | null
  created_at: string | null
  off_days: number
  goal: Partial<Record<CycleGoalKey, { per_day: number; total: number }>>
  days: CycleDay[]
  off: { name: string; days: number }[]
  by_segment: { id: number | null; name: string | null; color: string | null; professionals: number; seen: number }[]
}

export interface CycleCandidate {
  id: number
  full_name: string
  role: { id: number; name: string; visits: string[] } | null
  team: { id: number; name: string | null } | null
  territory: Ref | null
  blocked: 'has_cycle' | 'no_objective' | null
  cycle: { id: number; start_date: string; end_date: string } | null
  warning: 'no_territory' | 'no_grid' | null
}

export interface CyclePreviewRow {
  user_id: number
  full_name: string
  from_last: number
  new_in_territory: number
  no_segment: number
  total: number
}

export interface CycleSkipped { user_id: number; reason: 'has_cycle' | 'no_objective' }

export interface CycleProfessional {
  id: number
  hcp: { id: number; name: string; type: string; specialities: string[]; commune: string | null }
  segment: { id: number; name: string; color: string | null } | null
  to_do: number
  done: number
  planned: number
  state: CycleProState
}

export interface AvailableProfessional {
  id: number
  name: string
  type: string
  specialities: string[]
  commune: string | null
  in_territory: boolean
}

export interface TerritoryCheck {
  territory_id: number | null
  joined_count: number
  left_count: number
  joined: { id: number; name: string; type: string; commune: string | null }[]
  left: { id: number; name: string; type: string; commune: string | null }[]
  left_target_ids: number[]
}

export type CycleHistoryEvent = 'created' | 'filled' | 'professionals_added' | 'professionals_removed' | 'segment_changed' | 'dates_changed'

export interface CycleHistoryRow {
  id: number
  event: CycleHistoryEvent
  properties: {
    fill?: CycleFill
    count?: number
    from_last?: number
    new_in_territory?: number
    segment?: string | null
    names?: string[]
    from?: (string | null)[]
    to?: (string | null)[]
  }
  by: { id: number; full_name: string } | null
  at: string
}

/** A cycle in a plain list (a person's Cycles tab), with `figures` when asked. */
export interface CycleListItem {
  id: number
  user_id: number | null
  start_date: string
  end_date: string
  user?: { id: number; full_name: string } | null
  figures?: CycleFiguresSummary & { off_days: number; goal: CycleDetail['goal'] }
}

/** The professional's Cycles tab. */
export interface HcpCycleRow {
  id: number
  cycle: { id: number; start_date: string; end_date: string; state: CycleState; user: { id: number; full_name: string } | null }
  segment: { id: number; name: string; color: string | null } | null
  to_do: number
  done: number
  planned: number
}

export interface Paged<T> { data: T[]; meta: { total: number; current_page: number; per_page: number; last_page: number } }

const data = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

export const fetchCycles = (params?: ListParams) => client.get<Paged<CycleListItem>>('/cycles', { params }).then((response) => response.data)
export type CycleBoardParams = Record<string, string | number | number[] | undefined> & { month: string }

export const fetchCycleBoard = (params: CycleBoardParams) =>
  client.get<{ data: CycleBoardRow[]; meta: CycleBoardMeta }>('/cycles/board', { params }).then((response) => response.data)
export const fetchCycle = (id: number) => data<CycleDetail>(client.get(`/cycles/${id}`))
export const fetchCycleCandidates = (params: ListParams & { start_date: string; end_date: string }) =>
  data<{ people: CycleCandidate[]; working_days: number }>(client.get('/cycles/candidates', { params }))
export const previewCycles = (body: { start_date: string; user_ids: number[]; fill: CycleFill }) => data<CyclePreviewRow[]>(client.post('/cycles/preview', body))
export const createCycles = (body: { start_date: string; end_date: string; user_ids: number[]; fill: CycleFill }) =>
  client.post<{ data: CycleListItem[]; skipped: CycleSkipped[] }>('/cycles', body).then((response) => response.data)
export const updateCycleDates = (id: number, body: { start_date: string; end_date: string }) => data<CycleDetail>(client.put(`/cycles/${id}`, body))
export const deleteCycle = (id: number) => client.delete(`/cycles/${id}`)

export const fetchCycleProfessionals = (cycleId: number, params: ListParams) =>
  client.get<{ data: CycleProfessional[]; meta: Paged<unknown>['meta'] & { states: Partial<Record<CycleProState, number>> } }>(`/cycles/${cycleId}/professionals`, { params }).then((response) => response.data)
export const fetchAvailableProfessionals = (cycleId: number, params: ListParams & { scope: 'territory' | 'all' }) =>
  client.get<{ data: AvailableProfessional[]; meta: Paged<unknown>['meta'] & { territory_count: number; kinds: string[] } }>(`/cycles/${cycleId}/professionals/available`, { params }).then((response) => response.data)
export const addCycleProfessionals = (cycleId: number, body: { hcp_ids: number[]; segmentation_id: number | null }) =>
  data<{ added: number; skipped: number }>(client.post(`/cycles/${cycleId}/professionals`, body))
export const setCycleSegment = (cycleId: number, body: { target_ids: number[]; segmentation_id: number | null }) =>
  data<{ updated: number }>(client.put(`/cycles/${cycleId}/professionals/segment`, body))
export const removeCycleProfessionals = (cycleId: number, targetIds: number[]) =>
  data<{ removed: number }>(client.delete(`/cycles/${cycleId}/professionals`, { data: { target_ids: targetIds } }))
export const fetchTerritoryCheck = (cycleId: number) => data<TerritoryCheck>(client.get(`/cycles/${cycleId}/territory-check`))
export const fetchCycleHistory = (cycleId: number) => data<CycleHistoryRow[]>(client.get(`/cycles/${cycleId}/history`))
/** The activities' picker: professionals of the cycles running on a day, "Dr Kaci · Karim Bensaïd". */
export const searchCycleProfessionals = (params: ListParams) =>
  data<{ id: number; name: string; type: string; rep: string | null; cycle_id: number; start_date: string; end_date: string }[]>(client.get('/cycles/professionals/search', { params }))
export const fetchHcpCycles = (hcpId: number, params?: ListParams) => client.get<Paged<HcpCycleRow>>(`/hcps/${hcpId}/cycles`, { params }).then((response) => response.data)

/** Every cycle of a month matching the filters (the export, "Préparer le mois prochain"), 100 at a time. */
export async function fetchWholeBoard(params: CycleBoardParams): Promise<CycleBoardRow[]> {
  const rows: CycleBoardRow[] = []
  for (let page = 1; ; page++) {
    const result = await fetchCycleBoard({ ...params, page, per_page: 100 })
    rows.push(...result.data)
    if (!result.data.length || rows.length >= result.meta.total) break
  }
  return rows
}
