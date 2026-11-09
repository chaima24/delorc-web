<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchBrand, fetchBrands, type Brand } from '@/api/tenant/brands'
import type { ListParams } from '@/api/tenant/geography'
import { fetchAllTeams, type Team } from '@/api/tenant/teams'
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
import BrandCreatePanel from './BrandCreatePanel.vue'
import BrandPanel from './BrandPanel.vue'

// Studio › Brands: list, a side panel to read and edit a brand, "Add a brand".
// Mockup: docs/design/studio-mockups/Brands.html
const { t, n } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const teams = ref<Team[]>([])
onMounted(async () => { teams.value = await fetchAllTeams() })

const ALL = 'all'
type Filters = { team: number | null }

function queryOf(search: string, filters: Filters): ListParams {
  return { 'filter[q]': search || undefined, 'filter[team]': filters.team ?? undefined }
}

const list = useStudioList<Brand, Filters>(
  ({ page, perPage, search, sort, filters }) => fetchBrands({ page, per_page: perPage, sort, ...queryOf(search, filters) }),
  { team: null },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const teamFilter = computed({
  get: () => filters.team ?? ALL,
  set: value => { filters.team = value === ALL || value == null ? null : Number(value) },
})
const teamOptions = computed(() => [
  { value: ALL, label: t('users.filter.allTeams') },
  ...teams.value.map(team => ({ value: team.id, label: team.name })).sort((a, b) => a.label.localeCompare(b.label)),
])
const filtered = computed(() => !!(search.value || filters.team))

// Panel: a brand (reading mode) or "Add a brand".
const open = ref(false)
const selected = ref<Brand | null>(null)
const adding = ref(false)

async function show(row: Brand) {
  adding.value = false
  selected.value = row
  open.value = true
  // The row has the list's fields; the panel also shows products and what uses the brand.
  const full = await fetchBrand(row.id)
  if (selected.value?.id === row.id) selected.value = full
}
function add() {
  selected.value = null
  adding.value = true
  open.value = true
}
async function onCreated(brand: Brand) {
  list.reload()
  await show(brand)
}
function onChanged(brand: Brand) {
  selected.value = brand
  list.reload()
}
function onDeleted() {
  open.value = false
  list.reload()
}

const MAX_CHIPS = 2
const added = useAddedColumn()
const columns = [
  { key: 'name', label: t('brands.columns.brand'), sortKey: 'name' },
  { key: 'products', label: t('brands.columns.products'), sortKey: 'products_count' },
  { key: 'teams', label: t('brands.columns.teams') },
  { ...added.column, secondary: true },
]

/** Every page of the list, 100 rows at a time. */
async function allRows(): Promise<Brand[]> {
  const rows: Brand[] = []
  for (let pageNumber = 1; ; pageNumber++) {
    const result = await fetchBrands({ page: pageNumber, per_page: 100, sort: sort.value || STUDIO_DEFAULT_SORT, ...queryOf(search.value.trim(), filters) })
    rows.push(...result.items)
    if (!result.items.length || rows.length >= result.total) return rows
  }
}

// Export: every brand matching the filters (all pages), in the viewer's language.
const exporting = ref(false)
async function exportList() {
  exporting.value = true
  try {
    const rows = await allRows()
    await exportToXlsx(rows.map(brand => ({
      [t('brands.fields.name')]: brand.name,
      [t('brands.columns.products')]: brand.products_count ?? 0,
      [t('brands.columns.teams')]: (brand.teams ?? []).map(team => team.name).join(', '),
      [t('studio.list.added')]: brand.created_at?.slice(0, 10) ?? '',
    })), `${t('brands.title')} ${today()}`, t('brands.title'))
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
  <!-- As the mockup (studio-mockups/Brands.html): the panel sits beside the whole column (title + list), from the top. -->
  <div class="flex w-full items-start gap-5" :class="auth.can('brands.create') && 'max-md:pb-20'">
    <div class="flex min-w-0 flex-1 flex-col gap-5">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.studio') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('brands.title') }}</h1>
        </div>
        <div class="flex gap-2.5">
          <DlButton variant="outline" icon="tabler-file-spreadsheet" :loading="exporting" :disabled="!total" @click="exportList">{{ t('users.export') }}</DlButton>
          <DlButton v-if="auth.can('brands.create')" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add">{{ t('brands.add.button') }}</DlButton>
        </div>
      </div>

      <div class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <div class="flex flex-wrap items-center gap-2.5">
          <DlInput
            v-model="search"
            type="search"
            icon="tabler-search"
            :label="t('brands.search')"
            :placeholder="t('brands.search')"
            hide-label
            class="w-full sm:max-w-xs"
          />
          <DlSelect v-model="teamFilter" :label="t('users.columns.team')" :options="teamOptions" appearance="filter" />
        </div>

        <DlDataList
          v-model:sort="sort"
          :default-sort="STUDIO_DEFAULT_SORT"
          :label="t('brands.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :selected-key="selected?.id"
          :loading="loading"
          :compact="open"
          :empty-title="filtered ? t('geo.empty.search') : t('brands.empty')"
          @open="show"
        >
          <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
          <template #cell-products="{ row }">
            <strong v-if="row.products_count" class="tabular-nums">{{ n(row.products_count) }}</strong>
            <span v-else class="text-dl-muted">{{ t('brands.list.none') }}</span>
          </template>
          <template #cell-teams="{ row }">
            <span v-if="row.teams?.length" class="flex flex-wrap gap-1">
              <DlBadge v-for="team in row.teams.slice(0, open ? 1 : MAX_CHIPS)" :key="team.id" size="sm">{{ team.name }}</DlBadge>
              <DlBadge v-if="row.teams.length > (open ? 1 : MAX_CHIPS)" size="sm">+{{ n(row.teams.length - (open ? 1 : MAX_CHIPS)) }}</DlBadge>
            </span>
            <span v-else class="text-dl-muted">{{ t('brands.list.noTeam') }}</span>
          </template>
          <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ added.format(row.created_at) }}</span></template>
          <template #card="{ row }">
            <span class="flex flex-col gap-1">
              <strong class="truncate font-semibold">{{ row.name }}</strong>
              <span class="text-xs text-dl-muted">
                {{ t('brands.list.summary', { products: n(row.products_count ?? 0), teams: row.teams?.map(team => team.name).join(', ') || t('brands.list.noTeam') }) }}
              </span>
            </span>
          </template>
        </DlDataList>

        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>
    </div>

    <BrandCreatePanel v-if="adding" v-model:open="open" @created="onCreated" />
    <BrandPanel v-else-if="selected" v-model:open="open" :brand="selected" @changed="onChanged" @deleted="onDeleted" />

    <!-- Phone: "Add" sits at the bottom, in reach of the thumb -->
    <div v-if="auth.can('brands.create')" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
      <DlButton variant="primary" size="lg" icon="tabler-plus" block @click="add">{{ t('brands.add.button') }}</DlButton>
    </div>
  </div>
</template>
