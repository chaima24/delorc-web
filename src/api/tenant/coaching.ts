import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'

/**
 * Coaching, part 11a (docs/api/coaching-setup.md): the grid the coach notes from (families › sections › questions,
 * noted 1 to 4) and the programs (which roles coach which roles, when, with which sections).
 */

/** A section of a family, with its questions counts and how many programs use it. */
export interface CoachingSection {
  id: number
  name: string
  parent_id: number
  questions_count: number
  active_count: number
  used_by_programs: number
}

export interface CoachingFamily {
  id: number
  name: string
  parent_id: null
  sections: CoachingSection[]
}

export interface CoachingQuestion {
  id: number
  coaching_category_id: number
  question: string
  sort: number
  is_active: boolean
}

export interface CoachingOpenQuestion {
  id: number
  coaching_id: number
  question: string
  sort: number
}

export type CoachingState = 'upcoming' | 'current' | 'ended'
export interface CoachingRole { id: number; name: string }

export interface Coaching {
  id: number
  name: string
  start_date: string
  end_date: string
  state: CoachingState
  coach_roles: CoachingRole[]
  coached_roles: CoachingRole[]
  sections: { id: number; name: string; family: { id: number; name: string }; active_count: number }[]
  /** The list's "Sections" column: each family with how many of its sections the program uses. */
  families: { name: string; sections_count: number }[]
  sections_count: number
  /** Only on the page. */
  open_questions?: CoachingOpenQuestion[]
  open_questions_count?: number
  /** 0 until the sessions (11b). */
  sessions_count: number
  created_by?: { id: number; full_name: string } | null
  created_at: string | null
}

export interface CoachingPayload {
  name?: string
  start_date?: string
  end_date?: string
  coach_role_ids?: number[]
  coached_role_ids?: number[]
  /** Sections only. */
  category_ids?: number[]
}

const one = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

// The grid
export const fetchCoachingTree = () => client.get<{ data: CoachingFamily[] }>('/coaching-categories').then((response) => response.data.data)
export const createCoachingCategory = (payload: { name: string; parent_id?: number | null }) => one(client.post('/coaching-categories', payload))
export const updateCoachingCategory = (id: number, payload: { name?: string; parent_id?: number | null }) => one(client.put(`/coaching-categories/${id}`, payload))
export const deleteCoachingCategory = (id: number) => client.delete(`/coaching-categories/${id}`)

export const fetchCoachingQuestions = (sectionId: number) =>
  client.get<{ data: CoachingQuestion[] }>('/coaching-questions', { params: { 'filter[coaching_category_id]': sectionId } }).then((response) => response.data.data)
export const createCoachingQuestion = (payload: { coaching_category_id: number; question: string; sort?: number; is_active?: boolean }) =>
  one<CoachingQuestion>(client.post('/coaching-questions', payload))
export const updateCoachingQuestion = (id: number, payload: Partial<Omit<CoachingQuestion, 'id'>>) =>
  one<CoachingQuestion>(client.put(`/coaching-questions/${id}`, payload))
export const deleteCoachingQuestion = (id: number) => client.delete(`/coaching-questions/${id}`)

// The programs
export const fetchCoachings = (params?: ListParams) =>
  client.get<{ data: Coaching[]; meta: { total: number } }>('/coachings', { params })
    .then((response): Page<Coaching> => ({ items: response.data.data, total: response.data.meta.total }))
export const fetchCoaching = (id: number) => one<Coaching>(client.get(`/coachings/${id}`))
export const createCoaching = (payload: CoachingPayload) => one<Coaching>(client.post('/coachings', payload))
export const updateCoaching = (id: number, payload: CoachingPayload) => one<Coaching>(client.put(`/coachings/${id}`, payload))
export const deleteCoaching = (id: number) => client.delete(`/coachings/${id}`)

export const createCoachingOpenQuestion = (coachingId: number, question: string) =>
  one<CoachingOpenQuestion>(client.post('/coaching-open-questions', { coaching_id: coachingId, question }))
export const updateCoachingOpenQuestion = (id: number, payload: { question?: string; sort?: number }) =>
  one<CoachingOpenQuestion>(client.put(`/coaching-open-questions/${id}`, payload))
export const deleteCoachingOpenQuestion = (id: number) => client.delete(`/coaching-open-questions/${id}`)

