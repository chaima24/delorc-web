import { ref } from 'vue'
import { fetchAllBrands } from '@/api/tenant/brands'
import { fetchSpecialities } from '@/api/tenant/customerSetup'
import { fetchAllTeams } from '@/api/tenant/teams'

type Option = { value: number; label: string }
const byLabel = (a: Option, b: Option) => a.label.localeCompare(b.label)

// Brands, teams and specialities for the ADV filters and forms: loaded when the page opens, and again on `refresh()`.
const brands = ref<Option[]>([])
const teams = ref<Option[]>([])
const specialities = ref<Option[]>([])
let loading: Promise<void> | null = null

async function allSpecialities() {
  const rows: { id: number; name: string }[] = []
  for (let page = 1; ; page++) {
    const result = await fetchSpecialities({ page, per_page: 100, sort: 'name' })
    rows.push(...result.items)
    if (!result.items.length || rows.length >= result.total) break
  }
  return rows
}

function load(): Promise<void> {
  return Promise.all([fetchAllBrands(), fetchAllTeams(), allSpecialities()])
    .then(([b, t, s]) => {
      brands.value = b.map(row => ({ value: row.id, label: row.name })).sort(byLabel)
      teams.value = t.map(row => ({ value: row.id, label: row.name })).sort(byLabel)
      specialities.value = s.map(row => ({ value: row.id, label: row.name })).sort(byLabel)
    })
    .catch(() => { loading = null })
}

/** `refresh()` asks again: a brand or a team added meanwhile (in another tab, by a colleague) then shows up. */
export function useAdvLookups() {
  loading ??= load()
  const refresh = () => { loading = load() }
  return { brands, teams, specialities, refresh }
}
