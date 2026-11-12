import { ref } from 'vue'
import type { ListParams } from '@/api/tenant/geography'
import { fetchTerritories, type Territory } from '@/api/tenant/territories'
import { useOrgTree } from '@/views/tenant/users/hierarchy/useOrgTree'

// Shared lists the territory screens read: every territory (for "Part of" and the tree) and every person
// (the people pickers, from the hierarchy's one copy).
const items = ref<Territory[]>([])
const loaded = ref(false)
let loading: Promise<void> | null = null

/** Every territory matching the params, 100 at a time (the tree, the export). */
export async function allTerritories(params: ListParams = {}): Promise<Territory[]> {
  const rows: Territory[] = []
  for (let page = 1; ; page++) {
    const result = await fetchTerritories({ ...params, page, per_page: 100 })
    rows.push(...result.items)
    if (!result.items.length || rows.length >= result.total) break
  }
  return rows
}

async function load(): Promise<void> {
  items.value = await allTerritories({ sort: 'name' })
  loaded.value = true
}

function refresh(): Promise<void> {
  loading = load().catch(() => { loading = null })
  return loading
}

/** Every territory (id, name, parent). */
export function useTerritories() {
  return { items, loaded, refresh, ensureLoaded: () => loading ?? refresh() }
}

/** Every person, with their role. */
export function useUsers() {
  const { people } = useOrgTree()
  return { ...people, ensureLoaded: () => (people.loaded.value ? Promise.resolve() : people.refresh()) }
}
