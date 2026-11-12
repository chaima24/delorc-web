import { useI18n } from 'vue-i18n'
import { DURATIONS, type Activity, type ActivityKind } from '@/api/tenant/activities'
import type { ActivityType } from '@/api/tenant/fieldSetup'

/** Kind of day of a type (Studio › Activity types). */
export function kindOfType(type?: Pick<ActivityType, 'type'> | null): ActivityKind {
  if (type?.type === 'off_field_work_days') return 'off'
  if (type?.type === 'non_working_days') return 'non'
  return 'field'
}

export const KIND_TONE: Record<ActivityKind, 'info' | 'warning' | 'signal'> = { off: 'info', non: 'warning', field: 'signal' }
export const KIND_DAY_TYPE: Record<ActivityKind, string> = { off: 'off_field_work_days', non: 'non_working_days', field: 'field_days' }

export const durationKey = (value: number) => DURATIONS.find(row => row.value === value)?.key ?? 'all_day'

/** First and last day (ISO) of the month of `month` ("2026-10"). */
export function monthRange(month: string): { from: string; to: string } {
  const [year = 0, index = 1] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, index, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

export function shiftMonth(month: string, by: number): string {
  const [year = 0, index = 1] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, index - 1 + by, 1))
  return date.toISOString().slice(0, 7)
}

export function useActivityText() {
  const { t, d } = useI18n()
  const day = (iso: string, withYear = false) =>
    d(new Date(`${iso.slice(0, 10)}T12:00:00`), withYear ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' })
  const time = (iso: string) => iso.slice(11, 16)
  /** The last day covered (end_at is the next midnight for whole days). */
  const lastDay = (activity: Activity) => {
    const end = new Date(`${activity.end_at!.replace(' ', 'T')}`)
    end.setSeconds(end.getSeconds() - 1)
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  }

  return {
    day,
    month: (month: string) => d(new Date(`${month}-15T12:00:00`), { month: 'long', year: 'numeric' }),
    kind: (kind: ActivityKind) => t(`activities.kind.${kind}`),
    /** "Morning", "14:00 → 17:00", "2 days · 6–7 Oct". */
    when: (activity: Activity) => {
      const key = durationKey(activity.duration_type)
      if (key === 'custom_time' && activity.start_at && activity.end_at) return `${time(activity.start_at)} → ${time(activity.end_at)}`
      if (['all_day', 'morning', 'afternoon'].includes(key)) return t(`activities.duration.${key}`)
      if (!activity.start_at || !activity.end_at) return t(`activities.duration.${key}`)
      return t('activities.when.range', { days: t('activities.daysCount', { count: activity.days ?? 0 }, Math.ceil(activity.days ?? 0)), from: day(activity.start_at), to: day(lastDay(activity)) })
    },
    lastDay,
  }
}
