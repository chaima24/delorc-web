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
  /** 19c (docs/api/survey-rules.md): how its conditions combine, its conditions, its checks. */
  display_match: DisplayMatch
  conditions: SurveyCondition[]
  checks: SurveyCheck[]
}

// 19c, the rules (docs/api/survey-rules.md).
export type DisplayMatch = 'all' | 'any'
export type ChoiceOperator = 'is' | 'is_not'
export type NumberOperator = 'lt' | 'lte' | 'eq' | 'gte' | 'gt'
export const NUMBER_OPERATORS: NumberOperator[] = ['lt', 'lte', 'eq', 'gte', 'gt']
/** « Q4 est Oui » (a choice: one of `option_ids`) or « Q1 > 50 » (a number: `value`). `text` is the API's sentence. */
export interface SurveyCondition { source_question_id: number; operator: ChoiceOperator | NumberOperator; option_ids?: number[] | null; value?: number | null; text?: string }
/** « Q2 ≤ Q1 » (`compare`) or « Q6 + Q7 + Q8 = 100 » (`sum`, this question included in `question_ids`). */
export interface SurveyCheck { type: 'compare' | 'sum'; operator?: NumberOperator | null; compare_question_id?: number | null; question_ids?: number[] | null; value?: number | null; text?: string }

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
  /** Who answers (19b-1): the filters of the copy from the cycle; empty = all. */
  copy_filters: CopyFilters
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

export interface CopyFilters { speciality_ids: number[]; segmentation_ids: number[]; wilaya_ids: number[] }

