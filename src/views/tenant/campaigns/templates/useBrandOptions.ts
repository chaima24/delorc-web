import { ref } from 'vue'
import { fetchBrands } from '@/api/tenant/brands'
import { refreshOnFocus } from '@/composables/refreshOnFocus'

// The lab's brands for a template's brand (form and filter): loaded when a page opens and on coming back to the tab.
const brands = ref<{ value: number; label: string }[]>([])
const load = () => fetchBrands({ page: 1, per_page: 100, sort: 'name' })
  .then(page => { brands.value = page.items.map(row => ({ value: row.id, label: row.name })) })
  .catch(() => {})

export function useBrandOptions() {
  if (!brands.value.length) load()
  refreshOnFocus(load)
  return { brands }
}
