import { client } from '@/api/client'

export type RecordType = 'person' | 'role' | 'sign_in' | 'language' | 'translations' | 'country' | 'region' | 'wilaya' | 'commune' | 'plan'

export interface ActivityChange {
  field: string
  before: unknown
  after: unknown
}

export interface ActivityLine {
  id: number
  record_type: RecordType
  action: string
  /** Null for a failed sign-in. */
  record: { id: string; name: string | null; exists: boolean } | null
  author: {
    type: 'person' | 'system' | 'none'
    id: number | null
    name: string | null
    initials: string | null
    /** The role the person had when the line was written. */
    role: string | null
  }
  changes: ActivityChange[]
  attempt: { email: string; step: string; reason: string; ip: string | null } | null
  /** The counts of a file import. */
  import: Record<string, number | string | boolean> | null
  created_at: string
}

export interface ActivityFilters {
  search?: string
  person?: number
  record?: RecordType
  action?: string
  from?: string
  hideAutomatic?: boolean
  /** `-id` newest first, `id` oldest first. */
  sort?: string
}

export interface ActivityPerson {
  id: number
  name: string
}

export const activityLogApi = {
  list: (filters: ActivityFilters, page: number, perPage: number) => {
    const params: Record<string, string | number> = { page, per_page: perPage }
    if (filters.search) params['filter[search]'] = filters.search
    if (filters.person) params['filter[person]'] = filters.person
    if (filters.record) params['filter[record]'] = filters.record
    if (filters.action) params['filter[action]'] = filters.action
    if (filters.from) params['filter[from]'] = filters.from
    if (filters.hideAutomatic) params['filter[automatic]'] = 'false'
    if (filters.sort) params.sort = filters.sort

    return client.get<{ data: ActivityLine[]; meta: { total: number } }>('/activity-log', { params }).then((response) => response.data)
  },
  people: () => client.get<{ data: ActivityPerson[] }>('/activity-log/people').then((response) => response.data.data),
}
