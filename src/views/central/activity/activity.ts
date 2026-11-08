import type { ActivityLine } from '@/api/central/activityLog'

/** The actions of the Action filter, in the order they are shown. */
export const ACTIONS = [
  'created',
  'updated',
  'deactivated',
  'reactivated',
  'role_changed',
  'access_changed',
  'values_changed',
  'access_link_sent',
  'logo_changed',
  'suspended',
  'resumed',
  'period_added',
  'period_updated',
  'period_cut',
  'period_removed',
  'settings_changed',
  'feature_change_added',
  'feature_change_updated',
  'feature_change_removed',
  'feature_change_ended',
  'second_factor_reset',
  'deleted',
  'failed',
  'imported',
]

/** A date as `YYYY-MM-DD`, in the viewer's time. */
export const dayOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** First day of "the last N days", today included: `YYYY-MM-DD`, as the API expects. */
export function periodStart(days: number, now = new Date()): string {
  return dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1))
}

export interface ActivityDay {
  day: string
  lines: ActivityLine[]
}

/** The list arrives newest first, so lines of the same day are next to each other. */
export function groupByDay(lines: ActivityLine[]): ActivityDay[] {
  return lines.reduce<ActivityDay[]>((days, line) => {
    const day = dayOf(new Date(line.created_at))
    const last = days[days.length - 1]
    if (last?.day === day) last.lines.push(line)
    else days.push({ day, lines: [line] })

    return days
  }, [])
}

/** `today`, `yesterday`, or null for an older day. */
export function recentDay(day: string, now = new Date()): 'today' | 'yesterday' | null {
  if (day === periodStart(1, now)) return 'today'

  return day === periodStart(2, now) ? 'yesterday' : null
}
