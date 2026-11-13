<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { fetchCoachings, type Coaching } from '@/api/tenant/coaching'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import CoachingAddPanel from './CoachingAddPanel.vue'
import { STATE_TONE, useCoachingText } from './coachingDisplay'

// Coaching › Programmes: who coaches whom, when, with which sections. Search, state filter, every column sorts;
// a click opens the program's page. Mockup: docs/design/coaching-mockups/CoachingSetup.html (frames 3, 4)
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const text = useCoachingText()
const canAdd = computed(() => auth.can('coaching-setup.create'))

const ALL = 'all'
const list = useStudioList<Coaching, { state: string | null }>(
  ({ page, perPage, search, sort, filters }) => fetchCoachings({
    page,
    per_page: perPage,
    sort,
    'filter[search]': search || undefined,
    'filter[state]': filters.state ?? undefined,
  }),
  { state: null },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const state = computed({
  get: () => filters.state ?? ALL,
  set: value => { filters.state = value === ALL ? null : value },
})
const stateItems = computed(() => [ALL, 'current', 'upcoming', 'ended'].map(value => ({ value, label: t(`coaching.filter.${value}`) })))
const filtering = computed(() => !!search.value || filters.state != null)

const roles = (rows: { name: string }[]) => rows.map(role => roleLabel(role.name)).join(', ')
const columns = computed(() => [
  { key: 'name', label: t('coaching.columns.program'), sortKey: 'name' },
  { key: 'start_date', label: t('coaching.columns.dates'), sortKey: 'start_date' },
  { key: 'coaches', label: t('coaching.columns.coaches') },
  { key: 'coached', label: t('coaching.columns.coached') },
  { key: 'sections', label: t('coaching.columns.sections'), secondary: true },
  { key: 'open', label: t('coaching.columns.open'), secondary: true },
  { key: 'state', label: t('coaching.columns.state') },
  { key: 'created_at', label: t('studio.list.added'), sortKey: 'created_at', secondary: true },
])

const open = ref(false)
const openPage = (row: Coaching) => router.push({ name: 'tenant-coaching-detail', params: { id: row.id } })
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5" :class="canAdd && 'max-md:pb-20'">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.coaching') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('coaching.programs.title') }}</h1>
          <p class="text-[13px] text-dl-muted">{{ t('coaching.programs.subtitle') }}</p>
        </div>
        <DlButton v-if="canAdd" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="open = true">{{ t('coaching.add.button') }}</DlButton>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <div class="w-64 max-md:w-full"><DlInput v-model="search" :label="t('coaching.filter.search')" :placeholder="t('coaching.filter.search')" icon="tabler-search" hide-label /></div>
        <DlSegmented v-model="state" :label="t('coaching.columns.state')" :items="stateItems" />
        <DlButton v-if="filtering" variant="ghost" icon="tabler-x" @click="search = ''; filters.state = null">{{ t('common.actions.resetFilters') }}</DlButton>
      </div>

      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          v-model:sort="sort"
          default-sort="-start_date"
          :label="t('coaching.programs.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :loading="loading"
          :empty-title="filtering ? t('geo.empty.search') : t('coaching.programs.emptyTitle')"
          :empty-text="filtering ? undefined : t('coaching.programs.emptyText')"
          @open="openPage"
        >
          <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
          <template #cell-start_date="{ row }"><span class="whitespace-nowrap">{{ text.period(row.start_date, row.end_date) }}</span></template>
          <template #cell-coaches="{ row }">{{ roles(row.coach_roles) }}</template>
          <template #cell-coached="{ row }">
            <span class="flex flex-wrap gap-1"><DlBadge v-for="role in row.coached_roles" :key="role.id" size="sm">{{ roleLabel(role.name) }}</DlBadge></span>
          </template>
          <template #cell-sections="{ row }"><span class="text-dl-muted">{{ row.families.map(family => `${family.name} (${family.sections_count})`).join(', ') }}</span></template>
          <template #cell-open="{ row }"><span class="tabular-nums">{{ row.open_questions_count ?? 0 }}</span></template>
          <template #cell-state="{ row }"><DlBadge size="sm" :tone="STATE_TONE[row.state]" dot>{{ text.state(row.state) }}</DlBadge></template>
          <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ text.date(row.created_at) }}</span></template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.name }}</strong>
            <span class="text-xs text-dl-muted">{{ [text.period(row.start_date, row.end_date), roles(row.coached_roles), text.state(row.state)].join(' · ') }}</span>
          </template>
        </DlDataList>
        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>

      <div v-if="canAdd" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
        <DlButton variant="primary" icon="tabler-plus" block @click="open = true">{{ t('coaching.add.button') }}</DlButton>
      </div>
    </div>

    <CoachingAddPanel v-if="open" v-model:open="open" @created="openPage" />
  </div>
</template>
