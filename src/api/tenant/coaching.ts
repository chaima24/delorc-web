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
