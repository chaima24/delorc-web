import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'

/**
 * Enquêtes, part 19a (docs/api/surveys.md): a survey and its questions, draft → open → closed.
 * A question of type `title` has no answer and holds the questions under it (`parent_id`).
 */

export type SurveyStatus = 'draft' | 'open' | 'closed'
export const SURVEY_STATUSES: SurveyStatus[] = ['draft', 'open', 'closed']

/** Who answers: doctors (dentists too), pharmacies, or both. */
export type SurveyTarget = 'doctor' | 'pharmacy' | 'both'
export const SURVEY_TARGETS: SurveyTarget[] = ['doctor', 'pharmacy', 'both']

export type QuestionType = 'numeric' | 'percentage' | 'single_choice' | 'multiple_choice' | 'text' | 'free_text' | 'title'
/** The types with an answer, in the order the « Nouvelle question » panel shows them. */
export const ANSWER_TYPES: QuestionType[] = ['numeric', 'percentage', 'single_choice', 'multiple_choice', 'text', 'free_text']
export const CHOICE_TYPES: QuestionType[] = ['single_choice', 'multiple_choice']

/** How a choice is drawn: every option shown, or a dropdown. */
export type QuestionDisplay = 'expanded' | 'list'

export interface SurveyOption { id: number; label: string; is_other: boolean }

export interface SurveyQuestion {
  id: number
  /** Q1, Q2… counted by the API; null for a title. */
  number: string | null
  type: QuestionType
  question_text: string
  parent_id: number | null
  category: { id: number; category: string } | null
  is_required: boolean
  display: QuestionDisplay | null
  options: SurveyOption[]
}

export interface SurveyHistoryLine {
  event: string
  by: string | null
  at: string
  old: Record<string, unknown> | null
  new: Record<string, unknown> | null
  /** The question changed, or the survey a copy comes from. */
  text: string | null
}

export interface Survey {
  id: number
  name: string
  status: SurveyStatus
  target_type: SurveyTarget
  is_per_visit: boolean
  start_date: string
  end_date: string
  weeks_count: number
  objective_per_week: number | null
  brands?: { id: number; name: string }[]
  created_by?: { id: number; full_name: string } | null
  /** Only on the page. */
  questions?: SurveyQuestion[]
  questions_count: number
  required_count: number
  can?: { update: boolean; delete: boolean; open: boolean; close: boolean; duplicate: boolean }
  history?: SurveyHistoryLine[]
  created_at: string | null
}

export interface SurveyPayload {
  name?: string
  target_type?: SurveyTarget
  is_per_visit?: boolean
  start_date?: string
  end_date?: string
  objective_per_week?: number | null
  brand_ids?: number[]
}

export interface QuestionPayload {
  type: QuestionType
  question_text: string
  survey_question_category_id?: number | null
  is_required?: boolean
  parent_id?: number | null
  display?: QuestionDisplay | null
  options?: { label: string; is_other: boolean }[]
}

export interface QuestionCategory { id: number; category: string; questions_count: number; created_at: string | null }

const one = <T>(request: Promise<{ data: { data: T } }>) => request.then(response => response.data.data)

const URL = '/surveys'

export const fetchSurveys = (params?: ListParams) =>
  client.get<{ data: Survey[]; meta: { total: number; status_counts: Record<SurveyStatus, number> } }>(URL, { params })
    .then((response): Page<Survey> & { counts: Record<SurveyStatus, number> } => ({
      items: response.data.data, total: response.data.meta.total, counts: response.data.meta.status_counts,
    }))
export const fetchSurvey = (id: number) => one<Survey>(client.get(`${URL}/${id}`))
export const createSurvey = (payload: SurveyPayload) => one<Survey>(client.post(URL, payload))
export const updateSurvey = (id: number, payload: SurveyPayload) => one<Survey>(client.put(`${URL}/${id}`, payload))
export const deleteSurvey = (id: number) => client.delete(`${URL}/${id}`)
export const openSurvey = (id: number) => one<Survey>(client.post(`${URL}/${id}/open`))
export const closeSurvey = (id: number) => one<Survey>(client.post(`${URL}/${id}/close`))
export const duplicateSurvey = (id: number) => one<Survey>(client.post(`${URL}/${id}/duplicate`))

// Questions: every call answers with the whole survey page (the numbers Q1… move together).
export const createQuestion = (survey: number, payload: QuestionPayload) => one<Survey>(client.post(`${URL}/${survey}/questions`, payload))
export const updateQuestion = (survey: number, id: number, payload: QuestionPayload) =>
  one<Survey>(client.put(`${URL}/${survey}/questions/${id}`, payload))
export const deleteQuestion = (survey: number, id: number) => one<Survey>(client.delete(`${URL}/${survey}/questions/${id}`))
export const orderQuestions = (survey: number, items: { id: number; parent_id: number | null }[]) =>
  one<Survey>(client.put(`${URL}/${survey}/questions/order`, { items }))

// Studio › Catégories de questions
const CATEGORIES = '/survey-question-categories'
export const fetchQuestionCategories = (params?: ListParams) =>
  client.get<{ data: QuestionCategory[]; meta: { total: number } }>(CATEGORIES, { params })
    .then((response): Page<QuestionCategory> => ({ items: response.data.data, total: response.data.meta.total }))
/** Every category, for the question panel's select (a short list). */
export const fetchAllQuestionCategories = () => fetchQuestionCategories({ per_page: 100 }).then(page => page.items)
export const createQuestionCategory = (payload: { category: string }) => one<QuestionCategory>(client.post(CATEGORIES, payload))
export const updateQuestionCategory = (id: number, payload: { category: string }) => one<QuestionCategory>(client.put(`${CATEGORIES}/${id}`, payload))
export const deleteQuestionCategory = (id: number) => client.delete(`${CATEGORIES}/${id}`)
