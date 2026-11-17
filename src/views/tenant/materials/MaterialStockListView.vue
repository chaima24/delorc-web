<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { fetchMaterialStock, fetchMaterialStocks, type MaterialStock } from '@/api/tenant/materials'
import DlBadge from '@/components/DlBadge.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useCampaignText } from '@/views/tenant/campaigns/campaignDisplay'

// Engager › Matériels (docs/api/materials.md): the stock lines the viewer may see. A rep sees their own, a manager the
// people below, marketing every one. Given, handed out, left, per material and campaign. Mockup frames 7 and 8.
const { t, n } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const text = useCampaignText()

const state = ref('current')
const type = ref('visit')
const page = ref(1)
const perPage = ref(25)
const rows = ref<MaterialStock[]>([])
const total = ref(0)
const loading = ref(true)
async function load() {
  loading.value = true
  try {
    const answer = await fetchMaterialStocks({ page: page.value, per_page: perPage.value, 'filter[state]': state.value, 'filter[type]': type.value })
    rows.value = answer.items
    total.value = answer.total
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    loading.value = false
  }
}
watch([state, type, page, perPage], load, { immediate: true })
watch([state, type], () => { page.value = 1 })

/** Everyone sees their own line; a manager or marketing sees others too: the person column then shows. */
const others = computed(() => rows.value.some(row => row.user.id !== auth.user?.id))
const stateItems = computed(() => ['current', 'past'].map(value => ({ value, label: t(`materials.stocks.${value}`) })))
const typeItems = computed(() => ['visit', 'event'].map(value => ({ value, label: t(`materials.type.${value}`) })))
const columns = computed(() => [
  ...(others.value ? [{ key: 'person', label: t('materials.columns.person') }] : []),
  { key: 'materiel', label: t('materials.columns.materiel') },
  { key: 'campaign', label: t('materials.columns.campaign') },
  { key: 'period', label: t('materials.columns.period'), secondary: true },
  { key: 'given', label: t('materials.columns.given'), align: 'end' as const },
  { key: 'handed_out', label: t('materials.columns.handedOut'), align: 'end' as const },
  { key: 'left', label: t('materials.columns.left'), align: 'end' as const },
  { key: 'progress', label: t('materials.columns.progress') },
])
// A row opens its panel beside the list: the line and the visits it was handed out in.
const open = ref(false)
const picked = ref<MaterialStock | null>(null)
const detail = ref<MaterialStock | null>(null)
async function show(row: MaterialStock) {
  picked.value = row
  detail.value = null
  open.value = true
  try {
    detail.value = await fetchMaterialStock(row.id)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
const panelFigures = computed(() => {
  const row = detail.value ?? picked.value
  return row ? [
    { label: t('materials.columns.given'), value: n(row.quantity) },
    { label: t('materials.columns.carried'), value: row.carried ? `+${n(row.carried)}` : '—' },
    { label: t('materials.columns.handedOut'), value: n(row.handed_out) },
    { label: t('materials.columns.left'), value: n(row.left) },
  ] : []
})

const share = (row: MaterialStock) => {
  const all = row.quantity + row.carried
  return all ? (row.handed_out / all) * 100 : 0
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <div class="flex flex-col gap-1.5">
      <span class="text-sm text-dl-muted">{{ t('nav.workspaces.engage') }}</span>
      <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('materials.stocks.title') }}</h1>
      <p class="text-[13px] text-dl-muted">{{ t('materials.stocks.subtitle') }}</p>
    </div>
    <div class="flex flex-wrap items-center gap-2.5">
      <DlSegmented v-model="state" :label="t('materials.columns.period')" :items="stateItems" />
      <DlSegmented v-model="type" :label="t('materials.columns.type')" :items="typeItems" />
    </div>
    <!-- The panel sits beside the table, its top level with the table's. -->
    <div class="flex items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
      <DlDataList :label="t('materials.stocks.title')" :columns="columns" :rows="rows" :row-key="row => row.id" :loading="loading"
        :selected-key="open ? picked?.id : undefined" :compact="open"
        :empty-title="t('materials.stocks.emptyTitle')" :empty-text="t('materials.stocks.emptyText')" @open="show">
        <template #cell-person="{ row }"><strong class="font-semibold">{{ row.user.full_name }}</strong></template>
        <template #cell-materiel="{ row }"><strong class="font-semibold">{{ row.materiel.name }}</strong> <span class="text-dl-muted">· {{ row.brand.name }}</span></template>
        <template #cell-campaign="{ row }">{{ row.campaign.name }}</template>
        <template #cell-period="{ row }">
          <span class="whitespace-nowrap text-dl-muted">{{ text.period(row.start_date, row.end_date) }}</span>
          <DlBadge v-if="row.leftover === 'stays' && row.end_date < new Date().toISOString().slice(0, 10) && row.left" size="sm" class="ms-1">{{ t('materials.stocks.stillUsable') }}</DlBadge>
        </template>
        <template #cell-given="{ row }">
          <span class="tabular-nums">{{ n(row.quantity) }}</span>
          <span v-if="row.carried" class="ms-1 rounded-full bg-dl-cobalt/10 px-2 py-0.5 text-[11.5px] font-bold text-dl-cobalt">+{{ n(row.carried) }}</span>
        </template>
        <template #cell-handed_out="{ row }"><span class="tabular-nums">{{ n(row.handed_out) }}</span></template>
        <template #cell-left="{ row }"><strong class="tabular-nums">{{ n(row.left) }}</strong></template>
        <template #cell-progress="{ row }"><span class="flex h-2 w-24 overflow-hidden rounded-full bg-dl-line-soft"><span class="h-full bg-dl-teal" :style="{ width: `${share(row)}%` }" /></span></template>
        <template #card="{ row }">
          <strong class="block font-semibold">{{ row.materiel.name }} · {{ row.brand.name }}</strong>
          <span class="text-xs text-dl-muted">{{ [others ? row.user.full_name : null, row.campaign.name, t('materials.stocks.cardLeft', { count: n(row.left) })].filter(Boolean).join(' · ') }}</span>
        </template>
      </DlDataList>
      <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      <p class="text-xs text-dl-muted">{{ t('materials.stocks.note') }}</p>
    </div>

  <DlRecordPanel v-if="picked" v-model:open="open" :title="`${picked.materiel.name} · ${picked.brand.name}`"
    :description="[others ? picked.user.full_name : null, picked.campaign.name, text.period(picked.start_date, picked.end_date)].filter(Boolean).join(' · ')">
    <div class="flex flex-col gap-4">
      <dl class="grid grid-cols-4 gap-2">
        <div v-for="figure in panelFigures" :key="figure.label" class="flex flex-col gap-0.5 rounded-2xl bg-dl-mist px-3 py-2.5">
          <dt class="text-[11.5px] text-dl-muted">{{ figure.label }}</dt>
          <dd class="font-display text-[20px] font-extrabold leading-none">{{ figure.value }}</dd>
        </div>
      </dl>
      <section class="flex flex-col gap-2">
        <h3 class="text-sm font-semibold">{{ t('materials.stocks.visits') }}</h3>
        <DlSkeleton v-if="!detail" class="h-24 rounded-2xl" />
        <p v-else-if="!detail.visits?.length" class="text-[13px] text-dl-muted">{{ t('materials.stocks.noVisits') }}</p>
        <ul v-else class="flex flex-col">
          <li v-for="visit in detail.visits" :key="visit.visit_id" class="border-b border-dl-line-soft last:border-0">
            <RouterLink :to="{ name: 'tenant-visit-detail', params: { id: visit.visit_id } }" class="flex items-center gap-3 py-2.5 text-[13.5px] text-dl-fg no-underline hover:text-dl-cobalt">
              <span class="w-24 shrink-0 text-dl-muted">{{ text.date(visit.date) }}</span>
              <strong class="min-w-0 flex-1 truncate font-semibold">{{ visit.target ?? '—' }}</strong>
              <span class="font-bold tabular-nums">{{ n(visit.quantity) }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>
      <p v-if="picked.carried_out" class="text-xs text-dl-muted">{{ t('materials.page.carriedOut', { count: n(picked.carried_out) }) }}</p>
    </div>
  </DlRecordPanel>
    </div>
  </div>
</template>
