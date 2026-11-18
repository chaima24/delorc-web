import { computed, ref } from 'vue'
import { fetchProducts, type Product } from '@/api/tenant/products'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'

/** Every product of the lab with its free-unit options, for a pack's lines; reloaded on coming back to the tab. */
export function usePackProducts() {
  const products = ref<Product[]>([])
  onMountedAndFocus(async () => {
    const rows: Product[] = []
    for (let page = 1; ; page++) {
      const { items, total } = await fetchProducts({ page, per_page: 100, include: 'ugs', sort: 'name' })
      rows.push(...items)
      if (!items.length || rows.length >= total) break
    }
    products.value = rows
  })
  const items = computed(() => products.value.map(product => ({ value: product.id, label: product.name })))
  const options = (id: number) => products.value.find(product => product.id === id)?.ug_options ?? []

  return { items, options }
}
