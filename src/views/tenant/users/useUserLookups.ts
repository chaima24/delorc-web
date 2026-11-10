import { onMounted, ref } from 'vue'
import { type Wilaya, fetchCommunes, fetchWilayas } from '@/api/tenant/geography'
import { type Language, fetchLanguages } from '@/api/tenant/fieldSetup'
import { rolesApi } from '@/api/tenant/roles'
import { planningRulesApi, validationRulesApi, type PlanningRule, type ValidationRule } from '@/api/tenant/rules'
import { fetchAllTeams } from '@/api/tenant/teams'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'

type Option<V = number> = { value: V; label: string }
const byLabel = <V>(a: Option<V>, b: Option<V>) => a.label.localeCompare(b.label)

/** Options for the user forms (roles, teams, wilayas, active languages), loaded when the form opens. */
export function useUserLookups() {
  const roles = ref<Option<string>[]>([])
  const wilayas = ref<Option[]>([])
  const languages = ref<Language[]>([])
  const teams = ref<Option[]>([])

  onMounted(async () => {
    const [roleList, teamList, wilayaPage, languagePage] = await Promise.all([
      rolesApi.list(),
      fetchAllTeams(),
      fetchWilayas({ per_page: 100, sort: 'name' }),
      fetchLanguages({ per_page: 100 }),
    ])
    roles.value = roleList.map(role => ({ value: role.name, label: roleLabel(role.name) })).sort(byLabel)
    teams.value = teamList.map(team => ({ value: team.id, label: team.name })).sort(byLabel)
    wilayas.value = wilayaPage.items.map((wilaya: Wilaya) => ({ value: wilaya.id, label: wilaya.name }))
    languages.value = languagePage.items.filter(language => language.is_active)
  })

  return { roles, teams, wilayas, languages }
}

/** Full rules (values, description, people using them), active first then by name; shared by every picker. */
const planningRules = ref<PlanningRule[]>([])
const validationRules = ref<ValidationRule[]>([])
const byRuleName = (a: { name: string; is_active: boolean }, b: { name: string; is_active: boolean }) =>
  Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name)
let rulesLoaded: Promise<void> | null = null

/** Reload after a rule changes elsewhere (or to refresh the people counts). */
export function reloadRules(): Promise<void> {
  rulesLoaded = null
  return loadRules()
}
function loadRules(): Promise<void> {
  rulesLoaded ??= Promise.all([planningRulesApi.all(), validationRulesApi.all()])
    .then(([planning, validation]) => {
      planningRules.value = planning.sort(byRuleName)
      validationRules.value = validation.sort(byRuleName)
    })
    .catch(() => { rulesLoaded = null })
  return rulesLoaded
}

/** The planning and validation rules, for the rule pickers and the Règles tab. */
export function useRuleLookups() {
  void loadRules()
  return { planningRules, validationRules }
}

/** Communes of one wilaya (a wilaya has up to ~60). */
export async function loadCommunes(wilayaId: number): Promise<Option[]> {
  const result = await fetchCommunes({ 'filter[wilaya_id]': wilayaId, per_page: 100, sort: 'name' })
  return result.items.map(commune => ({ value: commune.id, label: commune.name }))
}
