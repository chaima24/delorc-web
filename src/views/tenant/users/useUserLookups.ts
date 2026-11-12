import { computed, onMounted, ref } from 'vue'
import { type Wilaya, fetchCommunes, fetchWilayas } from '@/api/tenant/geography'
import { type Language, fetchLanguages } from '@/api/tenant/fieldSetup'
import { rolesApi } from '@/api/tenant/roles'
import { planningRulesApi, validationRulesApi, type PlanningRule, type ValidationRule } from '@/api/tenant/rules'
import { fetchAllTeams } from '@/api/tenant/teams'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { useTerritories } from '@/views/tenant/territories/useTerritoryLookups'
import { useOrgTree } from './hierarchy/useOrgTree'

type Option<V = number> = { value: V; label: string; hint?: string }
const byLabel = <V>(a: Option<V>, b: Option<V>) => a.label.localeCompare(b.label)

/** Options for the user forms (roles, teams, people, territories, wilayas, active languages), loaded when the form opens. */
export function useUserLookups() {
  // Active people, with their role underneath (managers), from the hierarchy's shared list.
  const { people: everyone } = useOrgTree()
  const people = computed(() => everyone.items.value
    .filter(user => user.is_active)
    .map(user => ({ value: user.id, label: user.full_name, hint: roleLabel(user.role) }))
    .sort(byLabel))

  const roles = ref<Option<string>[]>([])
  /** Names of the field roles (VM, VP, KAM…): they get a first cycle by default. */
  const fieldRoles = ref<string[]>([])
  const wilayas = ref<Option[]>([])
  const languages = ref<Language[]>([])
  const teams = ref<Option[]>([])
  // Territories: only for people who may see them (docs/api/territories.md).
  const shared = useTerritories()
  if (useAuthStore().can('territories.show')) void shared.ensureLoaded()
  const territories = computed(() => shared.items.value.map(territory => ({ value: territory.id, label: territory.name })).sort(byLabel))

  onMounted(async () => {
    const [roleList, teamList, wilayaPage, languagePage] = await Promise.all([
      rolesApi.list(),
      fetchAllTeams(),
      fetchWilayas({ per_page: 100, sort: 'name' }),
      fetchLanguages({ per_page: 100 }),
    ])
    roles.value = roleList.map(role => ({ value: role.name, label: roleLabel(role.name) })).sort(byLabel)
    fieldRoles.value = roleList.filter(role => role.is_field).map(role => role.name)
    teams.value = teamList.map(team => ({ value: team.id, label: team.name })).sort(byLabel)
    wilayas.value = wilayaPage.items.map((wilaya: Wilaya) => ({ value: wilaya.id, label: wilaya.name }))
    languages.value = languagePage.items.filter(language => language.is_active)
  })

  return { roles, fieldRoles, teams, people, territories, wilayas, languages }
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
