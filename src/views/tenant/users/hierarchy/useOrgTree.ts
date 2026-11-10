import { computed, ref } from 'vue'
import { fetchUsers, type TenantUser } from '@/api/tenant/users'
import { buildOrgTree } from './orgTree'

// Everyone with their current managers, teams and role: the hierarchy view, "Reports to"
// in the panel and on the user page all read from this one copy.
const items = ref<TenantUser[]>([])
const loaded = ref(false)
let loading: Promise<void> | null = null

/** Every person, 100 at a time (the list sends each one's current managers). */
async function load(): Promise<void> {
  const rows: TenantUser[] = []
  for (let page = 1; ; page++) {
    const result = await fetchUsers({ page, per_page: 100, sort: 'first_name' })
    rows.push(...result.items)
    if (!result.items.length || rows.length >= result.total) break
  }
  items.value = rows
  loaded.value = true
}

function refresh(): Promise<void> {
  loading = load().catch(() => { loading = null })
  return loading
}

const people = { items, loaded, refresh }
const tree = computed(() => buildOrgTree(items.value))

export function useOrgTree() {
  if (!loading) void refresh()
  return { people, tree, refresh }
}
