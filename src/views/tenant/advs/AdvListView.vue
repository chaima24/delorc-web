<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ADV_TYPES, fetchAdvs, type Adv } from '@/api/tenant/advs'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useAuthStore } from '@/stores/auth'
import { STUDIO_DEFAULT_SORT, useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import AdvAddPanel from './AdvAddPanel.vue'
import { useAdvText } from './advDisplay'
import AdvPanel from './AdvPanel.vue'
import { useAdvLookups } from './useAdvLookups'

// Engager › Aides de visite: the presentations reps show in visits, by brand. The list, a side panel to read and
// change one, "Ajouter" in 3 steps. Mockup: docs/design/engage-mockups/Advs.html
const { t } = useI18n()
const auth = useAuthStore()
const text = useAdvText()
const { brands, teams } = useAdvLookups()
const canAdd = computed(() => auth.can('advs.create'))

const list = useStudioList<Adv, { brand: number | null; type: string | null; team: number | null; online: string | null }>(
  ({ page, perPage, search, sort, filters }) => fetchAdvs({
    page,
    per_page: perPage,
    sort,
    'filter[name]': search || undefined,
    'filter[brand_id]': filters.brand ?? undefined,
    'filter[type]': filters.type ?? undefined,
    'filter[team_id]': filters.team ?? undefined,
    'filter[online]': filters.online ?? undefined,
  }),
  { brand: null, type: null, team: null, online: null },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const ALL = 'all'
const pick = <K extends keyof typeof filters>(key: K, numeric = false) => computed({
  get: () => filters[key] ?? ALL,
  set: value => { filters[key] = (value === ALL || value == null ? null : numeric ? Number(value) : String(value)) as (typeof filters)[K] },
})
const brandFilter = pick('brand', true)
const typeFilter = pick('type')
const teamFilter = pick('team', true)
const onlineFilter = pick('online')
const typeOptions = computed(() => [{ value: ALL, label: t('advs.filter.allTypes') }, ...ADV_TYPES.map(value => ({ value, label: text.type(value) }))])
const onlineOptions = computed(() => [{ value: ALL, label: t('advs.filter.allStates') }, { value: '1', label: t('advs.state.online') }, { value: '0', label: t('advs.state.offline') }])
const filtering = computed(() => !!search.value || Object.values(filters).some(value => value != null))
function clearFilters() {
  search.value = ''
  Object.assign(filters, { brand: null, type: null, team: null, online: null })
}

/** Who gets it: its teams and specialities, or nobody. */
const audience = (adv: Adv) => [...adv.teams, ...adv.specialities].map(row => row.name)

const columns = computed(() => [
  { key: 'name', label: t('advs.columns.adv'), sortKey: 'name' },
  { key: 'type', label: t('advs.fields.type') },
  { key: 'content', label: t('advs.columns.content'), secondary: true },
  { key: 'audience', label: t('advs.columns.for') },
  { key: 'online', label: t('advs.columns.state') },
  { key: 'created_at', label: t('advs.columns.added'), sortKey: 'created_at', secondary: true },
])

// Side panel: read one, or add.
const open = ref(false)
const adding = ref(false)
const selectedId = ref<number | null>(null)
function show(row: Adv) {
  adding.value = false
  selectedId.value = row.id
  open.value = true
}
function add() {
  selectedId.value = null
  adding.value = true
  open.value = true
}
function onCreated(adv: Adv) {
  list.reload()
  show(adv)
}
function onDeleted() {
  open.value = false
  selectedId.value = null
  list.reload()
}
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5" :class="canAdd && 'max-md:pb-20'">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.engage') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('advs.title') }}</h1>
          <p class="text-[13px] text-dl-muted">{{ t('advs.subtitle') }}</p>
        </div>
        <DlButton v-if="canAdd" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add">{{ t('advs.add.button') }}</DlButton>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <div class="w-64 max-md:w-full"><DlInput v-model="search" :label="t('advs.filter.search')" :placeholder="t('advs.filter.search')" icon="tabler-search" hide-label /></div>
        <DlSelect v-model="brandFilter" :label="t('advs.fields.brand')" :options="[{ value: ALL, label: t('advs.filter.allBrands') }, ...brands]" appearance="filter" />
        <DlSelect v-model="typeFilter" :label="t('advs.fields.type')" :options="typeOptions" appearance="filter" />
        <DlSelect v-model="teamFilter" :label="t('advs.filter.team')" :options="[{ value: ALL, label: t('users.filter.allTeams') }, ...teams]" appearance="filter" />
        <DlSelect v-model="onlineFilter" :label="t('advs.columns.state')" :options="onlineOptions" appearance="filter" />
        <DlButton v-if="filtering" variant="ghost" icon="tabler-x" @click="clearFilters">{{ t('common.actions.resetFilters') }}</DlButton>
      </div>

      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          v-model:sort="sort"
          :default-sort="STUDIO_DEFAULT_SORT"
          :label="t('advs.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :selected-key="selectedId"
          :loading="loading"
          :compact="open"
          :empty-title="filtering ? t('geo.empty.search') : t('advs.empty.title')"
          :empty-text="filtering ? undefined : t('advs.empty.text')"
          @open="show"
        >
          <template #cell-name="{ row }">
            <span class="flex items-center gap-2.5" :class="!row.online && 'opacity-60'">
              <img v-if="row.main_slide?.url" :src="row.main_slide.url" alt="" class="shrink-0 rounded-lg object-cover" :class="row.orientation === 'vertical' ? 'h-12 w-9' : 'h-10 w-14'">
              <span class="min-w-0">
                <strong class="block truncate font-semibold">{{ row.name }}</strong>
                <small class="block truncate text-xs text-dl-muted">{{ row.brand?.name }}</small>
              </span>
            </span>
          </template>
          <template #cell-type="{ row }"><DlBadge size="sm" tone="info">{{ text.type(row.type) }}</DlBadge></template>
          <template #cell-content="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ text.content(row) }}</span></template>
          <template #cell-audience="{ row }">
            <span v-if="audience(row).length" class="flex flex-wrap gap-1">
              <DlBadge v-for="name in audience(row).slice(0, open ? 1 : 3)" :key="name" size="sm">{{ name }}</DlBadge>
              <DlBadge v-if="audience(row).length > (open ? 1 : 3)" size="sm">+{{ audience(row).length - (open ? 1 : 3) }}</DlBadge>
            </span>
            <DlBadge v-else size="sm" tone="warning">{{ t('advs.audience.nobodyShort') }}</DlBadge>
          </template>
          <template #cell-online="{ row }"><DlBadge size="sm" :tone="row.online ? 'success' : 'neutral'" dot>{{ t(`advs.state.${row.online ? 'online' : 'offline'}`) }}</DlBadge></template>
          <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ text.date(row.created_at) }}</span></template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.name }}</strong>
            <span class="text-xs text-dl-muted">{{ [row.brand?.name, text.type(row.type), t(`advs.state.${row.online ? 'online' : 'offline'}`)].filter(Boolean).join(' · ') }}</span>
          </template>
        </DlDataList>
        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>

      <div v-if="canAdd" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
        <DlButton variant="primary" icon="tabler-plus" block @click="add">{{ t('advs.add.button') }}</DlButton>
      </div>
    </div>

    <AdvAddPanel v-if="adding" v-model:open="open" @created="onCreated" />
    <AdvPanel v-else-if="selectedId" v-model:open="open" :adv-id="selectedId" @changed="list.reload()" @deleted="onDeleted" />
  </div>
</template>
