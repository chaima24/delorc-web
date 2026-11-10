import { client } from '@/api/client'
import type { ListParams, Page } from '@/api/tenant/geography'
import type { PlanningRule, ValidationRule } from '@/api/tenant/rules'
import type { Team } from '@/api/tenant/teams'

/** active · invited (link sent, no password yet) · not_invited · inactive (docs/api/users.md). */
export type UserAccountStatus = 'active' | 'invited' | 'not_invited' | 'inactive'

/** A file of the lab (the attachments table): the photo has `type = avatar`. */
export interface Attachment {
  id: number
  url: string | null
  type?: string | null
  mime?: string | null
  size?: number | null
}

/** A person of the lab. The page fields (`address` and after) come with `GET users/{id}`. */
export interface TenantUser {
  id: number
  first_name: string
  last_name: string
  full_name: string
  initials: string
  email: string
  phone: string | null
  avatar?: Attachment | null
  role: string | null
  is_active: boolean
  account_status: UserAccountStatus
  /** When the waiting access link stops working. */
  access_link_expires_at: string | null
  last_login_at: string | null
  created_at: string | null
  address?: string | null
  language_id?: number | null
  language?: { id: number; code: string; name: string } | null
  commune?: { id: number; name: string; wilaya: { id: number; name: string } } | null
  two_factor_method?: 'none' | 'app' | 'email' | 'sms'
  created_by?: { id: number; full_name: string } | null
  /** List: current teams, main first. Page: every stint, open ones first, newest first. */
  teams?: Team[]
  /** List: current manager links. Page: every link, open ones first, newest first (docs/api/hierarchy.md). */
  managers?: UserManager[]
  /** Page: the rules the person follows (docs/api/rules.md). */
  planning_rule_id?: number | null
  validation_rule_id?: number | null
  planning_rule?: PlanningRule | null
  validation_rule?: ValidationRule | null
}

/** A manager on a person, with the link's dates. */
export interface UserManager {
  id: number
  full_name: string
  role: string | null
  is_active: boolean
  pivot: { id: number; start_date: string | null; end_date: string | null }
}

export interface UserProfileInput {
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string | null
  commune_id: number | null
  language_id: number | null
}

/** POST users: the person under `user`, as the previous API (multipart, for the photo). */
export interface CreateUserPayload {
  user: UserProfileInput & { avatar?: File | null }
  role: string
  /** At least one; with several, the flagged one (else the first) is the main team. */
  teams: { id: number; start_date: string; is_primary?: boolean }[]
  /** Email the person a link to choose their password (default on). */
  send_access: boolean
  planning_rule_id?: number | null
  validation_rule_id?: number | null
  /** Who the person reports to, from a date (optional). */
  managers?: { id: number; start_date: string }[]
}

/** PUT users/{id}: any field. `role` also needs `users.change-role`. */
export type UpdateUserPayload = Partial<UserProfileInput> & {
  role?: string
  is_active?: boolean
  avatar?: File | null
  avatar_remove?: boolean
}

/** A form with files: `{ user: { first_name } }` → `user[first_name]`. Empty values are left out, `false` is sent as 0. */
function asForm(body: Record<string, unknown>, form = new FormData(), prefix = ''): FormData {
  for (const [field, value] of Object.entries(body)) {
    const name = prefix ? `${prefix}[${field}]` : field
    if (value === null || value === undefined) continue
    if (value instanceof File) form.append(name, value)
    else if (typeof value === 'boolean') form.append(name, value ? '1' : '0')
    else if (typeof value === 'object') asForm(value as Record<string, unknown>, form, name)
    else form.append(name, String(value))
  }

  return form
}

const one = (request: Promise<{ data: { data: TenantUser } }>) => request.then((response) => response.data.data)
const hasFile = (body: { avatar?: File | null }) => body.avatar instanceof File

export const fetchUsers = (params?: ListParams) =>
  client.get<{ data: TenantUser[]; meta: { total: number } }>('/users', { params })
    .then((response): Page<TenantUser> => ({ items: response.data.data, total: response.data.meta.total }))
export const fetchUser = (id: number | string) => one(client.get(`/users/${id}`))
export const createUser = (body: CreateUserPayload) => one(client.post('/users', asForm(body as unknown as Record<string, unknown>)))
/** With a photo the update goes as a form: `POST` + `_method=PUT`, because PHP reads files only on POST. */
export const updateUser = (id: number, body: UpdateUserPayload) => hasFile(body)
  ? one(client.post(`/users/${id}`, asForm({ ...body, _method: 'PUT' })))
  : one(client.put(`/users/${id}`, body))
/** As the previous API: end or re-flag current stints, open new ones. */
export interface SyncUserTeamsPayload {
  existing_teams?: { id: number; end_date?: string | null; is_primary?: boolean }[]
  new_teams?: { id: number; start_date: string; end_date?: string | null; is_primary?: boolean }[]
}
export const syncUserTeams = (id: number, body: SyncUserTeamsPayload) => one(client.put(`/users/${id}/teams`, body))
/** As the previous API: end open manager links, open new ones (docs/api/hierarchy.md). */
export interface SyncUserManagersPayload {
  existing_managers?: { id: number; end_date: string }[]
  new_managers?: { id: number; start_date: string; end_date?: string | null }[]
}
export const syncUserManagers = (id: number, body: SyncUserManagersPayload) => one(client.put(`/users/${id}/managers`, body))
export const sendUserAccessLink = (id: number) => client.post(`/users/${id}/access-link`)
export const resetUserSecondFactor = (id: number) => one(client.post(`/users/${id}/second-factor/reset`))

/** The person's rule: an existing one by id (the old API also took a new rule by `name`). */
export const updateUserPlanningRule = (id: number, planningRuleId: number) => one(client.put(`/users/${id}/planning-rule`, { planning_rule_id: planningRuleId }))
export const updateUserValidationRule = (id: number, validationRuleId: number) => one(client.put(`/users/${id}/validation-rule`, { validation_rule_id: validationRuleId }))

/** GET users/suggestions: the rules most colleagues (same role and team) have. */
export interface UserSuggestions {
  /** `role_team`, `role` (no colleague on that team yet) or null (nobody to compare with). */
  scope: 'role_team' | 'role' | null
  peers: number
  planning_rule: { id: number; name: string; count: number } | null
  validation_rule: { id: number; name: string; count: number } | null
  /** The person most colleagues report to today (docs/api/hierarchy.md). */
  manager: { id: number; full_name: string; role: string | null; count: number } | null
}
export const fetchUserSuggestions = (params: { role?: string; team_id?: number }) =>
  client.get<{ data: UserSuggestions }>('/users/suggestions', { params }).then((response) => response.data.data)
