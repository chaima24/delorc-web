import { computed, ref, shallowRef } from 'vue'
import { fetchSpecialities, type Speciality } from '@/api/tenant/customerSetup'
import { fetchCommunes, fetchWilayas, type Commune, type Wilaya } from '@/api/tenant/geography'
import { fetchAllHcos, type Hco } from '@/api/tenant/hcos'

const byName = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label)

// Wilayas and specialities: loaded once per visit.
const wilayas = shallowRef<Wilaya[]>([])
const specialities = shallowRef<Speciality[]>([])
let basicsLoading: Promise<void> | null = null
function loadBasics() {
  basicsLoading ??= Promise.all([fetchWilayas({ per_page: 100, sort: 'name' }), fetchSpecialities({ per_page: 100, sort: 'name' })])
    .then(([wilayaPage, specialityPage]) => {
      wilayas.value = wilayaPage.items
      specialities.value = specialityPage.items
    })
    .catch(() => { basicsLoading = null })
  return basicsLoading
}

// Organisations: every one, loaded once per visit.
const hcos = shallowRef<Hco[]>([])
let hcosLoading: Promise<void> | null = null
function loadHcos(force = false) {
  if (force) hcosLoading = null
  hcosLoading ??= fetchAllHcos()
    .then(rows => { hcos.value = rows })
    .catch(() => { hcosLoading = null })
  return hcosLoading
}

// Communes per wilaya, loaded when a wilaya is picked (a wilaya has up to ~60).
const communes = ref<Record<number, Commune[]>>({})
async function loadCommunes(wilayaId: number | null) {
  if (!wilayaId || communes.value[wilayaId]) return
  const result = await fetchCommunes({ 'filter[wilaya_id]': wilayaId, per_page: 100, sort: 'name' })
  communes.value = { ...communes.value, [wilayaId]: result.items }
}

/** Options for the professional and organisation forms and filters: wilayas, communes, organisations, specialities. */
export function useHcpLookups() {
  void loadBasics()
  void loadHcos()

  return {
    wilayaOptions: computed(() => wilayas.value.map(w => ({ value: w.id, label: w.name })).sort(byName)),
    specialityOptions: computed(() => specialities.value.map(s => ({ value: s.id, label: s.name })).sort(byName)),
    hcoOptions: computed(() => hcos.value.map(h => ({ value: h.id, label: h.name, hint: h.commune?.name ?? undefined })).sort(byName)),
    communeOptions: (wilayaId: number | null) => (wilayaId ? (communes.value[wilayaId] ?? []).map(c => ({ value: c.id, label: c.name })).sort(byName) : []),
    loadCommunes,
    /** After an organisation was added, renamed or deleted. */
    reloadHcos: () => loadHcos(true),
  }
}
