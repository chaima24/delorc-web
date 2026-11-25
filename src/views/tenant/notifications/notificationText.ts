import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'
import type { LabNotification, NotificationCategory } from '@/api/tenant/notifications'

/** One icon per group, from the Tabler set (no colour: the line's text says the rest). */
export const CATEGORY_ICONS: Record<NotificationCategory, string> = {
  expenses: 'tabler-coin',
  visits: 'tabler-calendar',
  activities: 'tabler-run', // Studio › Types d'activité; the menu's calendar-event looks like Visites
  orders: 'tabler-file-invoice',
  coaching: 'tabler-school',
  professionals: 'tabler-stethoscope',
  events: 'tabler-presentation', // the menu's calendar-event looks like Visites
  competitive: 'tabler-binoculars', // the menu's notes looks like Commandes
  campaigns: 'tabler-speakerphone',
  complaints: 'tabler-message-report',
  surveys: 'tabler-clipboard-list',
}

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
    case 'activities':
      return { name: 'tenant-activities', query: { view: 'calendar', month: target.date.slice(0, 7) } }
    case 'order':
      return { name: 'tenant-order', params: { id: target.id } }
    case 'coaching_session':
      return { name: 'tenant-coaching-session', params: { id: target.id } }
    case 'hcp_requests':
      return { name: 'tenant-hcp-requests' }
    case 'hcp':
      return { name: 'tenant-hcp-detail', params: { id: target.id } }
    case 'my_proposals':
      return { name: 'tenant-hcp-proposals' }
    case 'event':
      return { name: 'tenant-event', params: { id: target.id } }
    case 'events':
      return { name: 'tenant-events' }
    case 'competitive':
      return { name: 'tenant-competitive-information', params: { id: target.id } }
    case 'campaign_message':
      return { name: 'tenant-campaign-message', params: { id: target.campaign_id, messageId: target.id } }
    case 'complaint':
      return { name: 'tenant-complaint', params: { id: target.id } }
    case 'my_surveys':
      return { name: 'tenant-my-surveys' }
  }
}

type RangeFormat = Intl.DateTimeFormat & { formatRange: (start: Date, end: Date) => string }
const noon = (day: string) => new Date(`${day}T12:00:00`)

/**
 * The sentence of a line, written now from the lab's texts (`notifications.event.*`) in the reader's language:
 * the API keeps only the event and its values. « Nadia Amrani a refusé votre plan (1–30 nov.) : « trop de visites » ».
 */
