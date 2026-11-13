import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'

/** The lab's activity log (Studio › Accès › Journal), read only. */
export interface ActivityLogMorphEntity {
  id: number | string
  type?: string
  /** The record's or the person's name; a deleted record keeps the name saved on the line. */
  label?: string | null
  name?: string
  first_name?: string
  last_name?: string
}

export interface ActivityLog {
  id: number
  log_name?: string | null
  description?: string
  /** created, updated, deleted, access (rights), failed (sign-in)… */
  event?: string | null
  subject_type?: string | null
  subject_id?: number | string | null
  causer_type?: string | null
  causer_id?: number | string | null
  /** record_name, author_role; added / removed for rights; attempt for a failed sign-in. */
  properties?: Record<string, unknown> | null
  attributes?: Record<string, unknown> | null
  old?: Record<string, unknown> | null
  subject?: ActivityLogMorphEntity | null
  causer?: ActivityLogMorphEntity | null
  created_at?: string
}

const page = <T>(path: string, params?: ListParams) =>
  client.get<{ data: T[]; meta: { total: number } }>(path, { params }).then((response): Page<T> => ({ items: response.data.data, total: response.data.meta.total }))

export const fetchActivityLogs = (params?: ListParams) => page<ActivityLog>('/activity-log', params)
export const fetchActivityLog = (id: number | string) => client.get<{ data: ActivityLog }>(`/activity-log/${id}`).then((response) => response.data.data)
/** The kinds of records found in the log, most logged first. */
export const fetchActivityLogSubjects = () => client.get<{ data: { type: string; count: number }[] }>('/activity-log/subjects').then((response) => response.data.data)
/** Everyone who has a line as author: the person filter. */
export const fetchActivityLogPeople = () => client.get<{ data: { id: number; name: string }[] }>('/activity-log/people').then((response) => response.data.data)
