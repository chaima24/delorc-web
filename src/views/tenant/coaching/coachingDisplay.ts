import { useI18n } from 'vue-i18n'
import type { CoachingState } from '@/api/tenant/coaching'

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
