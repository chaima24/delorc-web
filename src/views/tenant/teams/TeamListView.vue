<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchAllBrands } from '@/api/tenant/brands'
import { fetchSpecialities } from '@/api/tenant/customerSetup'
import type { ListParams } from '@/api/tenant/geography'
import { fetchTeam, fetchTeams, type Team } from '@/api/tenant/teams'
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
import TeamCreatePanel from './TeamCreatePanel.vue'
import TeamPanel from './TeamPanel.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'

// Studio › Teams: list, a side panel to read and edit a team, "Add a team" in 2 steps.
// Mockup: docs/design/studio-mockups/Teams.html
const { t, n } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const specialities = ref<{ id: number; name: string }[]>([])
const brands = ref<{ id: number; name: string }[]>([])
onMountedAndFocus(async () => {
  const [specialityPage, brandRows] = await Promise.all([fetchSpecialities({ per_page: 100, sort: 'name' }), fetchAllBrands()])
  specialities.value = specialityPage.items
  brands.value = brandRows
})

const ALL = 'all'
type Filters = { status: string; speciality: number | null; brand: number | null }

function queryOf(search: string, filters: Filters): ListParams {
  return {
    'filter[q]': search || undefined,
    'filter[status]': filters.status === ALL ? undefined : Number(filters.status),
    'filter[speciality]': filters.speciality ?? undefined,
    'filter[brand]': filters.brand ?? undefined,
  }
}

const list = useStudioList<Team, Filters>(
  ({ page, perPage, search, sort, filters }) => fetchTeams({ page, per_page: perPage, sort, ...queryOf(search, filters) }),
  { status: ALL, speciality: null, brand: null },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

/** A select bound to a nullable id filter ("all" = no filter). */
function idFilter(key: 'speciality' | 'brand') {
  return computed({
    get: () => filters[key] ?? ALL,
    set: value => { filters[key] = value === ALL || value == null ? null : Number(value) },
  })
}
const specialityFilter = idFilter('speciality')
const brandFilter = idFilter('brand')
const byName = (rows: { id: number; name: string }[]) =>
  rows.map(row => ({ value: row.id, label: row.name })).sort((a, b) => a.label.localeCompare(b.label))
const statusOptions = computed(() => [
  { value: ALL, label: t('teams.filter.allStatuses') },
  { value: '1', label: t('teams.status.active') },
  { value: '0', label: t('teams.status.inactive') },
])
const specialityOptions = computed(() => [{ value: ALL, label: t('teams.filter.allSpecialities') }, ...byName(specialities.value)])
const brandOptions = computed(() => [{ value: ALL, label: t('teams.filter.allBrands') }, ...byName(brands.value)])
const filtered = computed(() => !!(search.value || filters.status !== ALL || filters.speciality || filters.brand))

// Panel: a team (reading mode) or "Add a team".
const open = ref(false)
const selected = ref<Team | null>(null)
const adding = ref(false)

async function show(row: Team) {
  adding.value = false
  selected.value = row
  open.value = true
  // The row has the list's fields; the panel also shows past members, creator and uses.
  const full = await fetchTeam(row.id)
  if (selected.value?.id === row.id) selected.value = full
}
function add() {
  selected.value = null
  adding.value = true
  open.value = true
}
async function onCreated(team: Team) {
  list.reload()
  await show(team)
}
function onChanged(team: Team) {
  selected.value = team
  list.reload()
}
function onDeleted() {
  open.value = false
  list.reload()
}

const MAX_CHIPS = 2
const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('teams.columns.team'), sortKey: 'name' },
  { key: 'members', label: t('teams.columns.members'), sortKey: 'members_count' },
  { key: 'specialities', label: t('teams.columns.specialities') },
  { key: 'brands', label: t('teams.columns.brands'), secondary: true },
  { key: 'status', label: t('teams.columns.status') },
  { ...added.column, secondary: true },
]

/** Every page of the list, 100 rows at a time. */
async function allRows(): Promise<Team[]> {
  const rows: Team[] = []
  for (let pageNumber = 1; ; pageNumber++) {
    const result = await fetchTeams({ page: pageNumber, per_page: 100, sort: sort.value || STUDIO_DEFAULT_SORT, ...queryOf(search.value.trim(), filters) })
    rows.push(...result.items)
    if (!result.items.length || rows.length >= result.total) return rows
  }
}

