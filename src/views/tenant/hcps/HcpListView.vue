<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { ListParams } from '@/api/tenant/geography'
import { HCP_MISSING, HCP_TYPES, fetchHcp, fetchHcpMissingCounts, fetchHcpTypeCounts, fetchHcps, type Hcp, type HcpMissing, type HcpMissingCounts, type HcpType, type HcpTypeCounts } from '@/api/tenant/hcps'
import DlAvatar from '@/components/DlAvatar.vue'
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
import DlSegmented from '@/components/DlSegmented.vue'
import HcpCreatePanel from './HcpCreatePanel.vue'
import HcpMap from './HcpMap.vue'
import HcpReadPanel from './HcpReadPanel.vue'
import { avatarName, useHcpText } from './hcpForm'
import { useHcpLookups } from './useHcpLookups'

// Professionals › Healthcare professionals: type tabs with counts, search + filters, reading panel,
// "Add" in 3 steps; editing is on the full page. "Missing" counters filter on what is missing.
// ?type=<type> opens a tab, ?missing=<gps|phone|…> a counter, ?hco=<id> an organisation, ?view=map the map.
// Import (5b), duplicates (5c), proposals (5d) and the territory filter come with their parts.
// Mockup: docs/design/customers-mockups/Professionals.html
const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const canAdd = computed(() => auth.can('hcps.create'))
const text = useHcpText()
const lookups = useHcpLookups()

const ALL = 'all'
type Filters = { type: string; missing: string; speciality: string | number; hco: string | number; wilaya: string | number; status: string; verified: string; added: string; from: string; to: string }

/** The "Added" filter as API dates: one day, or a range typed in any order. */
function addedDates(f: Filters): { from?: string; to?: string } {
  if (f.added === 'day' && f.from) return { from: f.from, to: f.from }
  if (f.added === 'range' && (f.from || f.to)) {
    const [from, to] = [f.from, f.to].sort((a, b) => (a && b ? a.localeCompare(b) : 0))
    return { from: from || undefined, to: to || undefined }
  }
  return {}
}
const pick = <T,>(value: T) => (value === ALL ? undefined : value)

/** Every filter but the type (the tabs count with these). */
function baseQuery(search: string, f: Filters): ListParams {
  const { from, to } = addedDates(f)
  return {
    'filter[q]': search || undefined,
    'filter[speciality_id]': pick(f.speciality),
    'filter[hco_id]': pick(f.hco),
    'filter[wilaya_id]': pick(f.wilaya),
    'filter[status]': pick(f.status),
    'filter[verified]': f.verified === ALL ? undefined : Number(f.verified),
    'filter[missing]': pick(f.missing),
    'filter[created_from]': from,
    'filter[created_to]': to,
  }
}
const queryOf = (search: string, f: Filters): ListParams => ({ ...baseQuery(search, f), 'filter[type]': pick(f.type) })

