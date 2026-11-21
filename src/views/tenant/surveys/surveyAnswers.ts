import type { SurveyAnswer, SurveyQuestion } from '@/api/tenant/surveys'

/**
 * A survey being answered, as the form holds it: one entry per question (docs/api/survey-answers.md).
 * Numbers stay text while typed; `payloadOf` turns the draft into what the API takes.
 * Example: { 70: { value: '120', option_ids: [], other_text: '' }, 73: { value: '', option_ids: [41], other_text: '' } }
 */
export type AnswerDraft = Record<number, { value: string; option_ids: number[]; other_text: string }>

const answerable = (questions: SurveyQuestion[]) => questions.filter(question => question.type !== 'title')

/** The form's draft, filled with answers already given (this visit's, or the last ones for « Reprendre »). */
export function draftOf(questions: SurveyQuestion[], answers: SurveyAnswer[] | null = null): AnswerDraft {
  const draft: AnswerDraft = {}
  for (const question of answerable(questions)) {
    const given = answers?.find(answer => answer.question_id === question.id)
    draft[question.id] = {
      value: given?.value == null ? '' : String(given.value),
      option_ids: [...(given?.option_ids ?? [])],
      other_text: given?.other_text ?? '',
    }
  }
  return draft
}

const filled = (entry: AnswerDraft[number] | undefined) => !!entry && (entry.value.trim() !== '' || entry.option_ids.length > 0)

/** The answers given, as the API takes them; an empty question is not sent. */
export function payloadOf(questions: SurveyQuestion[], draft: AnswerDraft): SurveyAnswer[] {
  return answerable(questions).filter(question => filled(draft[question.id])).map((question) => {
    const entry = draft[question.id]!
    if (question.options.length) {
      const other = question.options.some(option => option.is_other && entry.option_ids.includes(option.id))
      return { question_id: question.id, option_ids: entry.option_ids, ...(other ? { other_text: entry.other_text.trim() } : {}) }
    }
    const numeric = question.type === 'numeric' || question.type === 'percentage'
    return { question_id: question.id, value: numeric ? Number(entry.value.replace(',', '.')) : entry.value.trim() }
  })
}

/** Q-numbers of the required questions still empty (only once the survey is started: something is answered). */
export function missingRequired(questions: SurveyQuestion[], draft: AnswerDraft): string[] {
  const started = answerable(questions).some(question => filled(draft[question.id]))
  if (!started) return []
  return answerable(questions).filter(question => question.is_required && !filled(draft[question.id])).map(question => question.number ?? '')
}

/** An answer as a page shows it: the number, the text, the labels chosen (« Autre » with its text). */
export function answerText(question: SurveyQuestion, answer: SurveyAnswer | undefined, otherLabel: (text: string) => string): string | null {
  if (!answer) return null
  if (answer.option_ids?.length) {
    return question.options.filter(option => answer.option_ids!.includes(option.id))
      .map(option => (option.is_other ? otherLabel(answer.other_text ?? '') : option.label)).join(', ')
  }
  if (answer.value == null || answer.value === '') return null
  return question.type === 'percentage' ? `${answer.value} %` : String(answer.value)
}
