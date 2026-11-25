import { client } from '@/api/client'

/** The bell (delorc-api docs/api/notifications.md): a person's own lines, in-app only. */

export type NotificationCategory = 'expenses' | 'visits' | 'activities' | 'orders' | 'coaching' | 'professionals' | 'events' | 'competitive' | 'campaigns' | 'complaints' | 'surveys'
export type NotificationEvent =
  | 'expense.approved' | 'expense.refused'
  | 'visit_plan.sent' | 'visit_plan.approved' | 'visit_plan.refused' | 'visit.rejected' | 'visit.planned_by_manager'
  | 'activity.added'
  | 'order.transmitted' | 'order.validated' | 'order.cancelled' | 'order.reopened'
  | 'coaching.planned' | 'coaching.moved' | 'coaching.cancelled' | 'coaching.validated' | 'coaching.accepted' | 'coaching.refused'
  | 'hcp_proposal.sent' | 'hcp_proposal.approved' | 'hcp_proposal.refused'
  | 'event.proposed' | 'event.validated' | 'event.refused' | 'event.participant_added' | 'event.participant_removed' | 'event.moved'
  | 'competitive.sent' | 'competitive.processed'
  | 'campaign_message.ready' | 'campaign_message.approved' | 'campaign_message.returned'
  | 'complaint.sent' | 'complaint.answered' | 'complaint.resolved' | 'complaint.closed' | 'complaint.message' | 'complaint.reopened'
  | 'survey.added' | 'survey.closed'

/** The groups in Studio's order (the page's group filter shows them too). */
export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'expenses', 'visits', 'activities', 'orders', 'coaching', 'professionals', 'events', 'competitive', 'campaigns',
  'complaints', 'surveys',
]

/** What a click opens. */
export type NotificationTarget =
  | { kind: 'expense'; id: number }
  | { kind: 'expense_month'; user_id: number; month: string }
  | { kind: 'visit_plan'; cycle_id: number; user_id: number }
  | { kind: 'visit_calendar'; cycle_id: number; from: string }
  | { kind: 'visit'; id: number }
  | { kind: 'activities'; date: string }
  | { kind: 'order'; id: number }
  | { kind: 'coaching_session'; id: number }
  | { kind: 'hcp_requests' }
  | { kind: 'hcp'; id: number }
  | { kind: 'my_proposals' }
  | { kind: 'event'; id: number }
  | { kind: 'events' }
  | { kind: 'competitive'; id: number }
  | { kind: 'campaign_message'; id: number; campaign_id: number }
  | { kind: 'complaint'; id: number }
  | { kind: 'my_surveys' }

export interface LabNotification {
  id: string
  event: NotificationEvent
  category: NotificationCategory
  actor: { id: number; name: string }
  /** What the sentence shows: a date, a reason, a name… (see the contract, per event). */
  values: Record<string, string | number | null>
  target: NotificationTarget
  read_at: string | null
  created_at: string
}

export interface NotificationCounts { all: number; unread: number; read: number }

export interface NotificationFilters {
  read?: '0' | '1'
  category?: NotificationCategory
  from?: string
  to?: string
}

export interface NotificationSetting { key: NotificationEvent; category: NotificationCategory; enabled: boolean }

const one = <T>(request: Promise<{ data: { data: T } }>) => request.then(response => response.data.data)
const URL = '/notifications'

export const fetchNotifications = (filters: NotificationFilters = {}, page = 1, perPage = 20) =>
  client.get<{ data: LabNotification[]; meta: { counts: NotificationCounts; last_page: number } }>(URL, {
    params: { page, per_page: perPage, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value).map(([key, value]) => [`filter[${key}]`, value])) },
  }).then(response => ({ items: response.data.data, counts: response.data.meta.counts, lastPage: response.data.meta.last_page }))
export const fetchUnreadCount = () => one<{ count: number }>(client.get(`${URL}/unread-count`)).then(data => data.count)
export const markNotificationRead = (id: string) => one<LabNotification>(client.post(`${URL}/${id}/read`))
export const markNotificationUnread = (id: string) => one<LabNotification>(client.post(`${URL}/${id}/unread`))
export const markAllNotificationsRead = () => one<{ updated: number }>(client.post(`${URL}/read-all`))

// Studio › Notifications
export const fetchNotificationSettings = () => one<{ events: NotificationSetting[] }>(client.get('/notification-settings')).then(data => data.events)
export const saveNotificationSettings = (events: { key: NotificationEvent; enabled: boolean }[]) =>
  one<{ events: NotificationSetting[] }>(client.put('/notification-settings', { events })).then(data => data.events)
