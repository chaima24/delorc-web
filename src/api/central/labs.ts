import { client } from '@/api/client'

/** Worked out by the API from the periods: trial or paid (current period), grace, ended, or none yet. */
export type PeriodStatus = 'trial' | 'paid' | 'grace' | 'ended' | null

/** A row of the lab list. */
export interface LabRow {
  id: string
  name: string
  logo_url: string | null
  country: { id: number; name: string } | null
  plan: { id: number; name: string } | null
  period_status: PeriodStatus
  /** `YYYY-MM-DD`: end of the current period, or of the last one. */
  period_ends_on: string | null
  status: 'active' | 'suspended'
  created_at: string
}

export interface Subscription {
  id: number
  plan: { id: number; name: string }
  kind: 'trial' | 'paid'
  starts_on: string
  ends_on: string
  /** A string, so no decimals are lost: "20000.00". */
  monthly_price: string
  currency: string
  note: string | null
  is_current: boolean
  can_remove: boolean
  created_by: { id: number; name: string } | null
  created_at: string
}

/** The lab page. */
export interface Lab extends LabRow {
  website: string | null
  address: string | null
  latitude: string | null
  longitude: string | null
  email: string | null
  phone: string | null
  contact_email: string | null
  notes: string | null
  language: { id: number; code: string; name: string } | null
  /** What was copied into the lab at creation. `languages` holds language ids. */
  copied: { regions: number; wilayas: number; communes: number; languages: number[] } | null
  copied_languages: { id: number; code: string; native_name: string }[]
  first_admin: { name: string; email: string; last_login_at: string | null } | null
  /** Null while active. `by` is null for an automatic suspension. */
  suspension: { at: string | null; by: { id: number; name: string } | null; reason: string | null } | null
  grace_ends_on: string | null
  subscriptions: Subscription[]
}

export interface NewLab {
  id: string
  name: string
  country_id: number | null
  plan_id: number | null
  language_id: number | null
  email: string
  phone: string
  contact_email: string
  admin_name: string
  admin_email: string
  admin_phone: string
  website: string
  address: string
  latitude: string
  longitude: string
  notes: string
  logo: File | null
}

export type LabChanges = Partial<Pick<Lab, 'name' | 'website' | 'address' | 'latitude' | 'longitude' | 'email' | 'phone' | 'contact_email' | 'notes'>
  & { language_id: number }>

export interface NewPeriod {
  plan_id: number
  kind: 'trial' | 'paid'
  starts_on: string
  ends_on: string
  monthly_price: number
  currency: string
  note: string | null
}

const one = (response: { data: { data: Lab } }) => response.data.data

/** The new lab form is sent as a form (it may hold a logo). Empty optional fields are left out. */
function asForm(lab: NewLab): FormData {
  const form = new FormData()
  for (const [field, value] of Object.entries(lab)) {
    if (value !== null && value !== '') form.append(field, value instanceof File ? value : String(value))
  }

  return form
}

export const labsApi = {
  list: () => client.get<{ data: LabRow[] }>('/labs').then((response) => response.data.data),
  get: (id: string) => client.get(`/labs/${id}`).then(one),
  /** `access_link_sent` is false when only the email failed: the lab is kept. */
  create: (lab: NewLab) => client.post<{ data: Lab; access_link_sent: boolean }>('/labs', asForm(lab)).then((response) => response.data),
  update: (id: string, changes: LabChanges) => client.put(`/labs/${id}`, changes).then(one),
  replaceLogo: (id: string, logo: File) => {
    const form = new FormData()
    form.append('logo', logo)

    return client.post(`/labs/${id}/logo`, form).then(one)
  },
  removeLogo: (id: string) => client.delete(`/labs/${id}/logo`),
  sendAccessLink: (id: string) => client.post(`/labs/${id}/access-link`),
  suspend: (id: string, reason: string | null) => client.post(`/labs/${id}/suspend`, { reason }).then(one),
  resume: (id: string) => client.post(`/labs/${id}/resume`).then(one),
  addPeriod: (id: string, period: NewPeriod) => client.post(`/labs/${id}/subscriptions`, period).then(one),
  updatePeriod: (periodId: number, changes: { monthly_price: number; note: string | null }) => client.put(`/subscriptions/${periodId}`, changes).then(one),
  removePeriod: (periodId: number) => client.delete(`/subscriptions/${periodId}`),
}