export function useNotificationText() {
  const { t, d, n, locale } = useI18n()

  const day = (value: unknown) => (value ? d(noon(String(value)), { day: 'numeric', month: 'short' }) : '')
  const month = (value: unknown) => (value ? d(noon(`${String(value)}-01`), { month: 'long', year: 'numeric' }) : '')
  const period = (start: unknown, end: unknown) =>
    (new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }) as RangeFormat).formatRange(noon(String(start)), noon(String(end)))

  const amount = (value: unknown) => `${n(Number(value), { maximumFractionDigits: 0 })} DA`
  /** An activity's time: « lun. 26 oct., 09:00 – 12:00 » on one day, else « 26 – 28 oct. ». */
  const span = (start: unknown, end: unknown) => {
    const from = new Date(String(start))
    const to = new Date(String(end))
    if (from.toDateString() !== to.toDateString()) {
      return (new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }) as RangeFormat).formatRange(from, to)
    }
    const hour = (at: Date) => d(at, { hour: '2-digit', minute: '2-digit' })
    return `${d(from, { weekday: 'short', day: 'numeric', month: 'short' })}, ${hour(from)} – ${hour(to)}`
  }

  const at = (value: unknown) => new Date(String(value))
  const sameDay = (start: unknown, end: unknown) => at(start).toDateString() === at(end).toDateString()
  const hour = (value: unknown) => d(at(value), { hour: '2-digit', minute: '2-digit' })
  const shortDay = (value: unknown) => d(at(value), { day: 'numeric', month: 'short' })
  /** An event's days: « 12 déc. », « 12–13 déc. ». */
  const eventDays = (start: unknown, end: unknown) => (sameDay(start, end)
    ? shortDay(start)
    : (new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }) as RangeFormat).formatRange(at(start), at(end)))
  /** With the hours, when an event moved but its days stay the same: « 2 déc. 08:30 – 18:00 ». */
  const eventHours = (start: unknown, end: unknown) =>
    `${shortDay(start)} ${hour(start)} – ${sameDay(start, end) ? '' : `${shortDay(end)} `}${hour(end)}`
  function moved(v: LabNotification['values']): { from: string; to: string } {
    const from = eventDays(v.from_start_at, v.from_end_at)
    const to = eventDays(v.start_at, v.end_at)
    return from !== to ? { from, to } : { from: eventHours(v.from_start_at, v.from_end_at), to: eventHours(v.start_at, v.end_at) }
  }
  /** « l'e-mail Newsletter Cardiozen », « le SMS » when it has no name. */
  const message = (v: LabNotification['values']) => t(`notifications.message.${v.channel}`, { subject: v.subject ?? '' }).trim()

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
      case 'activity.added':
        return t('notifications.event.activityAdded', { actor, title: v.title, when: span(v.start_at, v.end_at) })
      case 'order.transmitted':
        return t('notifications.event.orderTransmitted', { actor, number: v.number, client: v.client, total: amount(v.total_ttc) })
      case 'order.validated':
        return t('notifications.event.orderValidated', { actor, number: v.number, client: v.client })
      case 'order.cancelled':
        return t('notifications.event.orderCancelled', { actor, number: v.number, client: v.client, reason: v.reason })
      case 'order.reopened':
        return t('notifications.event.orderReopened', { actor, number: v.number, client: v.client })
      case 'coaching.planned':
        return t('notifications.event.coachingPlanned', { actor, date: day(v.date) })
      case 'coaching.moved':
        return t('notifications.event.coachingMoved', { actor, date: day(v.date), from: day(v.from) })
      case 'coaching.cancelled':
        return t('notifications.event.coachingCancelled', { actor, date: day(v.date), reason: v.reason })
      case 'coaching.validated':
        return t('notifications.event.coachingValidated', { actor, date: day(v.date) })
      case 'coaching.accepted':
        return t('notifications.event.coachingAccepted', { actor, date: day(v.date) })
      case 'coaching.refused':
        return t('notifications.event.coachingRefused', { actor, date: day(v.date), reason: v.reason })
      case 'hcp_proposal.sent':
        return t('notifications.event.proposalSent', { actor, name: v.name })
      case 'hcp_proposal.approved':
        return t('notifications.event.proposalApproved', { actor, name: v.name })
      case 'hcp_proposal.refused':
        return t('notifications.event.proposalRefused', { actor, name: v.name, reason: v.reason })
      case 'event.proposed':
        return t('notifications.event.eventProposed', { actor, name: v.name, days: eventDays(v.start_at, v.end_at) })
      case 'event.validated':
        return t('notifications.event.eventValidated', { actor, name: v.name, days: eventDays(v.start_at, v.end_at) })
      case 'event.refused':
        return t('notifications.event.eventRefused', { actor, name: v.name, days: eventDays(v.start_at, v.end_at), reason: v.reason })
      case 'event.participant_added':
        return t('notifications.event.participantAdded', { actor, name: v.name, days: eventDays(v.start_at, v.end_at) })
      case 'event.participant_removed':
        return t('notifications.event.participantRemoved', { actor, name: v.name, days: eventDays(v.start_at, v.end_at) })
      case 'event.moved':
        return t('notifications.event.eventMoved', { actor, name: v.name, ...moved(v) })
      case 'competitive.sent':
        return t('notifications.event.noteSent', { actor, number: v.number, laboratory: v.laboratory, product: v.product })
      case 'competitive.processed':
        return v.comment
          ? t('notifications.event.noteProcessedComment', { actor, number: v.number, comment: v.comment })
          : t('notifications.event.noteProcessed', { actor, number: v.number })
      case 'campaign_message.ready':
        return t('notifications.event.messageReady', { actor, message: message(v), campaign: v.campaign })
      case 'campaign_message.approved':
        return t('notifications.event.messageApproved', { actor, message: message(v), campaign: v.campaign })
      case 'campaign_message.returned':
        return t('notifications.event.messageReturned', { actor, message: message(v), campaign: v.campaign, reason: v.reason })
      case 'complaint.sent':
        return v.urgency === 'urgent'
          ? t('notifications.event.complaintSentUrgent', { actor, number: v.number, title: v.title })
          : t('notifications.event.complaintSent', { actor, number: v.number, title: v.title })
      case 'complaint.answered':
        return t('notifications.event.complaintAnswered', { actor, number: v.number, title: v.title })
      case 'complaint.resolved':
        return t('notifications.event.complaintResolved', { actor, number: v.number, title: v.title })
      case 'complaint.closed':
        return t('notifications.event.complaintClosed', { actor, number: v.number, title: v.title })
      case 'complaint.message':
        return t('notifications.event.complaintMessage', { actor, number: v.number, title: v.title })
      case 'complaint.reopened':
        return t('notifications.event.complaintReopened', { actor, number: v.number, title: v.title })
      case 'survey.added':
        return t('notifications.event.surveyAdded', { actor, name: v.name, period: period(v.start_date, v.end_date) })
      case 'survey.closed':
        return t('notifications.event.surveyClosed', { actor, name: v.name })
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
