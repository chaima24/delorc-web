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
  /** A deleted lab stays in the list: its database and files are gone, its exports stay until they expire. */
  status: 'active' | 'suspended' | 'deleted'
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
  copied_languages: { id: number; code: string; native_name: string; direction: 'ltr' | 'rtl' }[]
  first_admin: { name: string; email: string; last_login_at: string | null } | null
  /** Null while active. `by` is null for an automatic suspension. */
  suspension: { at: string | null; by: { id: number; name: string } | null; reason: string | null } | null
  grace_ends_on: string | null
  deleted_at: string | null
  deleted_by: { id: number; name: string } | null
  subscriptions: Subscription[]
}

export interface NewLab {
  id: string
  name: string
  country_id: number | null
  plan_id: number | null
  /** The checked languages. French is always one of them. */
  language_ids: number[]
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
    if (Array.isArray(value)) value.forEach((item) => form.append(`${field}[]`, String(item)))
    else if (value !== null && value !== '') form.append(field, value instanceof File ? value : String(value))
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
  /** The slug typed again confirms it. Answers with the lab page, now `deleted`. */
  remove: (id: string, slug: string) => client.delete(`/labs/${id}`, { data: { slug } }).then(one),
}

/** Expired: a ready export whose days are over (worked out by the API). */
export type ExportState = 'preparing' | 'ready' | 'failed' | 'expired'

export interface LabExport {
  id: number
  state: ExportState
  size_bytes: number | null
  /** A short reason when failed. */
  error: string | null
  requested_by: { id: number; name: string } | null
  /** "Asked on". */
  created_at: string
  ready_at: string | null
  expires_at: string | null
}

/** Why delete is not allowed yet, or null when it is. */
export type DeleteBlocker = 'not_suspended' | 'no_export' | 'export_preparing' | 'export_expired' | 'deleted' | null

/** The Data tab: the exports, newest first, and whether the lab can be deleted. */
export interface LabData {
  exports: LabExport[]
  delete: { allowed: boolean; reason: DeleteBlocker }
}

export const labExportsApi = {
  get: (labId: string) => client.get<{ data: LabData }>(`/labs/${labId}/exports`).then((response) => response.data.data),
  ask: (labId: string) => client.post<{ data: LabExport }>(`/labs/${labId}/exports`).then((response) => response.data.data),
  /** A 5-minute link to the ZIP: the browser cannot send the token with a plain download, so the API gives a link. */
  downloadUrl: (exportId: number) => client.get<{ url: string }>(`/lab-exports/${exportId}/download`).then((response) => response.data.url),
}

/** A limit is a number (null = unlimited); a switch is true or false. */
export type FeatureValue = number | boolean | null

export interface FeatureChange {
  id: number
  feature: string
  value: FeatureValue
  starts_on: string
  /** Null: no end. */
  ends_on: string | null
  note: string | null
  state: 'planned' | 'now' | 'past'
  created_by: { id: number; name: string } | null
  created_at: string
}

/** The Features tab: every catalog feature, then every change for this lab. */
export interface LabFeatures {
  plan: { id: number; name: string } | null
  features: {
    key: string
    type: 'limit' | 'switch'
    plan_value: FeatureValue
    change: Pick<FeatureChange, 'id' | 'value' | 'starts_on' | 'ends_on'> | null
    /** What the lab gets today. */
    value: FeatureValue
  }[]
  changes: FeatureChange[]
}

export type FeatureChangeFields = Pick<FeatureChange, 'value' | 'starts_on' | 'ends_on' | 'note'>

const tab = (response: { data: { data: LabFeatures } }) => response.data.data

export const labFeaturesApi = {
  get: (labId: string) => client.get(`/labs/${labId}/features`).then(tab),
  add: (labId: string, change: FeatureChangeFields & { feature: string }) => client.post(`/labs/${labId}/features`, change).then(tab),
  update: (changeId: number, change: FeatureChangeFields) => client.put(`/lab-features/${changeId}`, change).then(tab),
  remove: (changeId: number) => client.delete(`/lab-features/${changeId}`),
}

/** A row of a lab's Texts tab: `texts` with no language chosen, the others with a language. */
export interface LabTextRow {
  key: string
  texts?: Record<string, string | null>
  changed?: string[]
  /** The master text: French without a language, else the chosen language's. */
  master: string | null
  value?: string | null
  changed_for_lab?: boolean
  state?: 'done' | 'missing' | 'check'
}

export interface LabTextFilters {
  language?: string
  search?: string
  changed?: boolean
  sort?: string
}

export const labTextsApi = {
  list: (labId: string, filters: LabTextFilters, page: number, perPage: number) => {
    const params: Record<string, string | number> = { page, per_page: perPage }
    if (filters.language) params.language = filters.language
    if (filters.search) params['filter[search]'] = filters.search
    if (filters.changed) params['filter[changed]'] = 1
    if (filters.sort) params.sort = filters.sort

    return client.get<{ data: LabTextRow[]; meta: { total: number }; summary: { total: number; changed: number } }>(`/labs/${labId}/texts`, { params })
      .then((response) => response.data)
  },
  save: (labId: string, texts: { language: string; key: string; value: string | null }[]) => client.put(`/labs/${labId}/texts`, { texts }),
  putBack: (labId: string, language: string, key: string) => client.post(`/labs/${labId}/texts/put-back`, { language, key }),
  addLanguage: (labId: string, languageId: number) => client.post(`/labs/${labId}/languages`, { language_id: languageId }).then(one),
}

/** A lab's rule type, every field (docs/api/rule-types.md): the building blocks of its territories. */
export interface LabRuleTypeFields {
  name: string
  code: string
  /** The type it sits in, and the column of its table that points there (commune: wilaya + wilaya_id). */
  parent_code: string | null
  parent_key: string | null
  is_visible: boolean
  supports_sub_zone: boolean
  /** Résidence / Semi-résidence / Hors résidence per wilaya. */
  supports_zone_type: boolean
  main_table: string
  main_model_class: string
  sub_zone_table: string | null
  sub_model_class: string | null
  /** How a professional reaches a choice; null: not offered in territories. */
  hcp_path: string | null
  hcp_sub_path: string | null
  /** Kinds of professionals; null = all. */
  hcp_types: string[] | null
  user_path: string | null
  user_sub_path: string | null
  user_skip_empty: boolean
}

export interface LabRuleType extends LabRuleTypeFields {
  id: number
  choices_count: number
  sub_zones_count: number | null
  territories_count: number
}

const ruleType = (response: { data: { data: LabRuleType } }) => response.data.data

export const labRuleTypesApi = {
  /** In chain order: Région › Wilaya › Commune, then the types on their own. */
  list: (labId: string) => client.get<{ data: LabRuleType[] }>(`/labs/${labId}/rule-types`).then((response) => response.data.data),
  add: (labId: string, fields: LabRuleTypeFields) => client.post(`/labs/${labId}/rule-types`, fields).then(ruleType),
  update: (labId: string, id: number, fields: Partial<LabRuleTypeFields>) => client.put(`/labs/${labId}/rule-types/${id}`, fields).then(ruleType),
  remove: (labId: string, id: number) => client.delete(`/labs/${labId}/rule-types/${id}`),
}
