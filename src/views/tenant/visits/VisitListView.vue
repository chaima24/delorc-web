<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchAllBrands } from '@/api/tenant/brands'
import { fetchCanals } from '@/api/tenant/fieldSetup'
import { fetchAllTeams } from '@/api/tenant/teams'
import { fetchVisitPeople, fetchVisits, fetchVisitSummary, type Visit, type VisitSummary } from '@/api/tenant/visits'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useAuthStore } from '@/stores/auth'
import { STUDIO_DEFAULT_SORT, useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import { useVisitText } from './visitDisplay'
import VisitQuickPanel from './VisitQuickPanel.vue'

// Visites: planned, done and cancelled visits, yours and those of the people you see. Four figures, the list with
// its filters, and a short panel; a visit opens on its own page. Mockup: docs/design/visits-mockups/Visits.html
const { t, n } = useI18n()
const auth = useAuthStore()
const text = useVisitText()
const canAdd = computed(() => auth.can('visits.create'))

type Filters = { from: string | null; to: string | null; status: string | null; user: number | null; team: number | null; brand: number | null; canal: number | null; offList: string | null }
const empty = (): Filters => ({ from: null, to: null, status: null, user: null, team: null, brand: null, canal: null, offList: null })
const list = useStudioList<Visit, Filters>(
  ({ page, perPage, search, sort, filters }) => fetchVisits({
    page,
    per_page: perPage,
    // The shared list helper asks for its own default (newest id first): here the default is the newest day first.
    sort: sort === STUDIO_DEFAULT_SORT ? '-visit_date' : sort,
    'filter[search]': search || undefined,
    'filter[from]': filters.from ?? undefined,
    'filter[to]': filters.to ?? undefined,
    'filter[status]': filters.status ?? undefined,
    'filter[user_id]': filters.user ?? undefined,
    'filter[team_id]': filters.team ?? undefined,
    'filter[brand_id]': filters.brand ?? undefined,
    'filter[canal_id]': filters.canal ?? undefined,
    'filter[off_list]': filters.offList ?? undefined,
  }),
  empty(),
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const summary = ref<VisitSummary | null>(null)
type Option = { value: number; label: string }
const people = ref<Option[]>([])
const teams = ref<Option[]>([])
const brands = ref<Option[]>([])
const canals = ref<Option[]>([])
const named = (rows: { id: number; name: string }[]) => rows.map(row => ({ value: row.id, label: row.name }))
// The figures and the filters' lists, asked again on coming back to the tab.
onMountedAndFocus(async () => {
  fetchVisitSummary().then(data => { summary.value = data }).catch(() => {})
  fetchAllBrands().then(rows => { brands.value = named(rows) }).catch(() => {})
  fetchCanals({ per_page: 100, sort: 'name' }).then(rows => { canals.value = named(rows.items) }).catch(() => {})
  fetchAllTeams().then(rows => { teams.value = named(rows) }).catch(() => {})
  if (canAdd.value) people.value = (await fetchVisitPeople().catch(() => [])).map(person => ({ value: person.id, label: person.full_name }))
})

const ALL = 'all'
const pick = <K extends keyof Filters>(key: K, numeric = false) => computed({
  get: () => filters[key] ?? ALL,
  set: value => { filters[key] = (value === ALL || value == null ? null : numeric ? Number(value) : String(value)) as Filters[K] },
})
const statusFilter = pick('status')
const userFilter = pick('user', true)
const teamFilter = pick('team', true)
const brandFilter = pick('brand', true)
const canalFilter = pick('canal', true)
const offListFilter = pick('offList')
const dateModel = (key: 'from' | 'to') => computed({ get: () => filters[key] ?? '', set: value => { filters[key] = value || null } })
const from = dateModel('from')
const to = dateModel('to')
const statusOptions = computed(() => [{ value: ALL, label: t('visits.filter.allStates') }, ...(['planned', 'done', 'late', 'cancelled'] as const).map(value => ({ value, label: t(`visits.state.${value}`) }))])
const offListOptions = computed(() => [{ value: ALL, label: t('visits.filter.allLists') }, { value: '1', label: t('visits.offList') }, { value: '0', label: t('visits.filter.inList') }])
const filtering = computed(() => !!search.value || Object.values(filters).some(value => value != null))
function clearFilters() {
  search.value = ''
  Object.assign(filters, empty())
}
/** A figure filters the list on what it counts. */
function only(status: string) {
  clearFilters()
  filters.status = status
}

const columns = computed(() => [
  { key: 'visit_date', label: t('visits.fields.day'), sortKey: 'visit_date' },
  { key: 'target', label: t('visits.columns.target') },
  { key: 'user', label: t('visits.fields.person') },
  { key: 'canal', label: t('visits.fields.canal'), secondary: true },
  { key: 'brands', label: t('visits.blocks.brands'), secondary: true },
  { key: 'status', label: t('visits.columns.state'), sortKey: 'status' },
])

const open = ref(false)
const selectedId = ref<number | null>(null)
function show(row: Visit) {
  selectedId.value = row.id
  open.value = true
}
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5" :class="canAdd && 'max-md:pb-20'">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.visits') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('visits.title') }}</h1>
          <p class="text-[13px] text-dl-muted">{{ t('visits.subtitle') }}</p>
        </div>
        <DlButton v-if="canAdd" variant="primary" icon="tabler-plus" class="max-md:hidden" :to="{ name: 'tenant-visit-new' }">{{ t('visits.add.button') }}</DlButton>
      </div>

      <div v-if="summary && !open" class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button type="button" class="flex flex-col gap-1 rounded-[20px] bg-dl-paper px-4 py-3.5 text-start" @click="only('done')">
          <span class="text-[12.5px] text-dl-muted">{{ t('visits.figures.done') }}</span>
          <strong class="font-display text-[28px] font-extrabold tracking-[-0.02em]">{{ n(summary.done) }}</strong>
          <small class="text-xs text-dl-muted">{{ t('visits.figures.offList', { n: n(summary.done_off_list) }) }}</small>
        </button>
        <button type="button" class="flex flex-col gap-1 rounded-[20px] bg-dl-paper px-4 py-3.5 text-start" @click="only('planned')">
          <span class="text-[12.5px] text-dl-muted">{{ t('visits.figures.planned') }}</span>
          <strong class="font-display text-[28px] font-extrabold tracking-[-0.02em]">{{ n(summary.planned) }}</strong>
          <small class="text-xs text-dl-muted">{{ summary.planned_until ? t('visits.figures.until', { date: text.day(summary.planned_until) }) : '—' }}</small>
        </button>
        <button type="button" class="flex flex-col gap-1 rounded-[20px] bg-dl-paper px-4 py-3.5 text-start" @click="only('late')">
          <span class="text-[12.5px] text-dl-muted">{{ t('visits.state.late') }}</span>
          <strong class="font-display text-[28px] font-extrabold tracking-[-0.02em]" :class="summary.late ? 'text-dl-pending' : ''">{{ n(summary.late) }}</strong>
          <small class="text-xs text-dl-muted">{{ t('visits.figures.lateText') }}</small>
        </button>
        <button type="button" class="flex flex-col gap-1 rounded-[20px] bg-dl-paper px-4 py-3.5 text-start" @click="only('cancelled')">
          <span class="text-[12.5px] text-dl-muted">{{ t('visits.figures.cancelled') }}</span>
          <strong class="font-display text-[28px] font-extrabold tracking-[-0.02em]">{{ n(summary.cancelled) }}</strong>
          <small class="text-xs text-dl-muted">{{ summary.cancelled_reasons.map(row => `${row.name} ${n(row.count)}`).join(' · ') || '—' }}</small>
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <div class="w-64 max-md:w-full"><DlInput v-model="search" :label="t('visits.filter.search')" :placeholder="t('visits.filter.search')" icon="tabler-search" hide-label /></div>
        <div class="w-40"><DlInput v-model="from" type="date" :label="t('visits.filter.from')" hide-label /></div>
        <div class="w-40"><DlInput v-model="to" type="date" :label="t('visits.filter.to')" hide-label /></div>
        <DlSelect v-model="statusFilter" :label="t('visits.columns.state')" :options="statusOptions" appearance="filter" />
        <template v-if="!open">
          <DlSelect v-if="people.length > 1" v-model="userFilter" :label="t('visits.fields.person')" :options="[{ value: ALL, label: t('visits.filter.everyone') }, ...people]" appearance="filter" />
          <DlSelect v-if="people.length > 1" v-model="teamFilter" :label="t('advs.filter.team')" :options="[{ value: ALL, label: t('users.filter.allTeams') }, ...teams]" appearance="filter" />
          <DlSelect v-model="brandFilter" :label="t('advs.fields.brand')" :options="[{ value: ALL, label: t('advs.filter.allBrands') }, ...brands]" appearance="filter" />
          <DlSelect v-model="canalFilter" :label="t('visits.fields.canal')" :options="[{ value: ALL, label: t('visits.filter.allCanals') }, ...canals]" appearance="filter" />
          <DlSelect v-model="offListFilter" :label="t('visits.filter.list')" :options="offListOptions" appearance="filter" />
        </template>
        <DlButton v-if="filtering" variant="ghost" icon="tabler-x" @click="clearFilters">{{ t('common.actions.resetFilters') }}</DlButton>
      </div>

      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          v-model:sort="sort"
          :default-sort="STUDIO_DEFAULT_SORT"
          :label="t('visits.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :selected-key="selectedId"
          :loading="loading"
          :compact="open"
          :empty-title="filtering ? t('geo.empty.search') : t('visits.empty.title')"
          :empty-text="filtering ? undefined : t('visits.empty.text')"
          @open="show"
        >
          <template #cell-visit_date="{ row }">
            <span class="whitespace-nowrap first-letter:uppercase">{{ text.day(row.visit_date) }}</span>
            <small v-if="row.visit_time" class="block text-xs text-dl-muted">{{ row.visit_time }}</small>
          </template>
          <template #cell-target="{ row }">
            <span class="flex items-center gap-2.5" :class="row.status === 'cancelled' && 'opacity-60'">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold" :class="row.target.type === 'hco' ? 'bg-dl-cobalt/10 text-dl-cobalt' : 'bg-dl-mist'">{{ text.initials(row.target.name) }}</span>
              <span class="min-w-0">
                <strong class="font-semibold">{{ row.target.name }}</strong>
                <DlBadge v-if="row.off_list" size="sm" tone="warning" class="ms-1.5">{{ t('visits.offList') }}</DlBadge>
                <small class="block truncate text-xs text-dl-muted">{{ text.where(row.target) }}</small>
              </span>
            </span>
          </template>
          <template #cell-user="{ row }">{{ row.user?.full_name ?? '—' }}</template>
          <template #cell-canal="{ row }"><span class="text-dl-muted">{{ row.canal?.name ?? '—' }}</span></template>
          <template #cell-brands="{ row }">
            <span v-if="row.brands.length" class="flex flex-wrap gap-1">
              <DlBadge v-for="brand in row.brands.slice(0, 2)" :key="brand.id" size="sm">{{ brand.name }}</DlBadge>
              <DlBadge v-if="row.brands.length > 2" size="sm">+{{ row.brands.length - 2 }}</DlBadge>
            </span>
            <span v-else class="text-dl-muted">—</span>
          </template>
          <template #cell-status="{ row }">
            <DlBadge size="sm" :tone="text.tone(row)" dot>{{ text.state(row) }}</DlBadge>
            <small v-if="row.cancel_reason" class="block text-xs text-dl-muted">{{ row.cancel_reason.name }}</small>
          </template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.target.name }}</strong>
            <span class="text-xs text-dl-muted">{{ [text.day(row.visit_date), row.user?.full_name, text.state(row)].filter(Boolean).join(' · ') }}</span>
          </template>
        </DlDataList>
        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>

      <div v-if="canAdd" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
        <DlButton variant="primary" icon="tabler-plus" block :to="{ name: 'tenant-visit-new' }">{{ t('visits.add.button') }}</DlButton>
      </div>
    </div>

    <VisitQuickPanel v-if="selectedId" v-model:open="open" :visit-id="selectedId" />
  </div>
</template>
