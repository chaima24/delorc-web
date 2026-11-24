import { client } from '@/api/client'

/** The bell (delorc-api docs/api/notifications.md): a person's own lines, in-app only. */

export type NotificationCategory = 'expenses' | 'visits'
export type NotificationEvent =
  | 'expense.approved' | 'expense.refused'
  | 'visit_plan.sent' | 'visit_plan.approved' | 'visit_plan.refused' | 'visit.rejected' | 'visit.planned_by_manager'

/** What a click opens. */
export type NotificationTarget =
  | { kind: 'expense'; id: number }
  | { kind: 'expense_month'; user_id: number; month: string }
  | { kind: 'visit_plan'; cycle_id: number; user_id: number }
  | { kind: 'visit_calendar'; cycle_id: number; from: string }
  | { kind: 'visit'; id: number }

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