const initialType = HCP_TYPES.includes(route.query.type as HcpType) ? String(route.query.type) : ALL
const initialMissing = HCP_MISSING.includes(route.query.missing as HcpMissing) ? String(route.query.missing) : ALL
// ?hco=<id>: the professionals working at an organisation (link from its panel).
const initialHco = Number(route.query.hco) || ALL
const list = useStudioList<Hcp, Filters>(
  ({ page, perPage, search, sort, filters }) => fetchHcps({ page, per_page: perPage, sort, ...queryOf(search, filters) }),
  { type: initialType, missing: initialMissing, speciality: ALL, hco: initialHco, wilaya: ALL, status: ALL, verified: ALL, added: ALL, from: '', to: '' },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

// Type tabs, counted with the other filters.
const counts = ref<HcpTypeCounts | null>(null)
let countRequest = 0
async function loadCounts() {
  const current = ++countRequest
  try {
    const result = await fetchHcpTypeCounts(baseQuery(search.value.trim(), filters))
    if (current === countRequest) counts.value = result
  }
  catch {
    // Tabs just show no numbers.
  }
}
let countTimer: ReturnType<typeof setTimeout> | undefined
watch(() => JSON.stringify(baseQuery(search.value.trim(), filters)), () => {
  clearTimeout(countTimer)
  countTimer = setTimeout(loadCounts, 250)
}, { immediate: true })
const typeTabs = computed(() => [ALL, ...HCP_TYPES].map(value => ({
  value,
  label: value === ALL ? t('hcps.filter.allTypes') : t(`hcps.typesPlural.${value}`),
  count: counts.value?.[value as HcpType | 'all'],
})))
// "Missing" counters, with the tab and the other filters (not the counter itself).
const missingCounts = ref<HcpMissingCounts | null>(null)
let missingRequest = 0
async function loadMissing() {
  const current = ++missingRequest
  try {
    const query = { ...queryOf(search.value.trim(), filters), 'filter[missing]': undefined }
    const result = await fetchHcpMissingCounts(query)
    if (current === missingRequest) missingCounts.value = result
  }
  catch {
    // The counters just stay hidden.
  }
}
let missingTimer: ReturnType<typeof setTimeout> | undefined
watch(() => JSON.stringify({ ...queryOf(search.value.trim(), filters), 'filter[missing]': undefined }), () => {
  clearTimeout(missingTimer)
  missingTimer = setTimeout(loadMissing, 250)
}, { immediate: true })
function toggleMissing(value: HcpMissing) {
  filters.missing = filters.missing === value ? ALL : value
  router.replace({ query: { ...route.query, missing: filters.missing === ALL ? undefined : filters.missing } })
}

function setType(value: string) {
  filters.type = value
  router.replace({ query: { ...route.query, type: value === ALL ? undefined : value } })
}

const withAll = (label: string, options: { value: string | number; label: string }[]) => [{ value: ALL, label }, ...options]
const specialityOptions = computed(() => withAll(t('hcps.filter.all'), lookups.specialityOptions.value))
const hcoOptions = computed(() => withAll(t('hcps.filter.all'), lookups.hcoOptions.value))
const wilayaOptions = computed(() => withAll(t('hcps.filter.all'), lookups.wilayaOptions.value))
const statusOptions = computed(() => withAll(t('hcps.filter.all'), [{ value: 'active', label: t('hcps.status.active') }, { value: 'inactive', label: t('hcps.status.inactive') }]))
const verifiedOptions = computed(() => withAll(t('hcps.filter.all'), [{ value: '1', label: t('hcps.filter.verifiedYes') }, { value: '0', label: t('hcps.filter.verifiedNo') }]))
const addedFilter = computed({
  get: () => filters.added,
  set: value => {
    const added = String(value ?? ALL)
    // One day starts on today; a range on the last 30 days. Both can be changed right after.
    if (added === 'day') Object.assign(filters, { added, from: today(), to: '' })
    else if (added === 'range') Object.assign(filters, { added, from: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10), to: today() })
    else Object.assign(filters, { added, from: '', to: '' })
  },
})
const addedOptions = computed(() => [
  { value: ALL, label: t('users.filter.anyDate') },
  { value: 'day', label: t('access.log.filter.oneDay') },
  { value: 'range', label: t('access.log.filter.range') },
])
// Phone: filters folded by default; the button says how many are on.
const filtersOpen = ref(false)
const activeFilters = computed(() => ['speciality', 'hco', 'wilaya', 'status', 'verified', 'added'].filter(key => filters[key as keyof Filters] !== ALL).length)
const filtered = computed(() => !!search.value || Object.entries(filters).some(([key, value]) => !['from', 'to'].includes(key) && value !== ALL))

