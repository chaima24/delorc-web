import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import type { LabNotification, NotificationCategory } from '@/api/tenant/notifications'

/** One icon per group, from the Tabler set (no colour: the line's text says the rest). */
export const CATEGORY_ICONS: Record<NotificationCategory, string> = { expenses: 'tabler-coin', visits: 'tabler-calendar' }

/** What a click opens, from the line's `target`: like a routing table, one entry per kind. */
export function notificationLink(line: LabNotification): RouteLocationRaw {
  const target = line.target
  switch (target.kind) {
    case 'expense':
      return { name: 'tenant-expense-mine', query: { month: String(line.values.date ?? '').slice(0, 7), day: String(target.id) } }
    case 'expense_month':
      return { name: 'tenant-expense-mine', query: { month: target.month } }
    case 'visit_plan':
      return { name: 'tenant-visit-plans' }
    case 'visit_calendar':
      return { name: 'tenant-visit-planning', query: { date: target.from } }
    case 'visit':
      return { name: 'tenant-visit-detail', params: { id: target.id } }
  }
}

type RangeFormat = Intl.DateTimeFormat & { formatRange: (start: Date, end: Date) => string }
const noon = (day: string) => new Date(`${day}T12:00:00`)

/**
 * The sentence of a line, written now from the lab's texts (`notifications.event.*`) in the reader's language:
 * the API keeps only the event and its values. « Nadia Amrani a refusé votre plan (1–30 nov.) : « trop de visites » ».
 */
export function useNotificationText() {
  const { t, d, locale } = useI18n()

  const day = (value: unknown) => (value ? d(noon(String(value)), { day: 'numeric', month: 'short' }) : '')
  const month = (value: unknown) => (value ? d(noon(`${String(value)}-01`), { month: 'long', year: 'numeric' }) : '')
  const period = (start: unknown, end: unknown) =>
    (new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }) as RangeFormat).formatRange(noon(String(start)), noon(String(end)))

  function sentence(line: LabNotification): string {
    const v = line.values
    const actor = line.actor.name
    switch (line.event) {
      case 'expense.approved':
        return v.month
          ? t('notifications.event.expenseApprovedMonth', { actor, month: month(v.month), days: t('notifications.days', { count: v.days }, Number(v.days)) })
          : t('notifications.event.expenseApproved', { actor, date: day(v.date) })
      case 'expense.refused':
        return t('notifications.event.expenseRefused', { actor, date: day(v.date), reason: v.reason })
      case 'visit_plan.sent':
        return t('notifications.event.planSent', { actor, period: period(v.cycle_start, v.cycle_end), visits: t('notifications.visits', { count: v.visits }, Number(v.visits)) })
      case 'visit_plan.approved':
        return t('notifications.event.planApproved', { actor, period: period(v.cycle_start, v.cycle_end) })
      case 'visit_plan.refused':
        return t('notifications.event.planRefused', { actor, period: period(v.cycle_start, v.cycle_end), reason: v.reason })
      case 'visit.rejected':
        return t('notifications.event.visitRejected', { actor, professional: v.professional, date: day(v.date), note: v.note })
      case 'visit.planned_by_manager':
        return v.time
          ? t('notifications.event.visitPlannedAt', { actor, professional: v.professional, date: day(v.date), time: String(v.time).slice(0, 5) })
          : t('notifications.event.visitPlanned', { actor, professional: v.professional, date: day(v.date) })
    }
  }

  /** « il y a 12 minutes », « il y a 3 heures », then the day: « 3 nov. ». */
  function when(line: LabNotification): string {
    const at = new Date(line.created_at)
    const minutes = Math.round((Date.now() - at.getTime()) / 60000)
    const relative = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
    if (minutes < 60) return relative.format(-Math.max(minutes, 0), 'minute')
    if (minutes < 24 * 60) return relative.format(-Math.round(minutes / 60), 'hour')
    return d(at, { day: 'numeric', month: 'short' })
  }

  const category = (key: NotificationCategory) => t(`notifications.category.${key}`)

  return { sentence, when, category }
}
