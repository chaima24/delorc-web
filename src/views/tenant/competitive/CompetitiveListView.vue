<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { fetchAllBrands } from '@/api/tenant/brands'
import {
  COMPETITIVE_LEVELS, COMPETITIVE_STATUSES, fetchCompetitiveForm, fetchCompetitiveInformation, fetchCompetitiveInformations,
  type CompetitiveForm, type CompetitiveInformation, type CompetitiveStatus,
} from '@/api/tenant/competitive'
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
import CompetitiveAddPanel from './CompetitiveAddPanel.vue'
import CompetitiveReadPanel from './CompetitiveReadPanel.vue'
import { STATUS_TONE, useCompetitiveText } from './competitiveDisplay'

// Veille concurrentielle › Notes: the notes the viewer sees (their own, drafts included; the sent notes of the people
// below them; every sent note for marketing). Filters by state (with counts), our brand, urgency, dates; every column
// sorts. A click opens the reading panel beside the list; « Nouvelle note » the add panel. Mockup frames 1, 2.
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const text = useCompetitiveText()
const canAdd = computed(() => auth.can('competitive-informations.create'))

const ALL = 'all'
const NONE = 0
const counts = ref<Partial<Record<CompetitiveStatus, number>>>({})
const list = useStudioList<CompetitiveInformation, { from: string; to: string; brand: number | string | null; urgency: string; status: string }>(
  async ({ page, perPage, search, sort, filters }) => {
    const answer = await fetchCompetitiveInformations({
      page,
      per_page: perPage,
      sort,
      'filter[search]': search || undefined,
      'filter[seen_from]': filters.from || undefined,
      'filter[seen_to]': filters.to || undefined,
      'filter[brand_id]': filters.brand || undefined,
      'filter[urgency_level]': filters.urgency === ALL ? undefined : filters.urgency,
      'filter[status]': filters.status === ALL ? undefined : filters.status,
    })
    counts.value = answer.counts
    return answer
  },
  { from: '', to: '', brand: NONE, urgency: ALL, status: ALL },
  '-seen_on',
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

// The form's lists, reloaded on open and when the tab comes back.
const brands = ref<{ value: number; label: string }[]>([])
const lists = ref<CompetitiveForm | null>(null)
onMountedAndFocus(async () => {
  brands.value = (await fetchAllBrands()).map(brand => ({ value: brand.id, label: brand.name }))
  if (canAdd.value) lists.value = await fetchCompetitiveForm()
})
const brandFilter = computed(() => [{ value: NONE, label: t('competitive.list.allBrands') }, ...brands.value])
const urgencyFilter = computed(() => [{ value: ALL, label: t('competitive.list.allUrgencies') }, ...COMPETITIVE_LEVELS.map(level => ({ value: level, label: text.level(level) }))])
const statusItems = computed(() => {
  const all = Object.values(counts.value).reduce((a, b) => a + (b ?? 0), 0)
  return [{ value: ALL, label: `${t('competitive.list.all')} · ${all}` }, ...COMPETITIVE_STATUSES.map(status => ({ value: status, label: `${text.status(status)} · ${counts.value[status] ?? 0}` }))]
})
const filtering = computed(() => !!search.value || !!filters.from || !!filters.to || !!filters.brand || filters.urgency !== ALL || filters.status !== ALL)
function reset() {
  search.value = ''
  Object.assign(filters, { from: '', to: '', brand: NONE, urgency: ALL, status: ALL })
}

// The author column only for someone who sees other people's notes.
const seesOthers = computed(() => items.value.some(row => row.user?.id !== auth.user?.id))
const columns = computed(() => [
  { key: 'number', label: t('competitive.fields.number'), sortKey: 'number' },
  { key: 'seen_on', label: t('competitive.fields.seenOn'), sortKey: 'seen_on' },
  { key: 'laboratory', label: t('competitive.fields.laboratory'), sortKey: 'laboratory' },
  { key: 'product', label: t('competitive.fields.product'), sortKey: 'product' },
  { key: 'brand', label: t('competitive.fields.brand'), sortKey: 'brand', secondary: true },
  ...(seesOthers.value ? [{ key: 'user', label: t('competitive.fields.author'), sortKey: 'user', secondary: true }] : []),
  { key: 'urgency_level', label: t('competitive.fields.urgency'), sortKey: 'urgency_level', secondary: true },
  { key: 'status', label: t('competitive.fields.status'), sortKey: 'status' },
])

const open = ref(false)
const adding = ref(false)
const selected = ref<CompetitiveInformation | null>(null)
async function show(row: CompetitiveInformation) {
  adding.value = false
  selected.value = row
  open.value = true
  const full = await fetchCompetitiveInformation(row.id)
  if (selected.value?.id === row.id) selected.value = full
}
function add() {
  open.value = false
  selected.value = null
  adding.value = true
}
function created(note: CompetitiveInformation) {
  adding.value = false
  router.push({ name: 'tenant-competitive-information', params: { id: note.id } })
}
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5" :class="canAdd && 'max-md:pb-20'">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.competitive') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('competitive.list.title') }}</h1>
          <p class="text-[13px] text-dl-muted">{{ t('competitive.list.subtitle') }}</p>
        </div>
        <DlButton v-if="canAdd" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add">{{ t('competitive.list.add') }}</DlButton>
      </div>

      <DlSegmented v-model="filters.status" :label="t('competitive.fields.status')" :items="statusItems" />
      <div class="flex flex-wrap items-end gap-2.5">
        <div class="w-60 max-md:w-full"><DlInput v-model="search" :label="t('competitive.list.search')" :placeholder="t('competitive.list.search')" icon="tabler-search" hide-label /></div>
        <DlSelect v-model="filters.brand" :label="t('competitive.fields.brand')" :options="brandFilter" appearance="filter" />
        <DlSelect v-model="filters.urgency" :label="t('competitive.fields.urgency')" :options="urgencyFilter" appearance="filter" />
        <div class="w-64 max-md:w-full"><DlDateRangePicker v-model:start="filters.from" v-model:end="filters.to" :label="t('common.dates.period')" hide-label clearable /></div>
        <DlButton v-if="filtering" variant="ghost" icon="tabler-x" @click="reset">{{ t('common.actions.resetFilters') }}</DlButton>
      </div>

      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          v-model:sort="sort"
          default-sort="-seen_on"
          :label="t('competitive.list.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :selected-key="selected?.id"
          :loading="loading"
          :compact="open || adding"
          :empty-title="filtering ? t('geo.empty.search') : t('competitive.list.emptyTitle')"
          :empty-text="filtering ? undefined : t('competitive.list.emptyText')"
          @open="show"
        >
          <template #cell-number="{ row }"><strong class="font-semibold">{{ row.number }}</strong></template>
          <template #cell-seen_on="{ row }"><span class="whitespace-nowrap">{{ text.date(row.seen_on) }}</span></template>
          <template #cell-brand="{ row }">{{ row.brand?.name ?? '—' }}</template>
          <template #cell-user="{ row }">{{ row.user?.full_name }}</template>
          <template #cell-urgency_level="{ row }">{{ text.level(row.urgency_level) }}</template>
          <template #cell-status="{ row }"><DlBadge size="sm" :tone="STATUS_TONE[row.status]" dot>{{ text.status(row.status) }}</DlBadge></template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.number }} · {{ row.laboratory }} · {{ row.product }}</strong>
            <span class="text-xs text-dl-muted">{{ [text.date(row.seen_on), row.user?.full_name, text.status(row.status)].join(' · ') }}</span>
          </template>
        </DlDataList>
        <div class="flex flex-wrap items-center justify-end gap-3">
          <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
        </div>
      </div>

      <div v-if="canAdd" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
        <DlButton variant="primary" icon="tabler-plus" block @click="add">{{ t('competitive.list.add') }}</DlButton>
      </div>
    </div>

    <CompetitiveReadPanel v-if="selected" v-model:open="open" :note="selected" />
    <CompetitiveAddPanel v-if="adding" v-model:open="adding" :lists="lists" :brands="brands" @created="created" />
  </div>
</template>