// List or map (kept in the address).
const view = computed({
  get: () => (route.query.view === 'map' ? 'map' : 'list'),
  set: value => router.replace({ query: { ...route.query, view: value === 'map' ? 'map' : undefined } }),
})
const viewItems = computed(() => [{ value: 'list', label: t('hcps.map.list') }, { value: 'map', label: t('hcps.map.map') }])
const mapQuery = computed(() => queryOf(search.value.trim(), filters))
function showNoGps() {
  filters.missing = 'gps'
  router.replace({ query: { ...route.query, view: undefined, missing: 'gps' } })
}
/** A pin clicked on the map: the full record in the panel. */
async function showById(id: number) {
  try {
    const full = await fetchHcp(id)
    adding.value = false
    selected.value = full
    open.value = true
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
}

// Panel: a professional (reading mode) or "Add".
const open = ref(false)
const selected = ref<Hcp | null>(null)
const adding = ref(false)

async function show(row: Hcp) {
  adding.value = false
  selected.value = row
  open.value = true
  try {
    const full = await fetchHcp(row.id)
    if (selected.value?.id === row.id) selected.value = full
  }
  catch {
    // The row's data stays shown.
  }
}
function add() {
  selected.value = null
  adding.value = true
  open.value = true
}
async function onCreated(hcp: Hcp) {
  list.reload()
  loadCounts()
  loadMissing()
  await show(hcp)
}

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('hcps.columns.professional'), sortKey: 'name' },
  { key: 'type', label: t('hcps.fields.type') },
  { key: 'workplace', label: t('hcps.columns.workplace') },
  { key: 'commune', label: t('hcps.fields.commune'), secondary: true },
  { key: 'status', label: t('hcps.fields.status'), secondary: true },
  { ...added.column, secondary: true },
]
const contactLine = (hcp: Hcp) => hcp.email || hcp.phone || ''

