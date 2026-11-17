import { ref } from 'vue'
import { fetchAllTeams } from '@/api/tenant/teams'
import { fetchPriorities } from '@/api/tenant/customerSetup'
import { refreshOnFocus } from '@/composables/refreshOnFocus'
import type { PriorityRef } from '@/api/tenant/campaigns'

type Option = { value: number; label: string }

// Teams (forms and filters) and the lab's priorities (the tick window): loaded when a page opens, and again on
// `refresh()` and on coming back to the tab, so a team or a priority added meanwhile shows up.
const teams = ref<Option[]>([])
const priorities = ref<PriorityRef[]>([])
let loading: Promise<void> | null = null

function load(): Promise<void> {
  return Promise.all([fetchAllTeams(), fetchPriorities({ page: 1, per_page: 100, sort: 'order' })])
    .then(([t, p]) => {
      teams.value = t.map(row => ({ value: row.id, label: row.name })).sort((a, b) => a.label.localeCompare(b.label))
      priorities.value = p.items.map(row => ({ id: row.id, name: row.name, color: row.color, order: row.order }))
    })
    .catch(() => { loading = null })
}

const refresh = () => { loading = load() }

export function useCampaignLookups() {
  loading ??= load()
  refreshOnFocus(refresh)
  return { teams, priorities, refresh }
}
