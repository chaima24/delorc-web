<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { fetchPack, fetchPacks, type Pack } from '@/api/tenant/orders'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { useAuthStore } from '@/stores/auth'
import { useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import PackAddPanel from './PackAddPanel.vue'
import PackReadPanel from './PackReadPanel.vue'
import { PACK_TONE, useOrdersText } from './ordersDisplay'

// Commandes › Offres commerciales: search, state filter, every column sorts. A click opens the reading panel beside the
// list; editing is on the offer's page. Mockup: docs/design/orders-mockups/OrdersSetup.html (frames 1–3)
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const text = useOrdersText()
const canAdd = computed(() => auth.can('orders-setup.create'))

const ALL = 'all'
const list = useStudioList<Pack, { state: string | null }>(
  ({ page, perPage, search, sort, filters }) => fetchPacks({
    page,
    per_page: perPage,
    sort,
    'filter[search]': search || undefined,
    'filter[state]': filters.state ?? undefined,
  }),
  { state: null },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const state = computed({
  get: () => filters.state ?? ALL,
  set: value => { filters.state = value === ALL ? null : value },
})
const stateItems = computed(() => [ALL, 'current', 'upcoming', 'ended', 'off'].map(value => ({ value, label: t(`orders.packs.filter.${value}`) })))
const filtering = computed(() => !!search.value || filters.state != null)

const columns = computed(() => [
  { key: 'name', label: t('orders.packs.columns.name'), sortKey: 'name' },
  { key: 'start_date', label: t('orders.packs.columns.dates'), sortKey: 'start_date' },
  { key: 'brackets', label: t('orders.packs.columns.brackets'), sortKey: 'discount_packs_count', secondary: true },
  { key: 'discounts', label: t('orders.packs.columns.discounts'), secondary: true },
  { key: 'is_active', label: t('orders.packs.columns.active'), sortKey: 'is_active' },
  { key: 'state', label: t('orders.packs.columns.state') },
  { key: 'created_at', label: t('studio.list.added'), sortKey: 'created_at', secondary: true },
])
const discounts = (row: Pack) => (row.discount_min == null ? '—' : `${text.percent(row.discount_min)} → ${text.percent(row.discount_max)}`)

// Panel: an offer (reading) or "Ajouter une offre".
const open = ref(false)
const adding = ref(false)
const selected = ref<Pack | null>(null)
async function show(row: Pack) {
  adding.value = false
  selected.value = row
  open.value = true
  const full = await fetchPack(row.id)
  if (selected.value?.id === row.id) selected.value = full
}
function add() {
  selected.value = null
  adding.value = true
  open.value = true
}
const openPage = (row: Pack) => router.push({ name: 'tenant-pack', params: { id: row.id } })
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5" :class="canAdd && 'max-md:pb-20'">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.orders') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('orders.packs.title') }}</h1>
          <p class="text-[13px] text-dl-muted">{{ t('orders.packs.subtitle') }}</p>
        </div>
        <DlButton v-if="canAdd" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add">{{ t('orders.packs.add.button') }}</DlButton>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <div class="w-64 max-md:w-full"><DlInput v-model="search" :label="t('orders.packs.filter.search')" :placeholder="t('orders.packs.filter.search')" icon="tabler-search" hide-label /></div>
        <DlSegmented v-model="state" :label="t('orders.packs.columns.state')" :items="stateItems" />
        <DlButton v-if="filtering" variant="ghost" icon="tabler-x" @click="search = ''; filters.state = null">{{ t('common.actions.resetFilters') }}</DlButton>
      </div>

      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          v-model:sort="sort"
          default-sort="-start_date"
          :label="t('orders.packs.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :selected-key="selected?.id"
          :loading="loading"
          :compact="open"
          :empty-title="filtering ? t('geo.empty.search') : t('orders.packs.emptyTitle')"
          :empty-text="filtering ? undefined : t('orders.packs.emptyText')"
          @open="show"
        >
          <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
          <template #cell-start_date="{ row }"><span class="whitespace-nowrap">{{ text.period(row.start_date, row.end_date) }}</span></template>
          <template #cell-brackets="{ row }"><span class="tabular-nums">{{ row.discount_packs_count ?? 0 }}</span></template>
          <template #cell-discounts="{ row }"><span class="whitespace-nowrap tabular-nums">{{ discounts(row) }}</span></template>
          <template #cell-is_active="{ row }">
            <DlBadge v-if="row.is_active" size="sm" tone="ink" icon="tabler-check">{{ t('orders.yes') }}</DlBadge>
            <span v-else class="text-dl-muted">{{ t('orders.no') }}</span>
          </template>
          <template #cell-state="{ row }"><DlBadge size="sm" :tone="PACK_TONE[row.state]" dot>{{ text.state(row.state) }}</DlBadge></template>
          <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ text.date(row.created_at) }}</span></template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.name }}</strong>
            <span class="text-xs text-dl-muted">{{ [text.period(row.start_date, row.end_date), text.state(row.state)].join(' · ') }}</span>
          </template>
        </DlDataList>
        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>

      <div v-if="canAdd" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
        <DlButton variant="primary" icon="tabler-plus" block @click="add">{{ t('orders.packs.add.button') }}</DlButton>
      </div>
    </div>

    <PackAddPanel v-if="adding" v-model:open="open" @created="openPage" />
    <PackReadPanel v-else-if="selected" v-model:open="open" :pack="selected" />
  </div>
</template>
