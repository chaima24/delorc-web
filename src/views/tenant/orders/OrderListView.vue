<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchOrder, fetchOrderForm, fetchOrders, type Order } from '@/api/tenant/orders'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlDateRangePicker from '@/components/DlDateRangePicker.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useAuthStore } from '@/stores/auth'
import { useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import OrderHcpPicker from './OrderHcpPicker.vue'
import OrderReadPanel from './OrderReadPanel.vue'
import { SUPPLIER_TYPES, useOrdersText } from './ordersDisplay'

// Commandes › Bons de commande: the orders of the people the viewer sees. Search, period, supplier, rep, pack or
// ordinary; every column sorts. A click opens the reading panel. Mockup: docs/design/orders-mockups/Orders.html (1, 2)
const { t } = useI18n()
const auth = useAuthStore()
const text = useOrdersText()
const canAdd = computed(() => auth.can('orders.create'))

const ALL = 'all'
const sum = ref(0)
const list = useStudioList<Order, { from: string; to: string; supplier: number | null; user: number; type: string }>(
  async ({ page, perPage, search, sort, filters }) => {
    const answer = await fetchOrders({
      page,
      per_page: perPage,
      sort,
      'filter[search]': search || undefined,
      'filter[ordered_at_from]': filters.from || undefined,
      'filter[ordered_at_to]': filters.to || undefined,
      'filter[supplier_hcp_id]': filters.supplier ?? undefined,
      'filter[user_id]': filters.user || undefined,
      'filter[type]': filters.type === ALL ? undefined : filters.type,
    })
    sum.value = answer.sum
    return answer
  },
  { from: '', to: '', supplier: null, user: 0, type: ALL },
  '-ordered_at',
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

// « Délégué »: the viewer and the people below them.
const people = ref<{ value: number; label: string }[]>([])
onMountedAndFocus(async () => {
  if (!auth.can('orders.create')) return
  const form = await fetchOrderForm()
  people.value = [{ value: 0, label: t('orders.list.everyone') }, ...form.people.map(person => ({ value: person.id, label: person.full_name }))]
})
const typeItems = computed(() => [ALL, 'pack', 'ordinary'].map(value => ({ value, label: t(`orders.list.type.${value}`) })))
const filtering = computed(() => !!search.value || !!filters.from || !!filters.to || filters.supplier != null || !!filters.user || filters.type !== ALL)
function reset() {
  search.value = ''
  Object.assign(filters, { from: '', to: '', supplier: null, user: 0, type: ALL })
}

const columns = computed(() => [
  { key: 'number', label: t('orders.fields.number'), sortKey: 'number' },
  { key: 'ordered_at', label: t('orders.fields.date'), sortKey: 'ordered_at' },
  { key: 'client', label: t('orders.fields.client'), sortKey: 'client' },
  { key: 'supplier', label: t('orders.fields.supplier'), sortKey: 'supplier', secondary: true },
  { key: 'user', label: t('orders.fields.user'), secondary: true },
  { key: 'total_ttc', label: t('orders.form.totalTtc'), sortKey: 'total_ttc', align: 'end' as const },
  { key: 'source', label: t('orders.list.source'), secondary: true },
  { key: 'type', label: t('orders.list.typeColumn'), secondary: true },
])

const open = ref(false)
const selected = ref<Order | null>(null)
async function show(row: Order) {
  selected.value = row
  open.value = true
  const full = await fetchOrder(row.id)
  if (selected.value?.id === row.id) selected.value = full
}
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5" :class="canAdd && 'max-md:pb-20'">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.orders') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('orders.list.title') }}</h1>
          <p class="text-[13px] text-dl-muted">{{ t('orders.list.subtitle') }}</p>
        </div>
        <DlButton v-if="canAdd" variant="primary" icon="tabler-plus" class="max-md:hidden" :to="{ name: 'tenant-order-new' }">{{ t('orders.list.add') }}</DlButton>
      </div>

      <div class="flex flex-wrap items-end gap-2.5">
        <div class="w-60 max-md:w-full"><DlInput v-model="search" :label="t('orders.list.search')" :placeholder="t('orders.list.search')" icon="tabler-search" hide-label /></div>
        <div class="w-64 max-md:w-full"><DlDateRangePicker v-model:start="filters.from" v-model:end="filters.to" :label="t('common.dates.period')" hide-label clearable /></div>
        <div class="w-56 max-md:w-full"><OrderHcpPicker v-model="filters.supplier" :label="t('orders.fields.supplier')" :types="SUPPLIER_TYPES" /></div>
        <DlSelect v-if="people.length > 2" v-model="filters.user" :label="t('orders.fields.user')" :options="people" appearance="filter" />
        <DlSegmented v-model="filters.type" :label="t('orders.list.typeColumn')" :items="typeItems" />
        <DlButton v-if="filtering" variant="ghost" icon="tabler-x" @click="reset">{{ t('common.actions.resetFilters') }}</DlButton>
      </div>

      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          v-model:sort="sort"
          default-sort="-ordered_at"
          :label="t('orders.list.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :selected-key="selected?.id"
          :loading="loading"
          :compact="open"
          :empty-title="filtering ? t('geo.empty.search') : t('orders.list.emptyTitle')"
          :empty-text="filtering ? undefined : t('orders.list.emptyText')"
          @open="show"
        >
          <template #cell-number="{ row }"><strong class="font-semibold">{{ row.number }}</strong></template>
          <template #cell-ordered_at="{ row }"><span class="whitespace-nowrap">{{ text.date(row.ordered_at) }}</span></template>
          <template #cell-client="{ row }">{{ row.client?.name }}</template>
          <template #cell-supplier="{ row }">{{ row.supplier?.name }}</template>
          <template #cell-user="{ row }">{{ row.user?.full_name }}</template>
          <template #cell-total_ttc="{ row }"><span class="whitespace-nowrap tabular-nums">{{ text.amount(row.total_ttc) }}</span></template>
          <template #cell-source="{ row }"><DlBadge v-if="row.visit" size="sm">{{ t('orders.list.fromVisit') }}</DlBadge><span v-else class="text-dl-muted">—</span></template>
          <template #cell-type="{ row }"><DlBadge size="sm" :tone="row.pack_commande ? 'info' : 'neutral'">{{ row.pack_commande ? t('orders.list.type.pack') : t('orders.list.type.ordinary') }}</DlBadge></template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.number }} · {{ row.client?.name }}</strong>
            <span class="text-xs text-dl-muted">{{ [text.date(row.ordered_at), row.supplier?.name, text.amount(row.total_ttc)].join(' · ') }}</span>
          </template>
        </DlDataList>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="text-[13px] text-dl-muted">{{ t('orders.list.sum', { count: total, amount: text.amount(sum) }, total) }}</span>
          <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
        </div>
      </div>

      <div v-if="canAdd" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
        <DlButton variant="primary" icon="tabler-plus" block :to="{ name: 'tenant-order-new' }">{{ t('orders.list.add') }}</DlButton>
      </div>
    </div>

    <OrderReadPanel v-if="selected" v-model:open="open" :order="selected" />
  </div>
</template>
