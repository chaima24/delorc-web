import { computed, ref } from 'vue'
import { fetchRuleTypes, type RuleType } from '@/api/tenant/ruleTypes'

const all = ref<RuleType[]>([])
let pending: Promise<void> | null = null

/** Rule types, in their order (the API sends them in chain order); `pickable` = shown and linked to professionals (offered in the territory form). */
export function useTerritoryTypes() {
  if (!pending) {
    pending = fetchRuleTypes()
      .then(rows => { all.value = rows })
      .catch(() => { pending = null })
  }
  return {
    all,
    pickable: computed(() => all.value.filter(type => type.is_visible && !!type.hcp_path)),
    ready: () => pending ?? Promise.resolve(),
  }
}
