<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { fetchAllBrands } from '@/api/tenant/brands'
import type { ListParams } from '@/api/tenant/geography'
import { fetchProduct, fetchProducts, fetchTherapeuticAreas, type Product } from '@/api/tenant/products'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import { exportToXlsx } from '@/composables/exportXlsx'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { STUDIO_DEFAULT_SORT, useAddedColumn, useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import { today } from '@/views/tenant/users/userDisplay'
import ProductCreatePanel from './ProductCreatePanel.vue'
import ProductReadPanel from './ProductReadPanel.vue'
import ProductThumb from './ProductThumb.vue'
import { PRICE_FIELDS, useProductText } from './productForm'

// Studio › Products: list, reading panel, "Add a product" in 2 steps; editing on the full page.
// ?brand=<id> opens the list filtered on a brand, ?duplicate=<id> opens "Add" pre-filled.
// Mockup: docs/design/studio-mockups/Products.html
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const text = useProductText()
const brands = ref<{ id: number; name: string }[]>([])

const ALL = 'all'
type Filters = { brand: number | null; area: string; strategic: string }

function queryOf(search: string, filters: Filters): ListParams {
  return {
    'filter[q]': search || undefined,
    'filter[brand_id]': filters.brand ?? undefined,
    'filter[therapeutic_area]': filters.area === ALL ? undefined : filters.area,
    'filter[strategic]': filters.strategic === ALL ? undefined : Number(filters.strategic),
  }
}

const initialBrand = route.query.brand ? Number(route.query.brand) : null
const list = useStudioList<Product, Filters>(
  ({ page, perPage, search, sort, filters }) => fetchProducts({ page, per_page: perPage, sort, ...queryOf(search, filters) }),
  { brand: initialBrand, area: ALL, strategic: ALL },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const brandFilter = computed({
  get: () => filters.brand ?? ALL,
  set: value => {
    filters.brand = value === ALL || value == null ? null : Number(value)
    router.replace({ query: { ...route.query, brand: filters.brand ?? undefined } })
  },
})
const brandOptions = computed(() => [
  { value: ALL, label: t('products.filter.allBrands') },
  ...brands.value.map(brand => ({ value: brand.id, label: brand.name })).sort((a, b) => a.label.localeCompare(b.label)),
])
const areas = ref<string[]>([])
async function loadAreas() {
  try {
    areas.value = await fetchTherapeuticAreas()
  }
  catch {
    areas.value = []
  }
}
loadAreas()
const areaOptions = computed(() => [{ value: ALL, label: t('products.filter.allAreas') }, ...areas.value.map(area => ({ value: area, label: area }))])
const strategicOptions = computed(() => [
  { value: ALL, label: t('products.filter.all') },
  { value: '1', label: t('products.yes') },
  { value: '0', label: t('products.no') },
])
const filtered = computed(() => !!(search.value || filters.brand || filters.area !== ALL || filters.strategic !== ALL))

// Panel: a product (reading mode) or "Add a product" (also "Duplicate").
const open = ref(false)
const selected = ref<Product | null>(null)
const adding = ref(false)
const duplicateOf = ref<Product | null>(null)

async function show(row: Product) {
  adding.value = false
  selected.value = row
  open.value = true
  const full = await fetchProduct(row.id)
  if (selected.value?.id === row.id) selected.value = full
}
function add(from: Product | null = null) {
  selected.value = null
  duplicateOf.value = from
  adding.value = true
  open.value = true
}
async function onCreated(product: Product) {
  duplicateOf.value = null
  list.reload()
  loadAreas()
  await show(product)
}

onMounted(async () => {
  brands.value = await fetchAllBrands()
  const id = Number(route.query.duplicate)
  if (!id) return
  router.replace({ query: { ...route.query, duplicate: undefined } })
  try {
    add(await fetchProduct(id))
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
})

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('products.columns.product'), sortKey: 'name' },
  { key: 'brand', label: t('products.columns.brand') },
  { key: 'area', label: t('products.fields.area'), secondary: true },
  { key: 'price', label: t('products.fields.price'), sortKey: 'price', align: 'end' as const },
  { key: 'strategic', label: t('products.list.strategic'), secondary: true },
  { key: 'discountable', label: t('products.list.discountable'), secondary: true },
  { ...added.column, secondary: true },
]

/** Every page of the list, 100 rows at a time, with the free units. */
async function allRows(): Promise<Product[]> {
  const rows: Product[] = []
  for (let pageNumber = 1; ; pageNumber++) {
    const result = await fetchProducts({ page: pageNumber, per_page: 100, sort: sort.value || STUDIO_DEFAULT_SORT, include: 'brand,ugs', ...queryOf(search.value.trim(), filters) })
    rows.push(...result.items)
    if (!result.items.length || rows.length >= result.total) return rows
  }
}

// Export: every product matching the filters (all pages), in the viewer's language.
const exporting = ref(false)
async function exportList() {
  exporting.value = true
  try {
    const rows = await allRows()
    await exportToXlsx(rows.map(product => ({
      [t('products.fields.name')]: product.name,
      [t('products.fields.brand')]: product.brand?.name ?? '',
      [t('products.fields.area')]: product.therapeutic_area ?? '',
      [t('products.fields.perBox')]: product.per_box ?? '',
      [t('products.fields.price')]: product.price == null ? '' : Number(product.price),
      [t('products.fields.vat')]: product.vat == null ? '' : Number(product.vat),
      ...Object.fromEntries(PRICE_FIELDS.map(key => [t(`products.fields.${key}`), product[key] == null ? '' : Number(product[key])])),
      [t('products.fields.strategic')]: text.yesNo(product.strategic),
      [t('products.fields.discountable')]: text.yesNo(product.us_discountable),
      [t('products.fields.ugs')]: (product.ugs ?? []).join(', '),
      [t('studio.list.added')]: product.created_at?.slice(0, 10) ?? '',
    })), `${t('products.title')} ${today()}`, t('products.title'))
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    exporting.value = false
  }
}
</script>

<template>
  <!-- As the mockup (studio-mockups/Products.html): the panel sits beside the whole column (title + list), from the top. -->
  <div class="flex w-full items-start gap-5" :class="auth.can('products.create') && 'max-md:pb-20'">
    <div class="flex min-w-0 flex-1 flex-col gap-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.studio') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('products.title') }}</h1>
        </div>
        <div class="flex gap-2.5">
          <DlButton variant="outline" icon="tabler-file-spreadsheet" :loading="exporting" :disabled="!total" @click="exportList">{{ t('users.export') }}</DlButton>
          <DlButton v-if="auth.can('products.create')" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add()">{{ t('products.add.button') }}</DlButton>
        </div>
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <div class="flex flex-wrap items-center gap-2.5">
          <DlInput
            v-model="search"
            type="search"
            icon="tabler-search"
            :label="t('products.search')"
            :placeholder="t('products.search')"
            hide-label
            class="w-full sm:max-w-xs"
          />
          <DlSelect v-model="brandFilter" :label="t('products.fields.brand')" :options="brandOptions" appearance="filter" />
          <DlSelect v-model="filters.area" :label="t('products.fields.area')" :options="areaOptions" appearance="filter" />
          <DlSelect v-model="filters.strategic" :label="t('products.list.strategic')" :options="strategicOptions" appearance="filter" />
        </div>

        <DlDataList
          v-model:sort="sort"
          :default-sort="STUDIO_DEFAULT_SORT"
          :label="t('products.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :selected-key="selected?.id"
          :loading="loading"
          :compact="open"
          :empty-title="filtered ? t('geo.empty.search') : t('products.empty')"
          @open="show"
        >
          <template #cell-name="{ row }">
            <span class="flex items-center gap-2.5">
              <ProductThumb :src="row.photo?.url" />
              <strong class="font-semibold">{{ row.name }}</strong>
            </span>
          </template>
          <template #cell-brand="{ row }">{{ row.brand?.name ?? '—' }}</template>
          <template #cell-area="{ row }">{{ row.therapeutic_area || '—' }}</template>
          <template #cell-price="{ row }"><span class="whitespace-nowrap tabular-nums">{{ text.money(row.price) }}</span></template>
          <template #cell-strategic="{ row }">
            <DlBadge v-if="row.strategic" size="sm" tone="ink" icon="tabler-check">{{ t('products.yes') }}</DlBadge>
            <span v-else class="text-dl-muted">{{ t('products.no') }}</span>
          </template>
          <template #cell-discountable="{ row }">
            <DlBadge v-if="row.us_discountable" size="sm" tone="ink" icon="tabler-check">{{ t('products.list.applies') }}</DlBadge>
            <span v-else class="text-dl-muted">{{ t('products.no') }}</span>
          </template>
          <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
          <template #card="{ row }">
            <span class="flex items-center gap-3">
              <ProductThumb :src="row.photo?.url" />
              <span class="flex min-w-0 flex-1 flex-col">
                <strong class="truncate font-semibold">{{ row.name }}</strong>
                <span class="truncate text-xs text-dl-muted">{{ row.brand?.name ?? '—' }} · {{ text.money(row.price) }}</span>
              </span>
            </span>
          </template>
        </DlDataList>

        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>
    </div>

    <ProductCreatePanel v-if="adding" v-model:open="open" :from="duplicateOf" @created="onCreated" />
    <ProductReadPanel v-else-if="selected" v-model:open="open" :product="selected" />

    <!-- Phone: "Add" sits at the bottom, in reach of the thumb -->
    <div v-if="auth.can('products.create')" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
      <DlButton variant="primary" size="lg" icon="tabler-plus" block @click="add()">{{ t('products.add.button') }}</DlButton>
    </div>
  </div>
</template>