// Export: every team matching the filters (all pages), in the viewer's language.
const exporting = ref(false)
async function exportList() {
  exporting.value = true
  try {
    const rows = await allRows()
    await exportToXlsx(rows.map(team => ({
      [t('teams.fields.name')]: team.name,
      [t('teams.fields.descriptionShort')]: team.description ?? '',
      [t('teams.columns.members')]: team.members_count ?? 0,
      [t('teams.columns.specialities')]: (team.specialities ?? []).map(row => row.name).join(', '),
      [t('teams.columns.brands')]: (team.brands ?? []).map(row => row.name).join(', '),
      [t('teams.columns.status')]: t(team.status ? 'teams.status.active' : 'teams.status.inactive'),
      [t('studio.list.added')]: team.created_at?.slice(0, 10) ?? '',
    })), `${t('teams.title')} ${today()}`, t('teams.title'))
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
  <!-- As the mockup (studio-mockups/Teams.html): the panel sits beside the whole column (title + list), from the top. -->
  <div class="flex w-full items-start gap-5" :class="auth.can('teams.create') && 'max-md:pb-20'">
    <div class="flex min-w-0 flex-1 flex-col gap-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.studio') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('teams.title') }}</h1>
        </div>
        <div class="flex gap-2.5">
          <DlButton variant="outline" icon="tabler-file-spreadsheet" :loading="exporting" :disabled="!total" @click="exportList">{{ t('users.export') }}</DlButton>
          <DlButton v-if="auth.can('teams.create')" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add">{{ t('teams.add.button') }}</DlButton>
        </div>
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <div class="flex flex-wrap items-center gap-2.5">
          <DlInput
            v-model="search"
            type="search"
            icon="tabler-search"
            :label="t('teams.search')"
            :placeholder="t('teams.search')"
            hide-label
            class="w-full sm:max-w-xs"
          />
          <DlSelect v-model="filters.status" :label="t('teams.columns.status')" :options="statusOptions" appearance="filter" />
          <DlSelect v-model="specialityFilter" :label="t('teams.filter.speciality')" :options="specialityOptions" appearance="filter" />
          <DlSelect v-model="brandFilter" :label="t('teams.filter.brand')" :options="brandOptions" appearance="filter" />
        </div>

        <DlDataList
          v-model:sort="sort"
          :default-sort="STUDIO_DEFAULT_SORT"
          :label="t('teams.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :selected-key="selected?.id"
          :loading="loading"
          :compact="open"
          :empty-title="filtered ? t('geo.empty.search') : t('teams.empty')"
          @open="show"
        >
          <template #cell-name="{ row }">
            <span class="flex min-w-0 flex-col">
              <strong class="truncate font-semibold">{{ row.name }}</strong>
              <span v-if="!open && row.description" class="truncate text-xs text-dl-muted">{{ row.description }}</span>
            </span>
          </template>
          <template #cell-members="{ row }">
            <span v-if="row.members_count" class="flex items-center gap-2">
              <span class="flex">
                <DlAvatar
                  v-for="person in row.members"
                  :key="person.id"
                  :name="person.full_name"
                  :src="person.avatar?.url"
                  size="sm"
                  class="ring-2 ring-dl-paper not-first:-ms-1.5"
                />
              </span>
              <strong class="tabular-nums">{{ n(row.members_count) }}</strong>
            </span>
            <span v-else class="text-dl-muted">{{ t('teams.list.nobody') }}</span>
          </template>
          <template #cell-specialities="{ row }">
            <span class="flex flex-wrap gap-1">
              <DlBadge v-for="item in row.specialities?.slice(0, open ? 1 : MAX_CHIPS)" :key="item.id" size="sm">{{ item.name }}</DlBadge>
              <DlBadge v-if="(row.specialities?.length ?? 0) > (open ? 1 : MAX_CHIPS)" size="sm">+{{ n(row.specialities!.length - (open ? 1 : MAX_CHIPS)) }}</DlBadge>
            </span>
          </template>
          <template #cell-brands="{ row }">
            <span v-if="row.brands?.length" class="flex flex-wrap gap-1">
              <DlBadge v-for="item in row.brands.slice(0, MAX_CHIPS)" :key="item.id" size="sm">{{ item.name }}</DlBadge>
              <DlBadge v-if="row.brands.length > MAX_CHIPS" size="sm">+{{ n(row.brands.length - MAX_CHIPS) }}</DlBadge>
            </span>
            <span v-else class="text-dl-muted">—</span>
          </template>
          <template #cell-status="{ row }">
            <DlBadge size="sm" dot :tone="row.status ? 'success' : 'neutral'">{{ t(row.status ? 'teams.status.active' : 'teams.status.inactive') }}</DlBadge>
          </template>
          <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
          <template #card="{ row }">
            <span class="flex flex-col gap-1">
              <span class="flex items-center justify-between gap-3">
                <strong class="truncate font-semibold">{{ row.name }}</strong>
                <DlBadge size="sm" dot :tone="row.status ? 'success' : 'neutral'">{{ t(row.status ? 'teams.status.active' : 'teams.status.inactive') }}</DlBadge>
              </span>
              <span class="text-xs text-dl-muted">
                {{ t('teams.list.summary', { members: n(row.members_count ?? 0), specialities: n(row.specialities?.length ?? 0), brands: n(row.brands?.length ?? 0) }) }}
              </span>
            </span>
          </template>
        </DlDataList>

        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>
    </div>

    <TeamCreatePanel v-if="adding" v-model:open="open" @created="onCreated" />
    <TeamPanel v-else-if="selected" v-model:open="open" :team="selected" @changed="onChanged" @deleted="onDeleted" />

    <!-- Phone: "Add" sits at the bottom, in reach of the thumb -->
    <div v-if="auth.can('teams.create')" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
      <DlButton variant="primary" size="lg" icon="tabler-plus" block @click="add">{{ t('teams.add.button') }}</DlButton>
    </div>
  </div>
</template>