// The sessions (docs/api/coaching-sessions.md)
export type CoachingSessionStatus = 'planned' | 'validated' | 'accepted' | 'refused' | 'cancelled'
/** What a list filters on: `late` = planned with its day passed, `planned` = planned for today or later. */
export type CoachingSessionState = CoachingSessionStatus | 'late'
export type CoachingLabel = 'insufficient' | 'fair' | 'good' | 'excellent'

export interface CoachingPerson { id: number; full_name: string; role: string | null; team: string | null }

/** A list row; the page adds everything below `score`. */
export interface CoachingSession {
  id: number
  date: string
  status: CoachingSessionStatus
  is_late: boolean
  coach: { id: number; full_name: string }
  medical_rep: CoachingPerson
  coaching: { id: number; name: string }
  score: number | null
}

export interface CoachingSessionQuestion { id: number; question: string; note: number | null; response: string | null }

export interface CoachingSessionPage extends CoachingSession {
  objective: string | null
  next_objective: string | null
  comment: string | null
  refusal_reason: string | null
  cancel_reason: string | null
  validated_at: string | null
  answered_at: string | null
  previous_score: number | null
  sections: { id: number; name: string; family: string; average: number | null; label: CoachingLabel | null; questions: CoachingSessionQuestion[] }[]
  open_questions: { id: number; question: string; response: string | null }[]
  visits: { id: number; target: string | null; kind: string | null; speciality: string | null; commune: string | null; status: string; brands: string[] }[]
  /** `from_visits`: not saved by the coach yet, read from the day's accompanied visits. */
  counts: { generalist: number; specialist: number; pharmacy: number; from_visits: boolean }
  brands: { id: number; name: string }[]
  can: { update: boolean; validate: boolean; answer: boolean; cancel: boolean; delete: boolean }
}

export interface CoachingSessionDraft {
  date?: string
  objective?: string | null
  next_objective?: string | null
  comment?: string | null
  generalist_doctors_count?: number | null
  specialist_doctors_count?: number | null
  pharmacy_count?: number | null
  brand_ids?: number[]
  responses?: { coaching_question_id: number; note: number | null; response?: string | null }[]
  open_responses?: { coaching_open_question_id: number; response: string | null }[]
}

/** The program a session would use, and the objective it would start from. */
export interface CoachingResolved {
  coaching: { id: number; name: string; sections_count: number; questions_count: number; open_questions_count: number }
  objective: string | null
  objective_from: string | null
}

const session = (request: Promise<{ data: { data: CoachingSessionPage } }>) => request.then((response) => response.data.data)

export const fetchCoachingSessions = (params?: ListParams) =>
  client.get<{ data: CoachingSession[]; meta: { total: number } }>('/coaching-details', { params })
    .then((response): Page<CoachingSession> => ({ items: response.data.data, total: response.data.meta.total }))
export const fetchCoachingSessionCounts = () =>
  client.get<{ data: { planned: number; late: number; validated: number; refused: number } }>('/coaching-details/counts').then((response) => response.data.data)
export const fetchCoachingPeople = () => client.get<{ data: CoachingPerson[] }>('/coaching-details/people').then((response) => response.data.data)
export const resolveCoaching = (personId: number, date: string) =>
  client.get<{ data: CoachingResolved }>('/coaching-details/resolve', { params: { medical_rep_id: personId, date } }).then((response) => response.data.data)
export const fetchCoachingSession = (id: number) => session(client.get(`/coaching-details/${id}`))
export const planCoachingSession = (payload: { medical_rep_id: number; date: string; objective?: string | null }) => session(client.post('/coaching-details', payload))
export const saveCoachingSession = (id: number, payload: CoachingSessionDraft) => session(client.put(`/coaching-details/${id}`, payload))
export const validateCoachingSession = (id: number) => session(client.post(`/coaching-details/${id}/validate`))
export const acceptCoachingSession = (id: number) => session(client.post(`/coaching-details/${id}/accept`))
export const refuseCoachingSession = (id: number, reason: string) => session(client.post(`/coaching-details/${id}/refuse`, { reason }))
export const cancelCoachingSession = (id: number, reason: string) => session(client.post(`/coaching-details/${id}/cancel`, { reason }))
export const deleteCoachingSession = (id: number) => client.delete(`/coaching-details/${id}`)

export const fetchCoachingSettings = () => client.get<{ data: { one_per_day: boolean } }>('/coaching-settings').then((response) => response.data.data)
export const saveCoachingSettings = (payload: { one_per_day: boolean }) =>
  client.put<{ data: { one_per_day: boolean } }>('/coaching-settings', payload).then((response) => response.data.data)
