<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { ListParams } from '@/api/tenant/geography'
import { fetchTerritories, fetchTerritory, fetchTerritoryCounts, type Territory } from '@/api/tenant/territories'
import DlAvatar from '@/components/DlAvatar.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { exportToXlsx } from '@/composables/exportXlsx'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useHcpLookups } from '@/views/tenant/hcps/useHcpLookups'
import { STUDIO_DEFAULT_SORT, useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import { today } from '@/views/tenant/users/userDisplay'
import TerritoryPanel from './TerritoryPanel.vue'
import { personName, useTerritoryText } from './territoryText'
import { treeRows } from './territoryTree'
import { allTerritories, useUsers } from './useTerritoryLookups'
import { useTerritoryTypes } from './useTerritoryTypes'

// Plan › Territories: list (what each covers, who works it now, professionals) or tree,
// "Nobody working it" quick filter, side panel, 3-step add. ?rule_type=, ?user=, ?view=tree, ?open=id.
// Mockup: docs/design/customers-mockups/Territories.html
const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()
const canStore = (resource: string) => auth.can(`${resource}.create`)
const text = useTerritoryText()
const lookups = useHcpLookups()
const users = useUsers()
users.ensureLoaded()
const types = useTerritoryTypes()

const ALL = 'all'
type Filters = { user: string | number; wilaya: string | number; ruleType: string; nobody: string }
function queryOf(search: string, f: Filters): ListParams {
  return {
    'filter[q]': search || undefined,
    'filter[user_id]': f.user === ALL ? undefined : Number(f.user),
    'filter[wilaya_id]': f.wilaya === ALL ? undefined : Number(f.wilaya),
    'filter[rule_type]': f.ruleType === ALL ? undefined : f.ruleType,
    'filter[nobody]': f.nobody === '1' ? 1 : undefined,
  }
}

const list = useStudioList<Territory, Filters>(
  ({ page, perPage, search, sort, filters }) => fetchTerritories({ page, per_page: perPage, sort, details: 1, ...queryOf(search, filters) }),
  { user: Number(route.query.user) || ALL, wilaya: ALL, ruleType: typeof route.query.rule_type === 'string' ? route.query.rule_type : ALL, nobody: route.query.nobody === '1' ? '1' : '' },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const counts = ref<{ all: number; nobody: number } | null>(null)
async function loadCounts() {
  try {
    counts.value = await fetchTerritoryCounts({ ...queryOf(search.value.trim(), filters), 'filter[nobody]': undefined })
  }
  catch {
    counts.value = null
  }
}
watch(() => JSON.stringify(queryOf(search.value.trim(), filters)), loadCounts, { immediate: true })
function toggleNobody() {
  filters.nobody = filters.nobody === '1' ? '' : '1'
}

const userOptions = computed(() => [{ value: ALL, label: t('hcps.filter.all') }, ...users.items.value
  .map(user => ({ value: user.id, label: user.full_name }))
  .sort((a, b) => a.label.localeCompare(b.label))])
const wilayaOptions = computed(() => [{ value: ALL, label: t('hcps.filter.all') }, ...lookups.wilayaOptions.value])
const typeOptions = computed(() => [{ value: ALL, label: t('territories.filter.anyType') }, ...types.all.value.map(type => ({ value: type.code, label: type.name }))])
const filtered = computed(() => !!search.value || filters.user !== ALL || filters.wilaya !== ALL || filters.ruleType !== ALL || filters.nobody === '1')

// List or tree (every territory, with the filters).
const view = computed({
  get: () => (route.query.view === 'tree' ? 'tree' : 'list'),
  set: value => router.replace({ query: { ...route.query, view: value === 'tree' ? 'tree' : undefined } }),
})
const treeItems = ref<Territory[]>([])
const treeLoading = ref(false)
async function loadTree() {
  if (view.value !== 'tree') return
  treeLoading.value = true
  try {
    treeItems.value = await allTerritories({ details: 1, ...queryOf(search.value.trim(), filters) })
  }
  finally {
    treeLoading.value = false
  }
}
watch(() => [view.value, JSON.stringify(queryOf(search.value.trim(), filters))], loadTree, { immediate: true })
const tree = computed(() => treeRows(treeItems.value))

// Panel: a territory. Add opens its own page.
const open = ref(false)
const selected = ref<Territory | null>(null)
async function show(id: number) {
  try {
    selected.value = await fetchTerritory(id)
    open.value = true
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
}
if (Number(route.query.open)) show(Number(route.query.open))
function add() {
  router.push({ name: 'tenant-territory-new' })
}
function reloadAll() {
  list.reload()
  loadCounts()
  loadTree()
}
async function onChanged() {
  reloadAll()
  if (selected.value) await show(selected.value.id)
}
function onDeleted() {
  open.value = false
  selected.value = null
  reloadAll()
}

const columns = [
  { key: 'name', label: t('territories.columns.territory'), sortKey: 'name' },
  { key: 'covers', label: t('territories.columns.covers') },
  { key: 'people', label: t('territories.columns.people') },
  { key: 'hcps', label: t('territories.columns.hcps'), align: 'end' as const },
  { key: 'children', label: t('territories.columns.under'), align: 'end' as const, secondary: true },
]

const exporting = ref(false)
async function exportList() {
  exporting.value = true
  try {
    const rows = await allTerritories({ sort: sort.value || STUDIO_DEFAULT_SORT, details: 1, ...queryOf(search.value.trim(), filters) })
    await exportToXlsx(rows.map(territory => ({
      [t('territories.fields.name')]: territory.name,
      [t('territories.fields.parent')]: territory.parent?.name ?? '',
      [t('territories.fields.sector')]: territory.sector ?? '',
      ...Object.fromEntries((territory.covers ?? []).map(cover => [cover.name, cover.items.map(item => item.name).join(', ')])),
      [t('territories.covers.residence')]: (territory.zones ?? []).map(zone => `${zone.name}: ${text.zone(zone.type)}`).join(', '),
      [t('territories.columns.people')]: (territory.people ?? []).map(row => personName(row.user)).join(', '),
      [t('territories.columns.hcps')]: territory.hcps_count ?? 0,
      [t('territories.fields.description')]: territory.description ?? '',
    })), `${t('territories.title')} ${today()}`, t('territories.title'))
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
  <div class="flex w-full flex-col gap-5" :class="canStore('territories') && 'max-md:pb-20'">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="text-sm text-dl-muted">{{ t('nav.workspaces.plan') }}</span>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('territories.title') }}</h1>
      </div>
      <div class="flex gap-2.5">
        <DlButton variant="outline" icon="tabler-file-spreadsheet" :loading="exporting" :disabled="!total" @click="exportList">{{ t('users.export') }}</DlButton>
        <DlButton v-if="canStore('territories')" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add">{{ t('territories.add.button') }}</DlButton>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
      <div role="tablist" :aria-label="t('territories.view')" class="inline-flex gap-1 rounded-2xl bg-dl-paper p-1">
        <button
          v-for="item in (['list', 'tree'] as const)"
          :key="item"
          type="button"
          role="tab"
          :aria-selected="view === item"
          class="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-semibold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
          :class="view === item ? 'bg-dl-ink text-dl-on-ink dark:bg-dl-fg dark:text-dl-mist' : 'text-dl-body hover:text-dl-fg'"
          @click="view = item"
        >
          {{ t(`territories.views.${item}`) }}
        </button>
      </div>
      <button
        v-if="counts?.nobody || filters.nobody === '1'"
        type="button"
        :aria-pressed="filters.nobody === '1'"
        class="inline-flex h-9 items-center gap-2 rounded-[11px] border px-3 text-[13px] font-semibold transition"
        :class="filters.nobody === '1' ? 'border-dl-ink bg-dl-ink text-dl-on-ink dark:border-dl-fg dark:bg-dl-fg dark:text-dl-mist' : 'border-dl-line bg-dl-paper text-dl-body'"
        @click="toggleNobody"
      >
        {{ t('territories.filter.nobody') }}<span class="tabular-nums" :class="filters.nobody === '1' ? 'text-dl-signal dark:text-dl-mist' : 'text-dl-pending'">{{ n(counts?.nobody ?? 0) }}</span>
      </button>
    </div>

    <div class="flex items-start gap-5">
      <div class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <div class="flex flex-wrap items-center gap-2.5">
          <DlInput v-model="search" type="search" icon="tabler-search" :label="t('territories.search')" :placeholder="t('territories.search')" hide-label class="w-full sm:max-w-xs" />
          <DlSelect v-model="filters.user" :label="t('territories.filter.person')" :options="userOptions" appearance="filter" />
          <DlSelect v-model="filters.wilaya" :label="t('hcps.fields.wilaya')" :options="wilayaOptions" appearance="filter" />
          <DlSelect v-model="filters.ruleType" :label="t('territories.filter.builtFrom')" :options="typeOptions" appearance="filter" />
        </div>

        <template v-if="view === 'list'">
          <DlDataList
            v-model:sort="sort"
            :default-sort="STUDIO_DEFAULT_SORT"
            :label="t('territories.title')"
            :columns="columns"
            :rows="items"
            :row-key="row => row.id"
            :selected-key="open ? selected?.id : null"
            :loading="loading"
            :compact="open"
            :empty-title="filtered ? t('geo.empty.search') : t('territories.empty')"
            @open="row => show(row.id)"
          >
            <template #cell-name="{ row }">
              <span class="flex min-w-0 flex-col">
                <strong class="font-semibold">{{ row.name }}</strong>
                <span class="truncate text-xs text-dl-muted">{{ text.position(row) }}</span>
              </span>
            </template>
            <template #cell-covers="{ row }">
              <span class="flex min-w-0 flex-col">
                <span class="truncate">{{ text.places(row) }}</span>
                <span class="truncate text-xs text-dl-muted">{{ text.counts(row) }}</span>
              </span>
            </template>
            <template #cell-people="{ row }">
              <span v-if="row.people?.length" class="flex items-center gap-2">
                <DlAvatar :name="personName(row.people[0]!.user)" size="sm" />
                <span class="flex min-w-0 flex-col">
                  <span class="truncate">{{ personName(row.people[0]!.user) }}<template v-if="row.people.length > 1"> +{{ row.people.length - 1 }}</template></span>
                  <span class="truncate text-xs text-dl-muted">{{ text.stint(row.people[0]!) }}</span>
                </span>
              </span>
              <span v-else class="text-[13px] font-semibold text-dl-pending">{{ t('territories.people.nobodyShort') }}</span>
            </template>
            <template #cell-hcps="{ row }"><span class="tabular-nums">{{ n(row.hcps_count ?? 0) }}</span></template>
            <template #cell-children="{ row }"><span class="tabular-nums">{{ row.children_count ? n(row.children_count) : '—' }}</span></template>
            <template #card="{ row }">
              <span class="flex items-center gap-3">
                <span class="flex min-w-0 flex-1 flex-col">
                  <strong class="truncate font-semibold">{{ row.name }}</strong>
                  <span class="truncate text-xs text-dl-muted">{{ text.places(row) }} · {{ t('territories.hcpsShort', { n: n(row.hcps_count ?? 0) }, row.hcps_count ?? 0) }}</span>
                  <span class="truncate text-xs" :class="row.people?.length ? 'text-dl-body' : 'font-semibold text-dl-pending'">{{ row.people?.length ? personName(row.people[0]!.user) : t('territories.people.nobodyShort') }}</span>
                </span>
              </span>
            </template>
          </DlDataList>
          <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
        </template>

        <template v-else>
          <div v-if="treeLoading && !tree.length" class="flex flex-col gap-2" aria-hidden="true">
            <DlSkeleton v-for="i in 4" :key="i" class="h-14 rounded-2xl" />
          </div>
          <p v-else-if="!tree.length" class="py-8 text-center text-sm text-dl-muted">{{ filtered ? t('geo.empty.search') : t('territories.empty') }}</p>
          <ul v-else class="flex flex-col gap-1.5" :aria-label="t('territories.views.tree')">
            <li v-for="row in tree" :key="row.territory.id" :style="{ marginInlineStart: `${Math.min(row.depth, 6) * 28}px` }">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-start text-[13.5px] transition hover:border-dl-body"
                :class="open && selected?.id === row.territory.id ? 'border-dl-ink bg-dl-signal-soft' : 'border-dl-line bg-dl-paper'"
                @click="show(row.territory.id)"
              >
                <span class="flex min-w-0 flex-1 flex-col">
                  <strong class="truncate font-semibold">{{ row.territory.name }}</strong>
                  <span class="truncate text-xs text-dl-muted">{{ text.places(row.territory) }} · {{ t('territories.hcpsShort', { n: n(row.territory.hcps_count ?? 0) }, row.territory.hcps_count ?? 0) }}</span>
                </span>
                <span v-if="row.territory.people?.length" class="flex items-center gap-2 max-sm:hidden">
                  <DlAvatar :name="personName(row.territory.people[0]!.user)" size="sm" />{{ personName(row.territory.people[0]!.user) }}
                </span>
                <span v-else class="text-[13px] font-semibold text-dl-pending">{{ t('territories.people.nobodyShort') }}</span>
              </button>
            </li>
          </ul>
        </template>
      </div>

      <TerritoryPanel v-if="selected" v-model:open="open" :territory="selected" @changed="onChanged" @deleted="onDeleted" @open="show" />
    </div>

    <div v-if="canStore('territories')" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
      <DlButton variant="primary" size="lg" icon="tabler-plus" block @click="add">{{ t('territories.add.button') }}</DlButton>
    </div>
  </div>
</template>
