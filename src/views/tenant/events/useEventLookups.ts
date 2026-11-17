import { ref } from 'vue'
import { fetchCampaigns } from '@/api/tenant/campaigns'
import { fetchSpecialities } from '@/api/tenant/customerSetup'
import { fetchEventPeople, type EventPerson } from '@/api/tenant/events'
import { fetchEventTypes } from '@/api/tenant/fieldSetup'
import { fetchWilayas } from '@/api/tenant/geography'
import { refreshOnFocus } from '@/composables/refreshOnFocus'

type Option = { value: number; label: string; hint?: string }

// The event form's lists: types, campaigns (with their dates), wilayas, specialities and the people the viewer may add.
// Loaded when a form opens, and again on coming back to the tab, so what was added meanwhile shows up.
const types = ref<Option[]>([])
const campaigns = ref<(Option & { start: string; end: string })[]>([])
const wilayas = ref<Option[]>([])
const specialities = ref<Option[]>([])
const people = ref<EventPerson[]>([])

const all = { page: 1, per_page: 100 }
const byLabel = (a: Option, b: Option) => a.label.localeCompare(b.label)

function load(withPeople: boolean): Promise<void> {
  return Promise.all([
    fetchEventTypes(all), fetchCampaigns({ ...all, sort: '-start_date' }), fetchWilayas({ ...all, sort: 'name' }), fetchSpecialities({ ...all, sort: 'name' }),
    withPeople ? fetchEventPeople() : Promise.resolve(null),
  ]).then(([ty, c, w, s, p]) => {
    types.value = ty.items.map(row => ({ value: row.id, label: row.event })).sort(byLabel)
    campaigns.value = c.items.map(row => ({ value: row.id, label: `${row.code} · ${row.name}`, start: row.start_date, end: row.end_date }))
    wilayas.value = w.items.map(row => ({ value: row.id, label: row.name }))
    specialities.value = s.items.filter(row => row.type === 'medecin').map(row => ({ value: row.id, label: row.name }))
    if (p) people.value = p
  }).catch(() => undefined)
}

/** `withPeople`: the people too (only who may create events can read them). */
export function useEventLookups(withPeople = true) {
  const refresh = () => load(withPeople)
  refresh()
  refreshOnFocus(refresh)
  return { types, campaigns, wilayas, specialities, people, refresh }
}
