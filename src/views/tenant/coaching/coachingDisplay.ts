import { useI18n } from 'vue-i18n'
import type { CoachingLabel, CoachingSessionState, CoachingSessionStatus, CoachingState } from '@/api/tenant/coaching'

export const STATE_TONE: Record<CoachingState, 'success' | 'info' | 'neutral'> = { current: 'success', upcoming: 'info', ended: 'neutral' }

/** Dates and states of a program, as the pages show them. */
export function useCoachingText() {
  const { t, d } = useI18n()
  const date = (value?: string | null) => (value ? d(new Date(`${value.slice(0, 10)}T00:00:00`), { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

  return {
    date,
    period: (start: string, end: string) => `${date(start)} → ${date(end)}`,
    state: (state: CoachingState) => t(`coaching.state.${state}`),
  }
}

type Tone = 'success' | 'info' | 'neutral' | 'warning' | 'danger'
export const SESSION_TONE: Record<CoachingSessionState, Tone> = { planned: 'info', late: 'warning', validated: 'warning', accepted: 'success', refused: 'danger', cancelled: 'neutral' }
export const LABEL_TONE: Record<CoachingLabel, Tone> = { insufficient: 'danger', fair: 'warning', good: 'success', excellent: 'success' }

/** `late` is not a stored status: a planned session whose day has passed. */
export const sessionState = (row: { status: CoachingSessionStatus; is_late: boolean }): CoachingSessionState => (row.is_late ? 'late' : row.status)

/** States, scores and days of a session, as the pages show them. */
export function useSessionText() {
  const { t, d, n } = useI18n()
  const day = (value?: string | null) => (value ? d(new Date(`${value.slice(0, 10)}T00:00:00`), { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—')

  return {
    day,
    state: (row: { status: CoachingSessionStatus; is_late: boolean }) => t(`coaching.sessions.state.${sessionState(row)}`),
    score: (value: number | null) => (value == null ? '—' : `${n(Math.round(value))} %`),
    average: (value: number | null) => (value == null ? '—' : n(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })),
    label: (label: CoachingLabel | null) => (label ? t(`coaching.sessions.label.${label}`) : ''),
  }
}
