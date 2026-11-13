import { client } from '@/api/client'
import type { Attachment } from '@/api/tenant/users'
import type { ListParams, Page } from '@/api/tenant/geography'

/** A team of the lab (docs/api/teams-brands.md). On a person, `pivot` is that person's stint. */
export interface Team {
  id: number
  name: string
  description: string | null
  status: boolean
  specialities?: { id: number; name: string }[]
  brands?: { id: number; name: string }[]
  /** In the team today (or from a later date). */
  members_count?: number
  past_members_count?: number
  /** The first faces next to the count (list). */
  members?: { id: number; full_name: string; avatar: Attachment | null }[]
  created_by?: { id: number; full_name: string } | null
  /** What points to the team, by kind: `{ objectives: 2 }`. Empty until those modules. */
  uses?: Record<string, number>
  pivot?: { id: number; start_date: string | null; end_date: string | null; is_primary: boolean }
  created_at: string | null
}

/** One stint of a team's member list. */
export interface TeamMember {
  id: number
  start_date: string
  end_date: string | null
  is_primary: boolean
  user: { id: number; full_name: string; is_active: boolean; role: string | null; avatar: Attachment | null }
}

export interface TeamPayload {
  name?: string
  description?: string | null
  status?: boolean
  specialities?: number[]
  brands?: number[]
  /** Create only: people added from `start_date`. */
  users?: number[]
  start_date?: string
}

const one = (request: Promise<{ data: { data: Team } }>) => request.then((response) => response.data.data)

export const fetchTeams = (params?: ListParams) =>
  client.get<{ data: Team[]; meta: { total: number } }>('/teams', { params })
    .then((response): Page<Team> => ({ items: response.data.data, total: response.data.meta.total }))
export const fetchTeam = (id: number) => one(client.get(`/teams/${id}`))
export const createTeam = (body: TeamPayload) => one(client.post('/teams', body))
export const updateTeam = (id: number, body: TeamPayload) => one(client.put(`/teams/${id}`, body))
export const deleteTeam = (id: number) => client.delete(`/teams/${id}`)
export const fetchTeamMembers = (id: number, state: 'now' | 'past' = 'now') =>
  client.get<{ data: TeamMember[] }>(`/teams/${id}/members`, { params: { state } }).then((response) => response.data.data)
export const addTeamMembers = (id: number, body: { users: number[]; start_date: string }) => one(client.post(`/teams/${id}/members`, body))
export const endTeamMember = (id: number, stint: number, endDate: string) => one(client.put(`/teams/${id}/members/${stint}/end`, { end_date: endDate }))

/** Every team at once, for selects and filters (a lab has a few dozen). */
export async function fetchAllTeams(): Promise<Team[]> {
  return (await fetchTeams({ per_page: 100, sort: 'name' })).items
}
