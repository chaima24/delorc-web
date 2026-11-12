import { useI18n } from 'vue-i18n'
import type { CycleDayKind, CycleProState, CycleState } from '@/api/tenant/cycles'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'

export { monthRange, shiftMonth } from '@/views/tenant/activities/activityDisplay'

export const STATE_TONE: Record<CycleState, 'success' | 'info' | 'neutral'> = { running: 'success', upcoming: 'info', ended: 'neutral' }

export const PRO_STATE_TONE: Record<CycleProState, 'success' | 'info' | 'warning' | 'neutral'> = {
  reached: 'success',
  started: 'info',
  not_seen: 'warning',
  over: 'neutral',
  no_segment: 'warning',
  none_needed: 'neutral',
}

/**
 * Day marks of the strip (docs/design/plan-mockups/Cycles.html). Until visits, a past day without activity is `past`;
 * the visits module brings field (a visit done), none (nothing recorded) and extra (a day off with visits).
 */
export const DAY_CLASS: Record<CycleDayKind, string> = {
  activity: 'bg-dl-cobalt/12 border-transparent',
  half: 'bg-[linear-gradient(90deg,rgb(var(--dl-cobalt)/.12)_50%,rgb(var(--dl-signal-soft))_50%)] border-transparent',
  past: 'border-dl-line',
  future: 'border-dl-line opacity-45',
}

/** formatRange is in every current browser; the project's TS lib predates it. */
type RangeFormat = Intl.DateTimeFormat & { formatRange: (start: Date, end: Date) => string }

const noon = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`)

export function useCycleText() {
  const { t, d, locale } = useI18n()
  return {
    month: (month: string) => d(noon(`${month}-01`), { month: 'long', year: 'numeric' }),
    day: (iso: string) => d(noon(iso), { day: 'numeric', month: 'short' }),
    dayLong: (iso: string) => d(noon(iso), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    weekday: (iso: string) => d(noon(iso), { weekday: 'narrow' }),
    /** "1–31 Oct 2026", in the viewer's language. */
    period: (start: string, end: string) =>
      (new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', year: 'numeric' }) as RangeFormat).formatRange(noon(start), noon(end)),
    /** "Medical rep · Cardio" */
    roleTeam: (person?: { role?: { name: string } | null; team?: { name: string | null } | null } | null) =>
      [roleLabel(person?.role?.name), person?.team?.name].filter(Boolean).join(' · '),
    state: (state: CycleState, start?: string) => state === 'upcoming' && start ? t('cycles.state.startsOn', { date: d(noon(start), { day: 'numeric', month: 'short' }) }) : t(`cycles.state.${state}`),
    kind: (type: string) => t(`hcps.types.${type}`),
    /** ½ for half days. */
    days: (value: number) => (Number.isInteger(value) ? String(value) : `${Math.floor(value) || ''}½`),
  }
}

export const percent = (value: number) => `${Math.round(value)}%`
