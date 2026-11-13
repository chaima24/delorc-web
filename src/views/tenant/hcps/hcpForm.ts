import { useI18n } from 'vue-i18n'
import { PERSON_TYPES, type Hcp, type HcpContactedBy, type HcpGender, type HcpPayload, type HcpStatus, type HcpType } from '@/api/tenant/hcps'

/** Form values (numbers typed as text). */
export interface HcpForm {
  type: HcpType
  name: string
  gender: HcpGender | null
  status: HcpStatus
  verified: boolean
  email: string
  phone: string
  fax: string
  contacted_by: HcpContactedBy
  wilaya_id: number | null
  commune_id: number | null
  address: string
  latitude: string
  longitude: string
  one_key_id: string
  wkp_id: string
}

export interface WorkplaceForm {
  hco_id: number | null
  speciality_id: number | null
  start_date: string
}

/** The parts of a record, each edited on its own (full page) or as a step (Add). */
export type HcpPart = 'identity' | 'contact' | 'place' | 'ids'

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value))

export const isPerson = (type?: HcpType | null) => !!type && PERSON_TYPES.includes(type)

export function toForm(hcp?: Hcp | null): HcpForm {
  return {
    type: hcp?.type ?? 'doctor',
    name: hcp?.name ?? '',
    gender: hcp?.gender ?? null,
    status: hcp?.status ?? 'active',
    verified: hcp?.verified ?? false,
    email: hcp?.email ?? '',
    phone: hcp?.phone ?? '',
    fax: hcp?.fax ?? '',
    contacted_by: hcp?.contacted_by ?? 'phone',
    wilaya_id: hcp?.commune?.wilaya_id ?? hcp?.commune?.wilaya?.id ?? null,
    commune_id: hcp?.commune_id ?? null,
    address: hcp?.address ?? '',
    latitude: text(hcp?.latitude),
    longitude: text(hcp?.longitude),
    one_key_id: hcp?.one_key_id ?? '',
    wkp_id: hcp?.wkp_id ?? '',
  }
}

export const emptyWorkplace = (): WorkplaceForm => ({ hco_id: null, speciality_id: null, start_date: '' })

const number = (value: string) => {
  const typed = value.trim()
  return typed === '' ? null : Number(typed.replace(',', '.'))
}

/** The API fields of some parts (all of them by default). */
export function toPayload(form: HcpForm, parts: HcpPart[] = ['identity', 'contact', 'place', 'ids']): HcpPayload {
  const payload: HcpPayload = {}
  if (parts.includes('identity')) {
    Object.assign(payload, {
      type: form.type,
      name: form.name.trim(),
      gender: isPerson(form.type) ? form.gender : null,
      // A proposal's status only changes by approving or refusing it.
      status: form.status === 'active' || form.status === 'inactive' ? form.status : undefined,
      verified: form.verified,
    })
  }
  if (parts.includes('contact')) {
    Object.assign(payload, {
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      fax: form.fax.trim() || null,
      contacted_by: form.contacted_by,
    })
  }
  if (parts.includes('place')) {
    Object.assign(payload, {
      commune_id: form.commune_id ?? undefined,
      address: form.address.trim() || null,
      latitude: number(form.latitude),
      longitude: number(form.longitude),
    })
  }
  if (parts.includes('ids')) Object.assign(payload, { one_key_id: form.one_key_id.trim(), wkp_id: form.wkp_id.trim() })
  return payload
}

/** Required or invalid fields of a part, as field → message. */
export function checkPart(form: HcpForm, part: HcpPart, messages: { required: string; coordinates: string }): Record<string, string> {
  const errors: Record<string, string> = {}
  if (part === 'identity') {
    if (!form.name.trim()) errors.name = messages.required
    if (isPerson(form.type) && !form.gender) errors.gender = messages.required
  }
  if (part === 'place') {
    if (!form.commune_id) errors.commune_id = messages.required
    const lat = number(form.latitude)
    const lng = number(form.longitude)
    if ((lat === null) !== (lng === null) || (lat !== null && (Number.isNaN(lat) || Math.abs(lat) > 90)) || (lng !== null && (Number.isNaN(lng) || Math.abs(lng) > 180)))
      errors.latitude = messages.coordinates
  }
  if (part === 'ids') {
    if (!form.one_key_id.trim()) errors.one_key_id = messages.required
    if (!form.wkp_id.trim()) errors.wkp_id = messages.required
  }
  return errors
}

/** Labels, dates and initials for professionals. */
export function useHcpText() {
  const { t, d } = useI18n()

  const type = (value?: HcpType | null) => (value ? t(`hcps.types.${value}`) : '—')
  const date = (value?: string | null) =>
    value ? d(new Date(`${value.slice(0, 10)}T12:00:00`), { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
  const shortDate = (value?: string | null) =>
    value ? d(new Date(`${value.slice(0, 10)}T12:00:00`), { day: 'numeric', month: 'short' }) : '—'
  const place = (hcp: Hcp) => [hcp.commune?.name, hcp.commune?.wilaya?.name].filter(Boolean).join(' · ') || '—'
  /** "M1042" */
  const code = (hcp: Hcp) => (hcp.generated_id ?? '').toUpperCase()
  /** The first current workplace: "Cardiology", "CHU Mustapha". */
  const mainWorkplace = (hcp: Hcp) => {
    const workplace = hcp.current_workplaces?.[0] ?? hcp.workplaces?.find(w => !w.end_date)
    return { speciality: workplace?.speciality?.name ?? null, hco: workplace?.hco?.name ?? null }
  }

  return { type, date, shortDate, place, code, mainWorkplace }
}

/** The name the avatar takes its initials from: "Dr Karim Benali" → "Karim Benali" (KB). */
export const avatarName = (name: string) => name.replace(/^dr\.?\s+/i, '') || name
