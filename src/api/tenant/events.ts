import { client } from '@/api/client'
import type { ListParams } from '@/api/tenant/geography'
import type { Person } from '@/api/tenant/campaigns'
import type { MaterialStock } from '@/api/tenant/materials'

/**
 * Module 14 (docs/api/events.md): marketing creates validated events, the field proposes theirs to someone above;
 * each participant fills their part (attended, times, rating, cost, the professionals they invited, their materials).
 */

export type EventStatus = 'proposed' | 'validated' | 'refused' | 'closed'
export type EventTarget = 'doctor' | 'pharmacy' | 'both'
export interface Ref { id: number; name: string }

export interface EventCan { update: boolean; validate: boolean; close: boolean; reopen: boolean; delete: boolean; fill: boolean }
export interface EventFigures { participants: number; attended: number; invited: number; present: number; costs: number; real: number; sponsored: number; gap: number; per_present: number | null }

export interface EventParticipant {
  id: number
  user: Person & { role: string | null }
  attended: boolean | null
  start_at: string
  end_at: string
  rating: number | null
  comments: string | null
  cost: number | null
  invited?: number
  present?: number
  materials_count?: number
  /** Only on the part's own read. */
  invites?: EventInvite[]
  materials?: { material_stock_id: number; materiel: Ref; campaign: { id: number; code: string; name: string }; quantity: number; left: number }[]
}

export interface EventInvite {
  hcp: { id: number; name: string; type: string; speciality: string | null; commune: string | null }
  present: boolean
  /** `click` = ticked by the online link, `hand` = changed by the participant (docs/api/event-online-link.md). */
  present_source?: 'click' | 'hand' | null
  link_sent_at?: string | null
  clicked_at?: string | null
  /** Only when the lab has `events.sponsoring`. */
  sponsored?: boolean
  sponsored_amount?: number | null
}

export interface LabEvent {
  id: number
  name: string
  object: string | null
  event_type: Ref
  campaign: { id: number; code: string; name: string } | null
  wilaya: Ref
  place: string | null
  online_url: string | null
  type: EventTarget
  start_at: string
  end_at: string
  costs: number
  status: EventStatus
  refusal_reason: string | null
  organiser: Person
  decided_by?: Person | null
  decided_at: string | null
  closed_by?: Person | null
  closed_at: string | null
  created_at: string
  specialities?: Ref[]
  counts?: { participants: number; invited: number; present: number }
  real_cost?: number | null
  figures?: EventFigures
  can?: EventCan
  history?: { event: string; by: string | null; at: string; reason: string | null; count?: number | null }[]
  participants?: EventParticipant[]
}

export interface EventPayload {
  name: string
  event_type_id: number | null
  campaign_id: number | null
  object: string | null
  start_at: string
  end_at: string
  wilaya_id: number | null
  place: string | null
  online_url: string | null
  type: EventTarget
  speciality_ids: number[]
  costs: number | null
  user_ids: number[]
}

export interface PartPayload {
  attended?: boolean | null
  start_at?: string | null
  end_at?: string | null
  rating?: number | null
  comments?: string | null
  cost?: number | null
  hcps?: { hcp_id: number; present: boolean; sponsored?: boolean; sponsored_amount?: number | null }[]
  materials?: { material_stock_id: number; quantity: number }[]
}

export interface EventPerson { id: number; full_name: string; role: string | null; teams: Ref[] }
export interface Invitable { id: number; name: string; type: string; speciality: string | null; commune: string | null; invited_by: string | null }
export interface HcpEventRow {
  event: { id: number; name: string; start_at: string; status: EventStatus; campaign: { id: number; code: string; name: string } | null }
  invited_by: Person
  present: boolean
  sponsored?: boolean
  sponsored_amount?: number | null
}
export interface CampaignEventFigures { events: number; closed: number; invited: number; present: number; costs: number; real: number }

const one = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

export const fetchEvents = (params?: ListParams) =>
  client.get<{ data: LabEvent[]; meta: { total: number; to_validate: number; figures?: CampaignEventFigures } }>('/events', { params })
    .then((response) => ({ items: response.data.data, total: response.data.meta.total, toValidate: response.data.meta.to_validate, figures: response.data.meta.figures }))
export const fetchEvent = (id: number) => one<LabEvent>(client.get(`/events/${id}`))
export const createEvent = (payload: EventPayload) => one<LabEvent>(client.post('/events', payload))
export const updateEvent = (id: number, payload: EventPayload) => one<LabEvent>(client.put(`/events/${id}`, payload))
export const deleteEvent = (id: number) => client.delete(`/events/${id}`)
export const validateEvent = (id: number) => one<LabEvent>(client.post(`/events/${id}/validate`))
export const refuseEvent = (id: number, reason: string) => one<LabEvent>(client.post(`/events/${id}/refuse`, { reason }))
export const closeEvent = (id: number) => one<LabEvent>(client.post(`/events/${id}/close`))
export const reopenEvent = (id: number) => one<LabEvent>(client.post(`/events/${id}/reopen`))
export const fetchEventPeople = () => one<EventPerson[]>(client.get('/events/people'))

export const fetchParticipant = (eventId: number, userId: number) => one<EventParticipant>(client.get(`/events/${eventId}/participants/${userId}`))
export const saveParticipant = (eventId: number, userId: number, payload: PartPayload) => one<EventParticipant>(client.put(`/events/${eventId}/participants/${userId}`, payload))
export const fetchInvitable = (eventId: number, search: string) =>
  client.get<{ data: Invitable[] }>(`/events/${eventId}/invitable`, { params: { search: search || undefined, per_page: 20 } }).then((response) => response.data.data)
export const fetchEventMaterials = (eventId: number) => one<MaterialStock[]>(client.get(`/events/${eventId}/materials`))
export const fetchHcpEvents = (hcpId: number) => one<HcpEventRow[]>(client.get(`/hcps/${hcpId}/events`))

/** Module 14b (docs/api/event-online-link.md): each invited's own link by email, the click ticks « présent ». */
export type LinkState = 'sent' | 'not_sent' | 'failed' | 'cannot'
export type LinkWhy = 'no_consent' | 'no_email' | 'opted_out'
export interface OnlineLinkRow {
  hcp_id: number
  name: string
  speciality: string | null
  commune: string | null
  invited_by: Person
  email: string | null
  state: LinkState
  why: LinkWhy | null
  link_sent_at: string | null
  link_error: string | null
  reminded_at: string | null
  clicked_at: string | null
  present: boolean
  present_source: 'click' | 'hand' | null
}
export interface OnlineLink {
  can_send: boolean
  window: { opens_at: string; closes_at: string }
  reminder_at: string | null
  last_sent: { at: string; by: string | null; count: number | null } | null
  counts: { invited: number; sent: number; not_sent: number; cannot: number; clicked: number; reminded: number; quota_left: number | null }
  rows: OnlineLinkRow[]
}
export interface JoinView {
  lab: string
  name: string
  event: { name: string; start_at: string; end_at: string }
  state: 'open' | 'early' | 'ended'
  opens_at: string
  url: string | null
}

export const fetchOnlineLink = (eventId: number) => one<OnlineLink>(client.get(`/events/${eventId}/online-link`))
export const sendOnlineLink = (eventId: number, hcpIds?: number[]) =>
  one<{ queued: number }>(client.post(`/events/${eventId}/online-link`, hcpIds ? { hcp_ids: hcpIds } : {}))
export const joinEvent = (token: string) => one<JoinView>(client.post(`/join/${token}`))