// Export: every professional matching the filters (all pages), in the viewer's language.
/** Every page of the list, 100 rows at a time. */
async function allRows(): Promise<Hcp[]> {
  const rows: Hcp[] = []
  for (let pageNumber = 1; ; pageNumber++) {
    const result = await fetchHcps({ page: pageNumber, per_page: 100, sort: sort.value || STUDIO_DEFAULT_SORT, ...queryOf(search.value.trim(), filters) })
    rows.push(...result.items)
    if (!result.items.length || rows.length >= result.total) return rows
  }
}
const exporting = ref(false)
async function exportList() {
  exporting.value = true
  try {
    const rows = await allRows()
    await exportToXlsx(rows.map(hcp => ({
      [t('hcps.fields.code')]: text.code(hcp),
      [t('hcps.fields.name')]: hcp.name,
      [t('hcps.fields.type')]: text.type(hcp.type),
      [t('hcps.fields.gender')]: hcp.gender ? t(`hcps.genders.${hcp.gender}`) : '',
      [t('hcps.workplaces.speciality')]: (hcp.current_workplaces ?? []).map(w => w.speciality?.name).filter(Boolean).join(', '),
      [t('hcps.workplaces.hco')]: (hcp.current_workplaces ?? []).map(w => w.hco?.name).filter(Boolean).join(', '),
      [t('hcps.fields.phone')]: hcp.phone ?? '',
      [t('hcps.fields.email')]: hcp.email ?? '',
      [t('hcps.fields.fax')]: hcp.fax ?? '',
      [t('hcps.fields.address')]: hcp.address ?? '',
      [t('hcps.fields.commune')]: hcp.commune?.name ?? '',
      [t('hcps.fields.wilaya')]: hcp.commune?.wilaya?.name ?? '',
      [t('hcps.fields.latitude')]: hcp.latitude ?? '',
      [t('hcps.fields.longitude')]: hcp.longitude ?? '',
      [t('hcps.fields.status')]: t(`hcps.status.${hcp.status}`),
      [t('hcps.fields.verified')]: t(hcp.verified ? 'products.yes' : 'products.no'),
      [t('hcps.fields.oneKeyId')]: hcp.one_key_id ?? '',
      [t('hcps.fields.wkpId')]: hcp.wkp_id ?? '',
      [t('studio.list.added')]: hcp.created_at?.slice(0, 10) ?? '',
    })), `${t('hcps.title')} ${today()}`, t('hcps.title'))
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
  <!-- As the mockup: the panel sits beside the whole column (title, tabs, list), from the top. -->
  <div class="flex w-full items-start gap-5" :class="canAdd && view === 'list' && 'max-md:pb-20'">
    <div class="flex min-w-0 flex-1 flex-col gap-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="text-sm text-dl-muted">{{ t('nav.workspaces.customers') }}</span>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('hcps.title') }}</h1>
      </div>
      <div class="flex flex-wrap items-center gap-2.5">
        <DlSegmented v-model="view" :label="t('hcps.map.view')" :items="viewItems" />
        <DlButton variant="outline" icon="tabler-file-spreadsheet" :loading="exporting" :disabled="!total" @click="exportList">{{ t('users.export') }}</DlButton>
        <DlButton v-if="canAdd" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add">{{ t('hcps.add.button') }}</DlButton>
      </div>
    </div>

    <div role="tablist" :aria-label="t('hcps.fields.type')" class="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:self-start md:rounded-2xl md:bg-dl-paper md:p-1">
      <button
        v-for="tab in typeTabs"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="filters.type === tab.value"
        class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
        :class="filters.type === tab.value ? 'bg-dl-ink text-dl-on-ink dark:bg-dl-fg dark:text-dl-mist' : 'text-dl-body hover:text-dl-fg max-md:bg-dl-paper'"
        @click="setType(tab.value)"
      >
        {{ tab.label }}
        <span v-if="tab.count !== undefined" class="text-[11.5px] tabular-nums opacity-70">{{ n(tab.count) }}</span>
      </button>
    </div>

    <div v-if="missingCounts" class="flex flex-wrap items-center gap-2" :class="view === 'map' && 'max-md:hidden'" role="group" :aria-label="t('hcps.missing.title')">
      <span class="me-1 text-[13px] text-dl-muted">{{ t('hcps.missing.title') }}</span>
      <button
        v-for="key in HCP_MISSING"
        :key="key"
        type="button"
        :aria-pressed="filters.missing === key"
        class="inline-flex h-9 items-center gap-2 rounded-[11px] border px-3 text-[13px] font-semibold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
        :class="filters.missing === key ? 'border-dl-ink bg-dl-ink text-dl-on-ink dark:border-dl-fg dark:bg-dl-fg dark:text-dl-mist' : 'border-dl-line bg-dl-paper text-dl-body hover:text-dl-fg'"
        @click="toggleMissing(key)"
      >
        <span class="h-2 w-2 rounded-full bg-dl-pending" aria-hidden="true" />
        {{ t(`hcps.missing.${key}`) }}
        <span class="tabular-nums" :class="filters.missing === key ? 'text-dl-signal dark:text-dl-ink' : 'text-dl-fg'">{{ n(missingCounts[key]) }}</span>
      </button>
    </div>

      <div class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <div class="flex flex-wrap items-center gap-2.5">
          <div class="flex w-full items-center gap-2 sm:max-w-xs">
            <DlInput
              v-model="search"
              type="search"
              icon="tabler-search"
              :label="t('hcps.search')"
              :placeholder="t('hcps.search')"
              hide-label
              class="min-w-0 flex-1"
            />
            <!-- Phone: the filters fold away behind one button -->
            <DlButton variant="outline" icon="tabler-adjustments-horizontal" class="md:hidden" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">
              {{ activeFilters ? t('hcps.filter.count', { n: activeFilters }) : t('hcps.filter.button') }}
            </DlButton>
          </div>
          <div class="contents" :class="!filtersOpen && 'max-md:hidden'">
          <DlSelect v-model="filters.speciality" :label="t('hcps.workplaces.speciality')" :options="specialityOptions" appearance="filter" />
          <DlSelect v-model="filters.hco" :label="t('hcps.workplaces.hco')" :options="hcoOptions" appearance="filter" />
          <DlSelect v-model="filters.wilaya" :label="t('hcps.fields.wilaya')" :options="wilayaOptions" appearance="filter" />
          <DlSelect v-model="filters.status" :label="t('hcps.fields.status')" :options="statusOptions" appearance="filter" />
          <DlSelect v-model="filters.verified" :label="t('hcps.fields.verified')" :options="verifiedOptions" appearance="filter" />
          <DlSelect v-model="addedFilter" :label="t('studio.list.added')" :options="addedOptions" appearance="filter" />
          <DlInput v-if="filters.added === 'day'" v-model="filters.from" type="date" :max="today()" :label="t('access.log.filter.day')" hide-label class="w-44" />
          <template v-if="filters.added === 'range'">
            <DlInput v-model="filters.from" type="date" :max="filters.to || today()" :label="t('access.log.filter.from')" hide-label class="w-44" />
            <span class="inline-block text-sm text-dl-muted rtl:-scale-x-100" aria-hidden="true">→</span>
            <DlInput v-model="filters.to" type="date" :min="filters.from" :max="today()" :label="t('access.log.filter.to')" hide-label class="w-44" />
          </template>
          </div>
        </div>

        <HcpMap v-if="view === 'map'" :query="mapQuery" :selected-id="open ? selected?.id : null" @open="showById" @no-gps="showNoGps" />
        <DlDataList
          v-else
          v-model:sort="sort"
          :default-sort="STUDIO_DEFAULT_SORT"
          :label="t('hcps.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :selected-key="selected?.id"
          :loading="loading"
          :compact="open"
          :empty-title="filtered ? t('geo.empty.search') : t('hcps.empty')"
          @open="show"
        >
          <template #cell-name="{ row }">
            <span class="flex items-center gap-2.5">
              <DlAvatar :name="avatarName(row.name)" size="sm" tone="neutral" />
              <span class="flex min-w-0 flex-col">
                <strong class="font-semibold">{{ row.name }}</strong>
                <span v-if="contactLine(row)" class="truncate text-xs text-dl-muted">{{ contactLine(row) }}</span>
              </span>
            </span>
          </template>
          <template #cell-type="{ row }">{{ text.type(row.type) }}</template>
          <template #cell-workplace="{ row }">
            <span class="flex flex-col">
              <span>{{ text.mainWorkplace(row).speciality ?? '—' }}</span>
              <span v-if="text.mainWorkplace(row).hco" class="text-xs text-dl-muted">{{ text.mainWorkplace(row).hco }}</span>
            </span>
          </template>
          <template #cell-commune="{ row }">{{ text.place(row) }}</template>
          <template #cell-status="{ row }">
            <span class="flex flex-col items-start gap-1">
              <DlBadge size="sm" :tone="row.status === 'inactive' ? 'neutral' : 'success'" dot>{{ t(`hcps.status.${row.status ?? 'active'}`) }}</DlBadge>
              <span v-if="row.verified" class="text-xs font-semibold text-dl-cobalt">✓ {{ t('hcps.verified') }}</span>
            </span>
          </template>
          <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
          <template #card="{ row }">
            <span class="flex items-center gap-3">
              <DlAvatar :name="avatarName(row.name)" size="sm" tone="neutral" />
              <span class="flex min-w-0 flex-1 flex-col">
                <strong class="truncate font-semibold">{{ row.name }}</strong>
                <span class="truncate text-xs text-dl-muted">{{ [text.mainWorkplace(row).speciality ?? text.type(row.type), row.commune?.name].filter(Boolean).join(' · ') }}</span>
              </span>
              <DlBadge v-if="row.status === 'inactive'" size="sm" tone="neutral" dot>{{ t('hcps.status.inactive') }}</DlBadge>
            </span>
          </template>
        </DlDataList>

        <DlPagination v-if="view === 'list'" v-model="page" v-model:per-page="perPage" :total="total" />
      </div>
    </div>

      <HcpCreatePanel v-if="adding" v-model:open="open" @created="onCreated" />
      <HcpReadPanel v-else-if="selected" v-model:open="open" :hcp="selected" />

    <!-- Phone: "Add" sits at the bottom, in reach of the thumb -->
    <div v-if="canAdd && view === 'list'" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
      <DlButton variant="primary" size="lg" icon="tabler-plus" block @click="add">{{ t('hcps.add.button') }}</DlButton>
    </div>
  </div>
</template>
