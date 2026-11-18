<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { fetchPackCommande, fetchPackCommandes, type PackCommande } from '@/api/tenant/orders'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { useAuthStore } from '@/stores/auth'
import { useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import PackCommandeAddPanel from './PackCommandeAddPanel.vue'
import PackCommandeReadPanel from './PackCommandeReadPanel.vue'
import { useOrdersText } from './ordersDisplay'

// Commandes › Packs de commande: search, filters by buyer type and by state, every column sorts. A click opens the
// reading panel; editing is on the pack's page. Mockup: docs/design/orders-mockups/OrdersSetup.html (frames 6–8)
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const text = useOrdersText()
const canAdd = computed(() => auth.can('orders-setup.create'))

const ALL = 'all'
const list = useStudioList<PackCommande, { type: string; active: string }>(
  ({ page, perPage, search, sort, filters }) => fetchPackCommandes({
    page,
    per_page: perPage,
    sort,
    'filter[search]': search || undefined,
    'filter[client_type]': filters.type === ALL ? undefined : filters.type,
    'filter[is_active]': filters.active === ALL ? undefined : filters.active,
  }),
  { type: ALL, active: ALL },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const typeItems = computed(() => [ALL, 'pharmacy', 'wholesaler'].map(value => ({ value, label: value === ALL ? t('orders.packCommandes.filter.all') : text.clientType(value) })))
const activeItems = computed(() => [
  { value: ALL, label: t('orders.packCommandes.filter.all') },
  { value: '1', label: t('orders.packCommandes.filter.active') },
  { value: '0', label: t('orders.packCommandes.filter.off') },
])
const filtering = computed(() => !!search.value || filters.type !== ALL || filters.active !== ALL)

const columns = computed(() => [
  { key: 'name', label: t('orders.packCommandes.columns.name'), sortKey: 'name' },
  { key: 'client_type', label: t('orders.packCommandes.columns.for'), sortKey: 'client_type' },
  { key: 'products', label: t('orders.packCommandes.columns.products'), sortKey: 'products_count' },
  { key: 'description', label: t('orders.packCommandes.fields.description'), secondary: true },
  { key: 'is_active', label: t('orders.packCommandes.columns.active'), sortKey: 'is_active' },
  { key: 'created_at', label: t('studio.list.added'), sortKey: 'created_at', secondary: true },
])

const open = ref(false)
const adding = ref(false)
const selected = ref<PackCommande | null>(null)
async function show(row: PackCommande) {
  adding.value = false
  selected.value = row
  open.value = true
  const full = await fetchPackCommande(row.id)
  if (selected.value?.id === row.id) selected.value = full
}
function add() {
  selected.value = null
  adding.value = true
  open.value = true
}
const openPage = (row: PackCommande) => router.push({ name: 'tenant-pack-commande', params: { id: row.id } })
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5" :class="canAdd && 'max-md:pb-20'">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.orders') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('orders.packCommandes.title') }}</h1>
          <p class="text-[13px] text-dl-muted">{{ t('orders.packCommandes.subtitle') }}</p>
        </div>
        <DlButton v-if="canAdd" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add">{{ t('orders.packCommandes.add.button') }}</DlButton>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <div class="w-64 max-md:w-full"><DlInput v-model="search" :label="t('orders.packCommandes.filter.search')" :placeholder="t('orders.packCommandes.filter.search')" icon="tabler-search" hide-label /></div>
        <DlSegmented v-model="filters.type" :label="t('orders.packCommandes.columns.for')" :items="typeItems" />
        <DlSegmented v-model="filters.active" :label="t('orders.packCommandes.columns.active')" :items="activeItems" />
        <DlButton v-if="filtering" variant="ghost" icon="tabler-x" @click="search = ''; filters.type = ALL; filters.active = ALL">{{ t('common.actions.resetFilters') }}</DlButton>
      </div>

      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          v-model:sort="sort"
          default-sort="-created_at"
          :label="t('orders.packCommandes.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :selected-key="selected?.id"
          :loading="loading"
          :compact="open"
          :empty-title="filtering ? t('geo.empty.search') : t('orders.packCommandes.emptyTitle')"
          :empty-text="filtering ? undefined : t('orders.packCommandes.emptyText')"
          @open="show"
        >
          <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
          <template #cell-client_type="{ row }"><DlBadge size="sm">{{ text.clientType(row.client_type) }}</DlBadge></template>
          <template #cell-products="{ row }"><span class="tabular-nums">{{ row.products_count ?? 0 }}</span></template>
          <template #cell-description="{ row }"><span class="text-dl-muted">{{ row.description || '—' }}</span></template>
          <template #cell-is_active="{ row }">
            <DlBadge v-if="row.is_active" size="sm" tone="ink" icon="tabler-check">{{ t('orders.yes') }}</DlBadge>
            <span v-else class="text-dl-muted">{{ t('orders.no') }}</span>
          </template>
          <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ text.date(row.created_at) }}</span></template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.name }}</strong>
            <span class="text-xs text-dl-muted">{{ [text.clientType(row.client_type), t('orders.packCommandes.read.productsCount', row.products_count ?? 0)].join(' · ') }}</span>
          </template>
        </DlDataList>
        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>

      <div v-if="canAdd" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
        <DlButton variant="primary" icon="tabler-plus" block @click="add">{{ t('orders.packCommandes.add.button') }}</DlButton>
      </div>
    </div>

    <PackCommandeAddPanel v-if="adding" v-model:open="open" @created="openPage" />
    <PackCommandeReadPanel v-else-if="selected" v-model:open="open" :pack="selected" />
  </div>
</template>
