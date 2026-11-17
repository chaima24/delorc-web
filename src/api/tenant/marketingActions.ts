import { client } from '@/api/client'
import type { ListParams } from '@/api/tenant/geography'
import type { Person } from '@/api/tenant/campaigns'

/**
 * Module 15 (docs/api/marketing-actions.md): an activity type to do N times each during a campaign. Planned =
 * objective × people; done is counted from the activities (Planifier › Activités), never typed.
 */

export interface Ref { id: number; name: string }
export interface Progress { planned: number; done: number; rate: number }

export interface MarketingAction {
  id: number
  campaign?: { id: number; code: string; name: string; start_date: string; end_date: string }
  activity_type: Ref
  wilaya: Ref | null
  address: string | null
  specialities: Ref[]
  start_date: string
  end_date: string
  objective: number
  budget: number
  user_ids?: number[]
  people_count?: number
  planned?: number
  done?: number
  figures?: Progress & { people: number; budget: number; per_done: number | null }
  people?: { user: Person; team: string | null; objective: number; done: number; last_at: string | null }[]
  created_by?: Person | null
  created_at: string | null
}

export interface ActionPayload {
  campaign_id?: number
  activity_type_id: number | null
  start_date: string
  end_date: string
  objective: number | null
  user_ids: number[]
  budget: number | null
  wilaya_id: number | null
  address: string | null
  speciality_ids: number[]
}

export interface ActionPerson { user_id: number; name: string; team: string | null; role: string | null; can: boolean }
export interface CountedActivity { id: number; title: string; start_at: string; end_at: string; duration_type: number }
export type ProgressRow =
  | ({ user: Person; team: string | null; actions: number } & Progress)
  | ({ activity_type: Ref; actions: number } & Progress)
export interface OwnAction { id: number; activity_type: string; campaign: { id: number; code: string; name: string }; wilaya: string | null; start_date: string; end_date: string; planned: number; done: number }

const one = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

export const fetchCampaignActions = (campaignId: number, params?: ListParams) =>
  client.get<{ data: MarketingAction[]; meta: { figures: Progress & { actions: number; budget: number } } }>(`/campaigns/${campaignId}/marketing-actions`, { params })
    .then((response) => ({ items: response.data.data, figures: response.data.meta.figures }))
export const fetchActionPeople = (campaignId: number, activityTypeId: number) =>
  one<ActionPerson[]>(client.get(`/campaigns/${campaignId}/marketing-action-people`, { params: { activity_type_id: activityTypeId } }))
export const fetchAction = (id: number) => one<MarketingAction>(client.get(`/marketing-actions/${id}`))
export const createAction = (payload: ActionPayload) => one<MarketingAction>(client.post('/marketing-actions', payload))
export const updateAction = (id: number, payload: ActionPayload) => one<MarketingAction>(client.put(`/marketing-actions/${id}`, payload))
export const deleteAction = (id: number) => client.delete(`/marketing-actions/${id}`)
export const fetchCountedActivities = (id: number, userId: number) => one<CountedActivity[]>(client.get(`/marketing-actions/${id}/people/${userId}/activities`))
export const fetchActionProgress = <T = ProgressRow>(params: ListParams & { group: 'person' | 'type' | 'action' }) =>
  client.get<{ data: T[]; meta: { total: number } }>('/marketing-actions/progress', { params }).then((response) => ({ items: response.data.data, total: response.data.meta.total }))
