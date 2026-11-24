import type { NumberOperator, SurveyAnswer, SurveyCheck, SurveyQuestion } from '@/api/tenant/surveys'

/**
 * A survey's rules applied to answers, in the browser (docs/api/survey-rules.md). The same logic as the API's
 * SurveyRuleService, so the report shows live what the API checks on save:
 * - a question is shown when its title is (if it has one) and its own conditions are met (`all` or `any`);
 * - a condition whose source is hidden or unanswered is not met (for « est » and « n'est pas » alike);
 * - a check applies only when every question in it is shown and answered.
 * Example: Q5 « si Q4 est Oui »: with Q4 = Non, `shown(...)[Q5]` is false.
 */
export type Answers = Map<number, SurveyAnswer>

export const answersMap = (answers: SurveyAnswer[]): Answers => new Map(answers.map(answer => [answer.question_id, answer]))

export function compare(left: number, operator: NumberOperator, right: number): boolean {
  switch (operator) {
    case 'lt': return left < right
    case 'lte': return left <= right
    case 'eq': return Math.abs(left - right) < 1e-9
    case 'gte': return left >= right
    case 'gt': return left > right
  }
}

const numberOf = (answer: SurveyAnswer | undefined): number | null =>
  (answer && typeof answer.value === 'number' && Number.isFinite(answer.value) ? answer.value : null)

/** Shown or not, per question id, in the survey's order. */
export function shown(questions: SurveyQuestion[], answers: Answers): Record<number, boolean> {
  const result: Record<number, boolean> = {}
  for (const question of questions) {
    const titleShown = question.parent_id === null || (result[question.parent_id] ?? true)
    result[question.id] = titleShown && met(question, answers, result)
  }
  return result
}

function met(question: SurveyQuestion, answers: Answers, result: Record<number, boolean>): boolean {
  const conditions = question.conditions ?? []
  if (!conditions.length) return true
  const results = conditions.map((condition) => {
    const answer = answers.get(condition.source_question_id)
    if (!result[condition.source_question_id] || !answer) return false
    if (condition.operator === 'is' || condition.operator === 'is_not') {
      const chosen = (answer.option_ids ?? []).some(id => (condition.option_ids ?? []).includes(id))
      return condition.operator === 'is' ? chosen : !chosen
    }
    const value = numberOf(answer)
    return value !== null && compare(value, condition.operator, Number(condition.value))
  })
  return question.display_match === 'any' ? results.includes(true) : !results.includes(false)
}

/** What a failing check says; `words` turns the parts into the lab's sentence. */
export interface CheckWords {
  compare: (parts: { question: string; operator: NumberOperator; other: string; value: number }) => string
  sum: (parts: { questions: string; value: number; total: number }) => string
}

/** The checks that fail, question id → message. */
export function failing(questions: SurveyQuestion[], answers: Answers, visible: Record<number, boolean>, words: CheckWords): Record<number, string> {
  const byId = new Map(questions.map(question => [question.id, question]))
  const known = (id: number | null | undefined) => id != null && !!visible[id] && numberOf(answers.get(id)) !== null
  const found: Record<number, string> = {}
  for (const question of questions) {
    for (const check of question.checks ?? []) {
      const message = check.type === 'compare' ? failingCompare(question, check, byId, answers, known, words) : failingSum(check, byId, answers, known, words)
      if (message && !found[question.id]) found[question.id] = message
    }
  }
  return found
}

function failingCompare(question: SurveyQuestion, check: SurveyCheck, byId: Map<number, SurveyQuestion>, answers: Answers, known: (id?: number | null) => boolean, words: CheckWords): string | null {
  if (!known(question.id) || !known(check.compare_question_id) || !check.operator) return null
  const other = numberOf(answers.get(check.compare_question_id!))!
  if (compare(numberOf(answers.get(question.id))!, check.operator, other)) return null
  return words.compare({ question: question.number ?? '', operator: check.operator, other: byId.get(check.compare_question_id!)?.number ?? '', value: other })
}

function failingSum(check: SurveyCheck, byId: Map<number, SurveyQuestion>, answers: Answers, known: (id?: number | null) => boolean, words: CheckWords): string | null {
  const ids = check.question_ids ?? []
  if (ids.some(id => !known(id))) return null
  const total = sumOf(ids, answers)
  if (Math.abs(total - Number(check.value)) < 1e-9) return null
  return words.sum({ questions: ids.map(id => byId.get(id)?.number ?? '').join(' + '), value: Number(check.value), total })
}

/** The running total of a sum, the empty answers counting 0 (shown under the question while typing). */
export function sumOf(ids: number[], answers: Answers): number {
  return Math.round(ids.reduce((total, id) => total + (numberOf(answers.get(id)) ?? 0), 0) * 10_000) / 10_000
}
