import { onMounted, ref } from 'vue'
import { type Wilaya, fetchCommunes, fetchWilayas } from '@/api/tenant/geography'
import { type Language, fetchLanguages } from '@/api/tenant/fieldSetup'
import { rolesApi } from '@/api/tenant/roles'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'

type Option<V = number> = { value: V; label: string }
const byLabel = <V>(a: Option<V>, b: Option<V>) => a.label.localeCompare(b.label)

/** Options for the user forms (roles, wilayas, active languages), loaded when the form opens. */
export function useUserLookups() {
  const roles = ref<Option<string>[]>([])
  const wilayas = ref<Option[]>([])
  const languages = ref<Language[]>([])

  onMounted(async () => {
    const [roleList, wilayaPage, languagePage] = await Promise.all([
      rolesApi.list(),
      fetchWilayas({ per_page: 100, sort: 'name' }),
      fetchLanguages({ per_page: 100 }),
    ])
    roles.value = roleList.map(role => ({ value: role.name, label: roleLabel(role.name) })).sort(byLabel)
    wilayas.value = wilayaPage.items.map((wilaya: Wilaya) => ({ value: wilaya.id, label: wilaya.name }))
    languages.value = languagePage.items.filter(language => language.is_active)
  })

  return { roles, wilayas, languages }
}

/** Communes of one wilaya (a wilaya has up to ~60). */
export async function loadCommunes(wilayaId: number): Promise<Option[]> {
  const result = await fetchCommunes({ 'filter[wilaya_id]': wilayaId, per_page: 100, sort: 'name' })
  return result.items.map(commune => ({ value: commune.id, label: commune.name }))
}
