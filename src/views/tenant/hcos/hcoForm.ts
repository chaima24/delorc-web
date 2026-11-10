import { useI18n } from 'vue-i18n'
import type { Hco, HcoPayload, HcoType } from '@/api/tenant/hcos'

export interface HcoForm {
  type: HcoType
  name: string
  parent_id: number | null
  phone: string
  one_key_id: string
  wilaya_id: number | null
  commune_id: number | null
  address: string
  latitude: string
  longitude: string
}

/** The parts of an organisation, each edited on its own (panel) or as a step (Add). */
export type HcoPart = 'info' | 'place'

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value))

export function toForm(hco?: Partial<Hco> | null): HcoForm {
  return {
    type: hco?.type ?? 'hospital',
    name: hco?.name ?? '',
    parent_id: hco?.parent_id ?? null,
    phone: hco?.phone ?? '',
    one_key_id: hco?.one_key_id ?? '',
    wilaya_id: hco?.commune?.wilaya_id ?? hco?.commune?.wilaya?.id ?? null,
    commune_id: hco?.commune_id ?? null,
    address: hco?.address ?? '',
    latitude: text(hco?.latitude),
    longitude: text(hco?.longitude),
  }
}

const number = (value: string) => {
  const typed = value.trim()
  return typed === '' ? null : Number(typed.replace(',', '.'))
}

export function toPayload(form: HcoForm, parts: HcoPart[] = ['info', 'place']): HcoPayload {
  const payload: HcoPayload = {}
  if (parts.includes('info')) {
    Object.assign(payload, {
      type: form.type,
      name: form.name.trim(),
      parent_id: form.parent_id,
      phone: form.phone.trim() || null,
      one_key_id: form.one_key_id.trim(),
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
  return payload
}

export function checkPart(form: HcoForm, part: HcoPart, messages: { required: string; coordinates: string }): Record<string, string> {
  const errors: Record<string, string> = {}
  if (part === 'info') {
    if (!form.name.trim()) errors.name = messages.required
    if (!form.one_key_id.trim()) errors.one_key_id = messages.required
  }
  if (part === 'place') {
    if (!form.commune_id) errors.commune_id = messages.required
    const lat = number(form.latitude)
    const lng = number(form.longitude)
    if ((lat === null) !== (lng === null) || (lat !== null && (Number.isNaN(lat) || Math.abs(lat) > 90)) || (lng !== null && (Number.isNaN(lng) || Math.abs(lng) > 180)))
      errors.latitude = messages.coordinates
  }
  return errors
}

export function useHcoText() {
  const { t } = useI18n()
  const place = (hco: Partial<Hco>) => [hco.commune?.name, hco.commune?.wilaya?.name].filter(Boolean).join(' · ') || '—'
  /** "Hospital · 14 departments" or "Department of CHU Mustapha". */
  const kind = (hco: Partial<Hco>) => {
    if (hco.parent?.name) return t('hcos.departmentOf', { name: hco.parent.name })
    if (hco.parent_id) return t('hcos.department')
    const type = hco.type ? t(`hcos.types.${hco.type}`) : ''
    return hco.children_count ? `${type} · ${t('hcos.departments', { n: hco.children_count }, hco.children_count)}` : type
  }
  return { place, kind }
}
