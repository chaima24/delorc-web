import type { EventPayload, EventTarget, LabEvent } from '@/api/tenant/events'

/** What the form holds: the dates and the hours apart (a range picker + two hour fields). */
export interface EventForm {
  name: string
  event_type_id: number | null
  campaign_id: number | null
  object: string
  start_date: string
  start_time: string
  end_date: string
  end_time: string
  wilaya_id: number | null
  place: string
  online_url: string
  type: EventTarget
  speciality_ids: number[]
  costs: string
  user_ids: number[]
}

export const emptyEventForm = (userIds: number[] = [], campaignId: number | null = null): EventForm => ({
  name: '', event_type_id: null, campaign_id: campaignId, object: '', start_date: '', start_time: '09:00', end_date: '', end_time: '17:00',
  wilaya_id: null, place: '', online_url: '', type: 'doctor', speciality_ids: [], costs: '', user_ids: userIds,
})

export const eventToForm = (row: LabEvent): EventForm => ({
  name: row.name, event_type_id: row.event_type.id, campaign_id: row.campaign?.id ?? null, object: row.object ?? '',
  start_date: row.start_at.slice(0, 10), start_time: row.start_at.slice(11, 16), end_date: row.end_at.slice(0, 10), end_time: row.end_at.slice(11, 16),
  wilaya_id: row.wilaya.id, place: row.place ?? '', online_url: row.online_url ?? '', type: row.type,
  speciality_ids: (row.specialities ?? []).map(s => s.id), costs: String(row.costs), user_ids: (row.participants ?? []).map(p => p.user.id),
})

export const formToPayload = (form: EventForm): EventPayload => ({
  name: form.name, event_type_id: form.event_type_id, campaign_id: form.campaign_id, object: form.object.trim() || null,
  start_at: form.start_date ? `${form.start_date} ${form.start_time || '00:00'}` : '',
  end_at: form.end_date ? `${form.end_date} ${form.end_time || '23:59'}` : '',
  wilaya_id: form.wilaya_id, place: form.place.trim() || null, online_url: form.online_url.trim() || null, type: form.type,
  speciality_ids: form.type === 'pharmacy' ? [] : form.speciality_ids, costs: form.costs === '' ? null : Number(form.costs.replace(/\s/g, '').replace(',', '.')), user_ids: form.user_ids,
})