export interface SurveyPayload {
  copy_filters?: Partial<CopyFilters>
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
  /** An option sent with its id keeps it (conditions point at it). */
  options?: { id?: number; label: string; is_other: boolean }[]
  display_match?: DisplayMatch
  conditions?: SurveyCondition[]
  checks?: SurveyCheck[]
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

// 19b-1, who answers (docs/api/survey-respondents.md): people, their lists copied from the cycle, the progress.

export type Pace = 'ahead' | 'on_time' | 'late'
export interface CycleRef { id: number; start_date: string; end_date: string }

export interface Respondent {
  id: number
  user: { id: number; full_name: string }
  team: { id: number; name: string } | null
  /** The cycle the list was copied from; null = no cycle running then. */
  cycle: CycleRef | null
  /** false = paused. */
  is_active: boolean
  list_count: number
  answered_count: number
  answers_count: number
  week_answered: number
  progress: number
  /** Answered expected by now (with an objective), else null. */
  expected: number | null
  pace: Pace | null
}

export interface RespondentFigures {
  people: number
  paused: number
  list_count: number
  answered_count: number
  progress: number
  expected: number | null
  week: number
  weeks_count: number
}

export interface RespondentList {
  items: Respondent[]
  figures: RespondentFigures
  counts: { all: number; late: number; paused: number }
  can: { update: boolean }
  added?: number
  skipped?: number
}

export interface RespondentPreview {
  user: { id: number; full_name: string }
  team: { id: number; name: string } | null
  cycle: CycleRef | null
  cycle_count: number
  list_count: number
  already_in: boolean
}

export interface RespondentHcp {
  hcp: { id: number; name: string; type: string }
  speciality: string | null
  segment: string | null
  wilaya: string | null
  in_territory: boolean
  answered_at: string | null
  /** The latest visit answered (19b-2). */
  answered_visit_id: number | null
  next_visit_date: string | null
}

export interface Recopy { cycle: CycleRef | null; cycle_list_count: number; to_add: number; kept: number; not_in_cycle: number }

export interface MySurvey {
  id: number
  name: string
  target_type: SurveyTarget
  is_per_visit: boolean
  end_date: string
  objective_per_week: number | null
  respondent_id: number
  list_count: number
  answered_count: number
  answers_count: number
  week_answered: number
  progress: number
  expected: number | null
  pace: Pace | null
}

const respondents = (survey: number) => `${URL}/${survey}/respondents`
type ListAnswer = { data: Respondent[]; meta: Omit<RespondentList, 'items'> }
const asList = (response: { data: ListAnswer }): RespondentList => ({ items: response.data.data, ...response.data.meta })

export const fetchRespondents = (survey: number, params?: ListParams) => client.get<ListAnswer>(respondents(survey), { params }).then(asList)
export const fetchFieldPeople = (survey: number, search: string) =>
  client.get<{ data: { id: number; full_name: string; team: { id: number; name: string } | null }[] }>(`${respondents(survey)}/people`, { params: { search } })
    .then(response => response.data.data)
export const previewRespondents = (survey: number, body: { team_ids?: number[]; user_ids?: number[] }) =>
  client.post<{ data: RespondentPreview[]; meta: { people: number; list_count: number } }>(`${respondents(survey)}/preview`, body)
    .then(response => ({ items: response.data.data, ...response.data.meta }))
export const addRespondents = (survey: number, body: { team_ids?: number[]; user_ids?: number[] }) =>
  client.post<ListAnswer>(respondents(survey), body).then(asList)
export const setRespondentActive = (survey: number, id: number, active: boolean) =>
  one<Respondent>(client.put(`${respondents(survey)}/${id}`, { is_active: active }))
export const removeRespondent = (survey: number, id: number) => client.delete(`${respondents(survey)}/${id}`)

export const fetchRespondentHcps = (survey: number, id: number, params?: ListParams) =>
  client.get<{ data: RespondentHcp[]; meta: { total: number; counts: { all: number; todo: number; answered: number } } }>(`${respondents(survey)}/${id}/professionals`, { params })
    .then(response => ({ items: response.data.data, total: response.data.meta.total, counts: response.data.meta.counts }))
export const fetchAvailableHcps = (survey: number, id: number, search: string) =>
  client.get<{ data: { id: number; name: string; type: string; wilaya: string | null }[] }>(`${respondents(survey)}/${id}/available`, { params: { search } })
    .then(response => response.data.data)
export const addRespondentHcps = (survey: number, id: number, hcpIds: number[]) => client.post(`${respondents(survey)}/${id}/professionals`, { hcp_ids: hcpIds })
export const removeRespondentHcp = (survey: number, id: number, hcpId: number) => client.delete(`${respondents(survey)}/${id}/professionals/${hcpId}`)
export const previewRecopy = (survey: number, id: number) => one<Recopy>(client.get(`${respondents(survey)}/${id}/recopy`))
export const recopy = (survey: number, id: number) => one<Recopy>(client.post(`${respondents(survey)}/${id}/recopy`))

export const fetchMySurveys = () => one<MySurvey[]>(client.get('/my-surveys'))

// 19b-2, the answers (docs/api/survey-answers.md): answered in the visit report, read in the « Réponses » tab.

/** One answer as the API sends and takes it: a number or a text in `value`, or the options chosen. */
export interface SurveyAnswer { question_id: number; value?: number | string | null; option_ids?: number[]; other_text?: string | null }
/** One survey's answers on one visit. */
export interface SurveyAnswerSet { visit_id: number; visit_date: string; answers: SurveyAnswer[] }

/** One survey of a visit report. */
export interface VisitSurvey {
  survey: { id: number; name: string; is_per_visit: boolean }
  questions: SurveyQuestion[]
  /** This visit's answers, or null. */
  answers: SurveyAnswer[] | null
  /** « Once »: answered on another visit (read only here). */
  answered: SurveyAnswerSet | null
  /** « At each visit »: the latest earlier answers, for « Reprendre ». */
  last: SurveyAnswerSet | null
  can_answer: boolean
}

/** What the report sends: `answers: []` removes this visit's answers. */
export interface VisitSurveyPayload { survey_id: number; answers: SurveyAnswer[] }

export const fetchVisitSurveys = (params: { user_id?: number | null; visitable_type: string; visitable_id: number; date: string; visit_id?: number }) =>
  client.get<{ data: VisitSurvey[] }>('/visits/surveys', { params }).then(response => response.data.data)

/** A row of the « Réponses » tab: one visit with answers. */
export interface SurveyAnswerRow {
  visit: { id: number; visit_date: string }
  hcp: { id: number; name: string; type: string }
  speciality: string | null
  segment: string | null
  wilaya: string | null
  user: { id: number; full_name: string }
  team: { id: number; name: string } | null
  answered_count: number
  questions_count: number
  /** « At each visit »: the first short answers, shown as columns. */
  columns: { question_id: number; number: string; text: string | number | null }[]
  /** Only on one set: each answer with its text. */
  answers?: (SurveyAnswer & { text: string | number })[]
}

export interface SurveyAnswerExportRow {
  user: string
  team: string | null
  hcp: string
  hcp_type: string
  speciality: string | null
  segment: string | null
  wilaya: string | null
  visit_date: string
  answers: Record<string, string | number>
}

const answersUrl = (survey: number) => `${URL}/${survey}/answers`
export const fetchSurveyAnswers = (survey: number, params?: ListParams) =>
  client.get<{ data: SurveyAnswerRow[]; meta: { total: number; professionals: number } }>(answersUrl(survey), { params })
    .then(response => ({ items: response.data.data, total: response.data.meta.total, professionals: response.data.meta.professionals }))
export const fetchSurveyAnswerSet = (survey: number, visit: number) => one<SurveyAnswerRow>(client.get(`${answersUrl(survey)}/${visit}`))
export const exportSurveyAnswers = (survey: number, params?: ListParams) =>
  client.get<{ data: SurveyAnswerExportRow[]; meta: { questions: { id: number; number: string; question_text: string }[] } }>(`${answersUrl(survey)}/export`, { params })
    .then(response => ({ rows: response.data.data, questions: response.data.meta.questions }))

// 19d-1, segmentation scenarios (docs/api/survey-scenarios.md).

export type ScenarioMatrix = '2x2' | '2x3' | '3x2' | '3x3' | '4x1'
/** Matrix → [columns (X levels), rows (Y levels)]. */
export const SCENARIO_MATRICES: Record<ScenarioMatrix, [number, number]> = { '2x2': [2, 2], '2x3': [2, 3], '3x2': [3, 2], '3x3': [3, 3], '4x1': [4, 1] }
export interface SegmentRef { id: number; name: string; color: string }
export interface ScenarioQuestion { question_id: number; number?: string | null; question_text?: string | null; axis: 'x' | 'y'; coefficient: number }
/** A cell: `column` from the left (weakest X), `row` from the top (strongest Y); cell 0 is the strongest. */
export interface ScenarioCell { index: number; column: number; row: number; segmentation: SegmentRef | null; count: number; share: number; x_avg: number | null; y_avg: number | null }
export interface Scenario {
  id: number
  name: string
  matrix: ScenarioMatrix
  questions: ScenarioQuestion[]
  x_cutoffs: number[]
  y_cutoffs: number[] | null
  cell_segments: number[]
  filters: { speciality_ids: number[]; region_ids: number[] }
  cells: ScenarioCell[]
  segments: { segmentation: SegmentRef | null; count: number; share: number }[]
  classified: number
  unclassified: number
}
export interface ScenarioPayload {
  name?: string
  matrix?: ScenarioMatrix
  questions?: { question_id: number; axis: 'x' | 'y'; coefficient?: number }[]
  x_cutoffs?: number[]
  y_cutoffs?: number[] | null
  cell_segments?: number[]
  filters?: { speciality_ids: number[]; region_ids: number[] } | null
}
export interface ScenarioRow { user: { id: number; full_name: string }; hcp: { id: number; name: string }; speciality: string | null; region: string | null; x: number | null; y: number | null; cell: number | null; segmentation_id: number | null }

const scenarios = (survey: number) => `${URL}/${survey}/scenarios`
export const fetchScenarios = (survey: number) => client.get<{ data: Scenario[] }>(scenarios(survey)).then(response => response.data.data)
export const fetchScenario = (survey: number, id: number) => one<Scenario>(client.get(`${scenarios(survey)}/${id}`))
export const createScenario = (survey: number, payload: ScenarioPayload) => one<Scenario>(client.post(scenarios(survey), payload))
export const updateScenario = (survey: number, id: number, payload: ScenarioPayload) => one<Scenario>(client.put(`${scenarios(survey)}/${id}`, payload))
export const duplicateScenario = (survey: number, id: number) => one<Scenario>(client.post(`${scenarios(survey)}/${id}/duplicate`))
export const deleteScenario = (survey: number, id: number) => client.delete(`${scenarios(survey)}/${id}`)
export const fetchScenarioRows = (survey: number, id: number, params?: ListParams) =>
  client.get<{ data: ScenarioRow[]; meta: { total: number } }>(`${scenarios(survey)}/${id}/rows`, { params })
    .then((response): Page<ScenarioRow> => ({ items: response.data.data, total: response.data.meta.total }))
export const exportScenarioRows = (survey: number, id: number, params?: ListParams) =>
  client.get<{ data: ScenarioRow[] }>(`${scenarios(survey)}/${id}/rows/export`, { params }).then(response => response.data.data)
