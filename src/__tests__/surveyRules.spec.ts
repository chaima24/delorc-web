import { describe, expect, it } from 'vitest'
import type { SurveyQuestion } from '@/api/tenant/surveys'
import { answersMap, failing, shown, sumOf, type CheckWords } from '@/views/tenant/surveys/surveyRules'

// The same survey as the API's SurveyRuleTest: Q1 patients, Q2 hypertensive (≤ Q1), Q3 practice; the title shown if
// Q3 is Privé or Mixte, with Q4 statin, Q5 (if Q4 is Oui), Q6 (if Q4 is Oui and Q1 > 50), Q7, Q8 (Q6 + Q7 + Q8 = 100).
const q = (id: number, type: SurveyQuestion['type'], more: Partial<SurveyQuestion> = {}): SurveyQuestion => ({
  id, number: `Q${id}`, type, question_text: '', parent_id: null, category: null, is_required: false, display: null, options: [],
  display_match: 'all', conditions: [], checks: [], ...more,
})
const yes = { source_question_id: 4, operator: 'is' as const, option_ids: [41] }
const questions = [
  q(1, 'numeric'),
  q(2, 'numeric', { checks: [{ type: 'compare', operator: 'lte', compare_question_id: 1 }] }),
  q(3, 'single_choice', { options: [{ id: 31, label: 'Public', is_other: false }, { id: 32, label: 'Privé', is_other: false }, { id: 33, label: 'Mixte', is_other: false }] }),
  q(10, 'title', { number: null, conditions: [{ source_question_id: 3, operator: 'is', option_ids: [32, 33] }] }),
  q(4, 'single_choice', { parent_id: 10, options: [{ id: 41, label: 'Oui', is_other: false }, { id: 42, label: 'Non', is_other: false }] }),
  q(5, 'single_choice', { parent_id: 10, conditions: [yes] }),
  q(6, 'percentage', { parent_id: 10, conditions: [yes, { source_question_id: 1, operator: 'gt', value: 50 }] }),
  q(7, 'percentage', { parent_id: 10 }),
  q(8, 'percentage', { parent_id: 10, checks: [{ type: 'sum', question_ids: [6, 7, 8], value: 100 }] }),
]
const words: CheckWords = {
  compare: p => `${p.question} ${p.operator} ${p.other} (${p.value})`,
  sum: p => `${p.questions} = ${p.value} (${p.total})`,
}

describe('survey rules in the browser', () => {
  it('hides a title and its questions, and a question whose source is hidden', () => {
    const answers = answersMap([{ question_id: 3, option_ids: [31] }, { question_id: 4, option_ids: [41] }])
    const visible = shown(questions, answers)
    expect([visible[10], visible[4], visible[5]]).toEqual([false, false, false])
    expect(visible[1]).toBe(true)
  })

  it('combines conditions with « toutes », and « au moins une »', () => {
    const answers = answersMap([{ question_id: 1, value: 40 }, { question_id: 3, option_ids: [32] }, { question_id: 4, option_ids: [41] }])
    expect(shown(questions, answers)[5]).toBe(true)
    expect(shown(questions, answers)[6]).toBe(false)
    const any = questions.map(one => (one.id === 6 ? { ...one, display_match: 'any' as const } : one))
    expect(shown(any, answers)[6]).toBe(true)
  })

  it('runs a compare and a sum only when every side is shown and answered', () => {
    let answers = answersMap([{ question_id: 1, value: 40 }, { question_id: 2, value: 60 }, { question_id: 3, option_ids: [32] }, { question_id: 4, option_ids: [41] }, { question_id: 7, value: 50 }, { question_id: 8, value: 20 }])
    expect(failing(questions, answers, shown(questions, answers), words)).toEqual({ 2: 'Q2 lte Q1 (40)' })

    answers = answersMap([{ question_id: 1, value: 60 }, { question_id: 3, option_ids: [32] }, { question_id: 4, option_ids: [41] }, { question_id: 6, value: 20 }, { question_id: 7, value: 50 }, { question_id: 8, value: 20 }])
    expect(failing(questions, answers, shown(questions, answers), words)).toEqual({ 8: 'Q6 + Q7 + Q8 = 100 (90)' })
    expect(sumOf([6, 7, 8], answers)).toBe(90)
  })
})
