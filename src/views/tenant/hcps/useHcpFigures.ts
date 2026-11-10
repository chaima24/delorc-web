import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Hcp } from '@/api/tenant/hcps'
import { useHcpText } from './hcpForm'

export interface HcpFigure {
  key: 'visits' | 'last' | 'cycle' | 'consent'
  label: string
  value: string
  note: string
  /** Text color of the value. */
  tone?: string
}

/** The 4 figures of a record (visits, last visit, current cycle, consent), from `activity`; none until visits exist. */
export function useHcpFigures(hcp: MaybeRefOrGetter<Hcp | null | undefined>) {
  const { t, n } = useI18n()
  const text = useHcpText()

  return computed<HcpFigure[]>(() => {
    const activity = toValue(hcp)?.activity
    if (!activity || activity.visits_year === undefined) return []
    const { last_visit: last, current_cycle: cycle, consent } = activity
    const consentState = !consent ? 'none' : consent.approval === null ? 'pending' : consent.approval ? 'given' : 'refused'

    return [
      {
        key: 'visits',
        label: t('hcps.figures.visits'),
        value: n(activity.visits_year),
        note: t('hcps.figures.visitsNote', { year: new Date().getFullYear(), total: n(activity.visits_total ?? 0) }),
      },
      {
        key: 'last',
        label: t('hcps.figures.lastVisit'),
        value: last ? text.shortDate(last.visited_at) : '—',
        note: last ? (last.user ? t('hcps.figures.by', { name: last.user }) : text.date(last.visited_at)) : t('hcps.figures.neverVisited'),
      },
      {
        key: 'cycle',
        label: t('hcps.figures.cycle'),
        value: cycle ? `${n(cycle.done)} / ${n(cycle.planned)}` : '—',
        note: cycle ? t('hcps.figures.cycleNote', cycle.targets) : t('hcps.figures.notTargeted'),
      },
      {
        key: 'consent',
        label: t('hcps.figures.consent'),
        value: t(`hcps.consent.${consentState}`),
        note: consent?.signed_at
          ? t('hcps.figures.signedOn', { date: text.date(consent.signed_at) })
          : consentState === 'pending' || consentState === 'none' ? t(`hcps.consent.${consentState}Note`) : '',
        tone: consentState === 'given' ? 'text-dl-teal' : consentState === 'refused' ? 'text-dl-rejected' : undefined,
      },
    ]
  })
}
