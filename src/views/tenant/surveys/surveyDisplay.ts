import { useI18n } from 'vue-i18n'
import type { QuestionType, SurveyStatus, SurveyTarget } from '@/api/tenant/surveys'

export const STATUS_TONE: Record<SurveyStatus, 'neutral' | 'info' | 'success'> = { draft: 'neutral', open: 'info', closed: 'success' }

/** Dates, states, targets, modes and question types of Enquêtes, as the pages show them. */
export function useSurveyText() {
  const { t, d } = useI18n()
  const date = (value?: string | null) => (value ? d(new Date(value.length === 10 ? `${value}T00:00:00` : value), { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

  return {
    date,
    period: (start: string, end: string) => `${date(start)} → ${date(end)}`,
    status: (status: SurveyStatus) => t(`surveys.status.${status}`),
    target: (target: SurveyTarget) => t(`surveys.target.${target}`),
    mode: (perVisit: boolean) => t(perVisit ? 'surveys.mode.perVisit' : 'surveys.mode.once'),
    type: (type: QuestionType) => t(`surveys.types.${type}.name`),
  }
}

/** Today as 'YYYY-MM-DD'. */
export function today(): string {
  const day = new Date()
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
}

/** Weeks of a period, as the API counts them: 1 Dec → 31 Jan = 9. */
export function weeks(start: string, end: string): number {
  if (!start || !end || end < start) return 0
  const days = Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86_400_000) + 1
  return Math.max(1, Math.ceil(days / 7))
}
