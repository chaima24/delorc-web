import { ref, type Ref } from 'vue'
import { fetchTerritoryCoverage } from '@/api/tenant/territories'
import { coversOf, type CoverPick } from './coversForm'
import { watchDebounced } from './watchDebounced'

export interface Coverage {
  count: number
  by_type: Record<string, number>
}

/** Live count of the professionals the picks cover (null when it couldn't be counted). */
export function useCoverage(picks: Ref<CoverPick[]>) {
  const coverage = ref<Coverage | null>(null)
  const counting = ref(false)
  watchDebounced(() => JSON.stringify(coversOf(picks.value)), async () => {
    if (!picks.value.length) {
      coverage.value = { count: 0, by_type: {} }
      return
    }
    counting.value = true
    try {
      coverage.value = await fetchTerritoryCoverage(coversOf(picks.value)) as Coverage
    }
    catch {
      coverage.value = null
    }
    finally {
      counting.value = false
    }
  })
  return { coverage, counting }
}
