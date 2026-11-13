import { ref } from 'vue'
import { fetchAllBrands } from '@/api/tenant/brands'
import { fetchCanals } from '@/api/tenant/fieldSetup'
import { fetchVisitAdvs, fetchVisitCoaches, type Visit, type VisitOfferedAdv, type VisitPayload, type VisitTargetQuery } from '@/api/tenant/visits'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import type { ReportForm } from './VisitReportFields.vue'

type Option = { value: number; label: string }

/** Pharmacies, wholesalers and organisations give the stock seen; doctors and dentists don't. */
export const givesStock = (type: string, kind: string | null) => type === 'hco' || !['doctor', 'dentiste'].includes(kind ?? '')

export const emptyReport = (): ReportForm => ({ brands: [], advs: [], coaches: [], participants: [], replacement: null })

/** A visit's report as the forms hold it. */
export const reportOf = (visit: Visit): ReportForm => ({
  brands: visit.brands.map(row => ({ brand_id: row.id, feedback: row.feedback, stock: row.stock == null ? '' : String(row.stock) })),
  advs: (visit.advs ?? []).map(row => ({ adv_id: row.id, feedback: row.feedback })),
  coaches: (visit.coaches ?? []).map(row => ({ id: row.id, name: row.full_name })),
  participants: (visit.participants ?? []).map(row => ({ id: row.id, name: row.name })),
  replacement: visit.replacement ?? null,
})

/** The report as the API reads it; `parts` keeps only the blocks being saved (a card of the visit's page). */
export function reportPayload(form: ReportForm, parts: ('brands' | 'advs' | 'people')[] = ['brands', 'advs', 'people'], fields?: Record<string, string> | null): VisitPayload {
  const payload: VisitPayload = {}
  // A field the lab hides is never sent (docs/api/visit-report-fields.md): the API refuses a hidden field with a value.
  const hidden = (key: string) => fields?.[key] === 'hidden'
  if (parts.includes('brands')) payload.brands = form.brands.map(row => ({ brand_id: row.brand_id, feedback: hidden('brand_feedback') ? null : row.feedback, stock: row.stock === '' || hidden('brand_stock') ? null : Number(row.stock) }))
  if (parts.includes('advs') && !hidden('advs')) payload.advs = form.advs.map(row => ({ adv_id: row.adv_id, feedback: hidden('adv_feedback') ? null : row.feedback }))
  if (parts.includes('people')) {
    if (!hidden('coaches')) payload.coaches = form.coaches.map(row => row.id)
    if (!hidden('participants')) payload.participants = form.participants.map(row => row.id)
    if (!hidden('replacement')) payload.hcp_replacement_id = form.replacement?.id ?? null
  }
  return payload
}

/** The lists of the visit forms (brands, canals, who can go along), asked again on coming back to the tab. */
export function useVisitLookups() {
  const brands = ref<Option[]>([])
  const canals = ref<Option[]>([])
  const coaches = ref<{ id: number; full_name: string; role: string | null }[]>([])
  onMountedAndFocus(async () => {
    const [b, c, people] = await Promise.all([fetchAllBrands(), fetchCanals({ per_page: 100, sort: 'name' }), fetchVisitCoaches()])
    brands.value = b.map(row => ({ value: row.id, label: row.name }))
    canals.value = c.items.map(row => ({ value: row.id, label: row.name }))
    coaches.value = people
  })
  return { brands, canals, coaches }
}

/** The ADVs that can be shown for the chosen brands; those already ticked stay in the list. */
export async function offeredAdvs(query: VisitTargetQuery, form: ReportForm, already: VisitOfferedAdv[] = []): Promise<VisitOfferedAdv[]> {
  const brandIds = form.brands.map(row => row.brand_id)
  const offered = brandIds.length ? await fetchVisitAdvs({ ...query, brand_ids: brandIds }) : []
  const kept = already.filter(adv => form.advs.some(row => row.adv_id === adv.id) && !offered.some(one => one.id === adv.id))
  form.advs = form.advs.filter(row => [...offered, ...kept].some(adv => adv.id === row.adv_id))
  return [...offered, ...kept]
}
