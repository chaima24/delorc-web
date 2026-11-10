<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { ListParams } from '@/api/tenant/geography'
import { HCO_TYPES, fetchHco, fetchHcoTypeCounts, fetchHcos, type Hco, type HcoType } from '@/api/tenant/hcos'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import { exportToXlsx } from '@/composables/exportXlsx'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useHcpLookups } from '@/views/tenant/hcps/useHcpLookups'
import { STUDIO_DEFAULT_SORT, useAddedColumn, useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import { today } from '@/views/tenant/users/userDisplay'
import HcoCreatePanel from './HcoCreatePanel.vue'
import HcoPanel from './HcoPanel.vue'
import { useHcoText } from './hcoForm'

// Professionals › Organisations (hospitals, clinics; departments are organisations with a parent).
// Type tabs with counts, search + filters, side panel to read and edit, 2-step add. ?type= opens a tab.
// Mockup: docs/design/customers-mockups/Organisations.html
const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const canAdd = computed(() => auth.can('hcos.create'))
const text = useHcoText()
const lookups = useHcpLookups()

const ALL = 'all'
type Filters = { type: string; level: string; wilaya: string | number; added: string; from: string; to: string }

function addedDates(f: Filters): { from?: string; to?: string } {
  if (f.added === 'day' && f.from) return { from: f.from, to: f.from }
  if (f.added === 'range' && (f.from || f.to)) {
    const [from, to] = [f.from, f.to].sort((a, b) => (a && b ? a.localeCompare(b) : 0))
    return { from: from || undefined, to: to || undefined }
  }
  return {}
}
function baseQuery(search: string, f: Filters): ListParams {
  const { from, to } = addedDates(f)
  return {
    'filter[q]': search || undefined,
    'filter[level]': f.level === 'main' ? 'main' : undefined,
    'filter[wilaya_id]': f.wilaya === ALL ? undefined : Number(f.wilaya),
    'filter[created_from]': from,
    'filter[created_to]': to,
  }
}
const queryOf = (search: string, f: Filters): ListParams => ({ ...baseQuery(search, f), 'filter[type]': f.type === ALL ? undefined : f.type })

const list = useStudioList<Hco, Filters>(
  ({ page, perPage, search, sort, filters }) => fetchHcos({ page, per_page: perPage, sort, ...queryOf(search, filters) }),
  { type: HCO_TYPES.includes(route.query.type as HcoType) ? String(route.query.type) : ALL, level: 'main', wilaya: ALL, added: ALL, from: '', to: '' },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

// Type tabs, counted with the other filters.
const counts = ref<Record<string, number> | null>(null)
let countTimer: ReturnType<typeof setTimeout> | undefined
watch(() => JSON.stringify(baseQuery(search.value.trim(), filters)), () => {
  clearTimeout(countTimer)
  countTimer = setTimeout(async () => {
    try {
      counts.value = await fetchHcoTypeCounts(baseQuery(search.value.trim(), filters))
    }
    catch {
      counts.value = null
    }
  }, 250)
}, { immediate: true })
const typeTabs = computed(() => [ALL, ...HCO_TYPES].map(value => ({
  value,
  label: value === ALL ? t('hcps.filter.allTypes') : t(`hcos.typesPlural.${value}`),
  count: counts.value?.[value],
})))
function setType(value: string) {
  filters.type = value
  router.replace({ query: { ...route.query, type: value === ALL ? undefined : value } })
}

const wilayaOptions = computed(() => [{ value: ALL, label: t('hcps.filter.all') }, ...lookups.wilayaOptions.value])
const levelOptions = computed(() => [{ value: 'main', label: t('hcos.filter.main') }, { value: ALL, label: t('hcos.filter.withDepartments') }])
const addedFilter = computed({
  get: () => filters.added,
  set: value => {
    const added = String(value ?? ALL)
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
const filtered = computed(() => !!search.value || filters.type !== ALL || filters.wilaya !== ALL || filters.added !== ALL)

// Panel: an organisation (reading, edit by section) or "Add" (optionally a department of `parentId`).
const open = ref(false)
const selected = ref<Hco | null>(null)
const adding = ref(false)
const parentId = ref<number | null>(null)

async function show(id: number) {
  try {
    const full = await fetchHco(id)
    adding.value = false
    selected.value = full
    open.value = true
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
}
function add(parent: number | null = null) {
  selected.value = null
  parentId.value = parent
  adding.value = true
  open.value = true
}
async function onCreated(hco: Hco) {
  list.reload()
  await show(hco.id)
}
async function onChanged() {
  list.reload()
  if (selected.value) await show(selected.value.id)
}
function onDeleted() {
  open.value = false
  selected.value = null
  list.reload()
}

const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('hcos.columns.organisation'), sortKey: 'name' },
  { key: 'commune', label: t('hcps.fields.commune') },
  // The professionals column comes with their module.
  { ...added.column, secondary: true },
]

/** Every page of the list, 100 rows at a time. */
async function allRows(): Promise<Hco[]> {
  const rows: Hco[] = []
  for (let pageNumber = 1; ; pageNumber++) {
    const result = await fetchHcos({ page: pageNumber, per_page: 100, sort: sort.value || STUDIO_DEFAULT_SORT, ...queryOf(search.value.trim(), filters) })
    rows.push(...result.items)
    if (!result.items.length || rows.length >= result.total) return rows
  }
}

const exporting = ref(false)
async function exportList() {
  exporting.value = true
  try {
    const rows = await allRows()
    await exportToXlsx(rows.map(hco => ({
      [t('hcos.fields.name')]: hco.name,
      [t('hcos.fields.type')]: t(`hcos.types.${hco.type}`),
      [t('hcos.fields.parent')]: hco.parent?.name ?? '',
      [t('hcps.fields.phone')]: hco.phone ?? '',
      [t('hcps.fields.address')]: hco.address ?? '',
      [t('hcps.fields.commune')]: hco.commune?.name ?? '',
      [t('hcps.fields.wilaya')]: hco.commune?.wilaya?.name ?? '',
      [t('hcps.fields.latitude')]: hco.latitude ?? '',
      [t('hcps.fields.longitude')]: hco.longitude ?? '',
      [t('hcps.fields.oneKeyId')]: hco.one_key_id,
      [t('hcos.figures.departments')]: hco.children_count ?? 0,
      [t('studio.list.added')]: hco.created_at?.slice(0, 10) ?? '',
    })), `${t('hcos.title')} ${today()}`, t('hcos.title'))
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
  <div class="flex w-full items-start gap-5" :class="canAdd && 'max-md:pb-20'">
    <div class="flex min-w-0 flex-1 flex-col gap-5">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="text-sm text-dl-muted">{{ t('nav.workspaces.customers') }}</span>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('hcos.title') }}</h1>
      </div>
      <div class="flex gap-2.5">
        <DlButton variant="outline" icon="tabler-file-spreadsheet" :loading="exporting" :disabled="!total" @click="exportList">{{ t('users.export') }}</DlButton>
        <DlButton v-if="canAdd" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add()">{{ t('hcos.add.button') }}</DlButton>
      </div>
    </div>

    <div role="tablist" :aria-label="t('hcos.fields.type')" class="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:self-start md:rounded-2xl md:bg-dl-paper md:p-1">
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
        {{ tab.label }}<span v-if="tab.count !== undefined" class="text-[11.5px] tabular-nums opacity-70">{{ n(tab.count) }}</span>
      </button>
    </div>

      <div class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <div class="flex flex-wrap items-center gap-2.5">
          <DlInput v-model="search" type="search" icon="tabler-search" :label="t('hcos.search')" :placeholder="t('hcos.search')" hide-label class="w-full sm:max-w-xs" />
          <DlSelect v-model="filters.wilaya" :label="t('hcps.fields.wilaya')" :options="wilayaOptions" appearance="filter" />
          <DlSelect v-model="filters.level" :label="t('hcos.filter.show')" :options="levelOptions" appearance="filter" />
          <DlSelect v-model="addedFilter" :label="t('studio.list.added')" :options="addedOptions" appearance="filter" />
          <DlInput v-if="filters.added === 'day'" v-model="filters.from" type="date" :max="today()" :label="t('access.log.filter.day')" hide-label class="w-44" />
          <template v-if="filters.added === 'range'">
            <DlInput v-model="filters.from" type="date" :max="filters.to || today()" :label="t('access.log.filter.from')" hide-label class="w-44" />
            <span class="inline-block text-sm text-dl-muted rtl:-scale-x-100" aria-hidden="true">→</span>
            <DlInput v-model="filters.to" type="date" :min="filters.from" :max="today()" :label="t('access.log.filter.to')" hide-label class="w-44" />
          </template>
        </div>

        <DlDataList
          v-model:sort="sort"
          :default-sort="STUDIO_DEFAULT_SORT"
          :label="t('hcos.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :selected-key="open ? selected?.id : null"
          :loading="loading"
          :compact="open"
          :empty-title="filtered ? t('geo.empty.search') : t('hcos.empty')"
          @open="row => show(row.id)"
        >
          <template #cell-name="{ row }">
            <span class="flex items-center gap-2.5">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-dl-line-soft text-dl-body"><DlIcon :icon="row.type === 'clinic' ? 'tabler-building-hospital' : 'tabler-hospital'" :size="18" /></span>
              <span class="flex min-w-0 flex-col">
                <strong class="font-semibold">{{ row.name }}</strong>
                <span class="truncate text-xs text-dl-muted">{{ text.kind(row) }}</span>
              </span>
            </span>
          </template>
          <template #cell-commune="{ row }">{{ text.place(row) }}</template>
          <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
          <template #card="{ row }">
            <span class="flex items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-dl-line-soft text-dl-body"><DlIcon :icon="row.type === 'clinic' ? 'tabler-building-hospital' : 'tabler-hospital'" :size="18" /></span>
              <span class="flex min-w-0 flex-1 flex-col">
                <strong class="truncate font-semibold">{{ row.name }}</strong>
                <span class="truncate text-xs text-dl-muted">{{ text.kind(row) }} · {{ row.commune?.name }}</span>
              </span>
            </span>
          </template>
        </DlDataList>

        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>
    </div>

      <HcoCreatePanel v-if="adding" v-model:open="open" :parent-id="parentId" @created="onCreated" />
      <HcoPanel v-else-if="selected" v-model:open="open" :hco="selected" @changed="onChanged" @deleted="onDeleted" @open="show" @add-department="add" />

    <div v-if="canAdd" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
      <DlButton variant="primary" size="lg" icon="tabler-plus" block @click="add()">{{ t('hcos.add.button') }}</DlButton>
    </div>
  </div>
</template>
