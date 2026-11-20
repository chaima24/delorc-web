<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { fetchAllBrands } from '@/api/tenant/brands'
import { fetchSurvey, fetchSurveys, SURVEY_STATUSES, SURVEY_TARGETS, type Survey, type SurveyStatus } from '@/api/tenant/surveys'
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
import SurveyAddPanel from './SurveyAddPanel.vue'
import SurveyReadPanel from './SurveyReadPanel.vue'
import { STATUS_TONE, useSurveyText } from './surveyDisplay'

// Enquêtes › Enquêtes: every survey of the lab (marketing). Filters by state (with counts), target, brand and period;
// every column sorts. A click opens the reading panel beside the list; « Nouvelle enquête » the add panel.
// Mockup: surveys-mockups/Surveys.html frames 1, 2.
const { t, n } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const text = useSurveyText()
const canAdd = computed(() => auth.can('surveys.create'))

const ALL = 'all'
const NONE = 0
const counts = ref<Partial<Record<SurveyStatus, number>>>({})
const list = useStudioList<Survey, { from: string; to: string; brand: number | string | null; target: string; status: string }>(
  async ({ page, perPage, search, sort, filters }) => {
    const answer = await fetchSurveys({
      page,
      per_page: perPage,
      sort,
      'filter[search]': search || undefined,
      'filter[from]': filters.from || undefined,
      'filter[to]': filters.to || undefined,
      'filter[brand_id]': filters.brand || undefined,
      'filter[target_type]': filters.target === ALL ? undefined : filters.target,
      'filter[status]': filters.status === ALL ? undefined : filters.status,
    })
    counts.value = answer.counts
    return answer
  },
  { from: '', to: '', brand: NONE, target: ALL, status: ALL },
  '-created_at',
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

// Brands for the filter and the add panel, reloaded on open and when the tab comes back.
const brands = ref<{ value: number; label: string }[]>([])
onMountedAndFocus(async () => {
  brands.value = (await fetchAllBrands()).map(brand => ({ value: brand.id, label: brand.name }))
})
const brandFilter = computed(() => [{ value: NONE, label: t('surveys.list.allBrands') }, ...brands.value])
const targetFilter = computed(() => [{ value: ALL, label: t('surveys.list.allTargets') }, ...SURVEY_TARGETS.map(target => ({ value: target, label: text.target(target) }))])
const statusItems = computed(() => {
  const all = Object.values(counts.value).reduce((a, b) => a + (b ?? 0), 0)
  return [{ value: ALL, label: `${t('surveys.list.all')} · ${all}` }, ...SURVEY_STATUSES.map(status => ({ value: status, label: `${text.status(status)} · ${counts.value[status] ?? 0}` }))]
})
const filtering = computed(() => !!search.value || !!filters.from || !!filters.to || !!filters.brand || filters.target !== ALL || filters.status !== ALL)
function reset() {
  search.value = ''
  Object.assign(filters, { from: '', to: '', brand: NONE, target: ALL, status: ALL })
}

const columns = computed(() => [
  { key: 'name', label: t('surveys.fields.name'), sortKey: 'name' },
  { key: 'target_type', label: t('surveys.fields.target'), sortKey: 'target_type', secondary: true },
  { key: 'is_per_visit', label: t('surveys.fields.mode'), sortKey: 'is_per_visit', secondary: true },
  { key: 'period', label: t('surveys.fields.period'), sortKey: 'start_date' },
  { key: 'questions_count', label: t('surveys.fields.questions'), sortKey: 'questions_count', align: 'end' as const, secondary: true },
  { key: 'objective_per_week', label: t('surveys.fields.objective'), sortKey: 'objective_per_week', align: 'end' as const, secondary: true },
  { key: 'created_at', label: t('surveys.fields.addedOn'), sortKey: 'created_at', secondary: true },
  { key: 'status', label: t('surveys.fields.status'), sortKey: 'status' },
])

const open = ref(false)
const adding = ref(false)
const selected = ref<Survey | null>(null)
async function show(row: Survey) {
  adding.value = false
  selected.value = row
  open.value = true
  const full = await fetchSurvey(row.id)
  if (selected.value?.id === row.id) selected.value = full
}
function add() {
  open.value = false
  selected.value = null
  adding.value = true
}
function created(survey: Survey) {
  adding.value = false
  router.push({ name: 'tenant-survey', params: { id: survey.id } })
}
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5" :class="canAdd && 'max-md:pb-20'">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.surveys') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('surveys.list.title') }}</h1>
          <p class="text-[13px] text-dl-muted">{{ t('surveys.list.subtitle') }}</p>
        </div>
        <DlButton v-if="canAdd" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add">{{ t('surveys.list.add') }}</DlButton>
      </div>

      <DlSegmented v-model="filters.status" :label="t('surveys.fields.status')" :items="statusItems" />
      <div class="flex flex-wrap items-end gap-2.5">
        <div class="w-60 max-md:w-full"><DlInput v-model="search" :label="t('surveys.list.search')" :placeholder="t('surveys.list.search')" icon="tabler-search" hide-label /></div>
        <DlSelect v-model="filters.target" :label="t('surveys.fields.target')" :options="targetFilter" appearance="filter" />
        <DlSelect v-model="filters.brand" :label="t('surveys.fields.brands')" :options="brandFilter" appearance="filter" />
        <div class="w-64 max-md:w-full"><DlDateRangePicker v-model:start="filters.from" v-model:end="filters.to" :label="t('common.dates.period')" hide-label clearable /></div>
        <DlButton v-if="filtering" variant="ghost" icon="tabler-x" @click="reset">{{ t('common.actions.resetFilters') }}</DlButton>
      </div>

      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          v-model:sort="sort"
          default-sort="-created_at"
          :label="t('surveys.list.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :selected-key="selected?.id"
          :loading="loading"
          :compact="open || adding"
          :empty-title="filtering ? t('geo.empty.search') : t('surveys.list.emptyTitle')"
          :empty-text="filtering ? undefined : t('surveys.list.emptyText')"
          @open="show"
        >
          <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
          <template #cell-target_type="{ row }">{{ text.target(row.target_type) }}</template>
          <template #cell-is_per_visit="{ row }">{{ text.mode(row.is_per_visit) }}</template>
          <template #cell-period="{ row }"><span class="whitespace-nowrap">{{ text.period(row.start_date, row.end_date) }}</span></template>
          <template #cell-questions_count="{ row }">{{ n(row.questions_count) }}</template>
          <template #cell-objective_per_week="{ row }">{{ row.objective_per_week == null ? '—' : n(row.objective_per_week) }}</template>
          <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ text.date(row.created_at) }}</span></template>
          <template #cell-status="{ row }"><DlBadge size="sm" :tone="STATUS_TONE[row.status]" dot>{{ text.status(row.status) }}</DlBadge></template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.name }}</strong>
            <span class="text-xs text-dl-muted">{{ [text.period(row.start_date, row.end_date), text.target(row.target_type), text.status(row.status)].join(' · ') }}</span>
          </template>
        </DlDataList>
        <div class="flex flex-wrap items-center justify-end gap-3">
          <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
        </div>
      </div>

      <div v-if="canAdd" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
        <DlButton variant="primary" icon="tabler-plus" block @click="add">{{ t('surveys.list.add') }}</DlButton>
      </div>
    </div>

    <SurveyReadPanel v-if="selected" v-model:open="open" :survey="selected" />
    <SurveyAddPanel v-if="adding" v-model:open="adding" @created="created" />
  </div>
</template>
