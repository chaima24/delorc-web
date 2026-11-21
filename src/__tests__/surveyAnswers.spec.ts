import { describe, expect, it } from 'vitest'
import type { SurveyQuestion } from '@/api/tenant/surveys'
import { answerText, draftOf, missingRequired, payloadOf } from '@/views/tenant/surveys/surveyAnswers'

const q = (id: number, type: SurveyQuestion['type'], more: Partial<SurveyQuestion> = {}): SurveyQuestion => ({
  id, number: type === 'title' ? null : `Q${id}`, type, question_text: `Question ${id}`, parent_id: null, category: null, is_required: false, display: null, options: [], display_match: 'all', conditions: [], checks: [], ...more,
})
const questions = [
  q(0, 'title'),
  q(1, 'numeric', { is_required: true }),
  q(2, 'percentage', { is_required: true }),
  q(3, 'single_choice', { options: [{ id: 31, label: 'CHU Mustapha', is_other: false }, { id: 32, label: 'Autre, à préciser', is_other: true }] }),
  q(4, 'text'),
]

describe('survey answers in the visit report', () => {
  it('sends only the questions answered, numbers as numbers, « Autre » with its text', () => {
    const draft = draftOf(questions)
    draft[1]!.value = '120'
    draft[2]!.value = '12,5'
    draft[3]!.option_ids = [32]
    draft[3]!.other_text = ' EPH Bologhine '
    expect(payloadOf(questions, draft)).toEqual([
      { question_id: 1, value: 120 },
      { question_id: 2, value: 12.5 },
      { question_id: 3, option_ids: [32], other_text: 'EPH Bologhine' },
    ])
  })

  it('asks for the required questions only once the survey is started', () => {
    const draft = draftOf(questions)
    expect(missingRequired(questions, draft)).toEqual([])
    draft[4]!.value = 'Préfère les génériques'
    expect(missingRequired(questions, draft)).toEqual(['Q1', 'Q2'])
  })

  it('fills the form from answers given and shows them as text', () => {
    const answers = [{ question_id: 2, value: 30 }, { question_id: 3, option_ids: [32], other_text: 'EPH' }]
    const draft = draftOf(questions, answers)
    expect(draft[2]!.value).toBe('30')
    expect(draft[3]!.option_ids).toEqual([32])
    expect(answerText(questions[2]!, answers[0], text => `Autre : ${text}`)).toBe('30 %')
    expect(answerText(questions[3]!, answers[1], text => `Autre : ${text}`)).toBe('Autre : EPH')
    expect(answerText(questions[4]!, undefined, text => text)).toBeNull()
  })
})
