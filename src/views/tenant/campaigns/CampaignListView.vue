<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { fetchCampaigns, type Campaign } from '@/api/tenant/campaigns'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useAuthStore } from '@/stores/auth'
import { useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import CampaignAddPanel from './CampaignAddPanel.vue'
import CampaignSettingsPanel from './CampaignSettingsPanel.vue'
import { STATE_TONE, useCampaignText } from './campaignDisplay'
import { useCampaignLookups } from './useCampaignLookups'

// Engager › Campagnes: code, name, dates, teams, ticks of the grid, state, added on. Search, team and state filters,
// every column sorts; a click opens the campaign. Mockup: docs/design/campaigns-mockups/Campaigns.html (frames 1, 2, 10)
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const text = useCampaignText()
const { teams } = useCampaignLookups()
const canAdd = computed(() => auth.can('campaigns.create'))
const canSet = computed(() => auth.can('campaigns.update'))

const ALL = 'all'
const list = useStudioList<Campaign, { state: string | null; team_id: number | null }>(
  ({ page, perPage, search, sort, filters }) => fetchCampaigns({
    page,
    per_page: perPage,
    sort,
    'filter[search]': search || undefined,
    'filter[state]': filters.state ?? undefined,
    'filter[team_id]': filters.team_id ?? undefined,
  }),
  { state: null, team_id: null },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const state = computed({
  get: () => filters.state ?? ALL,
  set: value => { filters.state = value === ALL ? null : value },
})
const stateItems = computed(() => [ALL, 'current', 'upcoming', 'ended'].map(value => ({ value, label: t(`campaigns.filter.${value}`) })))
const team = computed({
  get: () => filters.team_id ?? ALL,
  set: value => { filters.team_id = value === ALL || value == null ? null : Number(value) },
})
const teamItems = computed(() => [{ value: ALL, label: t('campaigns.filter.allTeams') }, ...teams.value])
const filtering = computed(() => !!search.value || filters.state != null || filters.team_id != null)
const reset = () => { search.value = ''; filters.state = null; filters.team_id = null }

const columns = computed(() => [
  { key: 'code', label: t('campaigns.columns.code'), sortKey: 'code' },
  { key: 'name', label: t('campaigns.columns.campaign'), sortKey: 'name' },
  { key: 'start_date', label: t('campaigns.columns.dates'), sortKey: 'start_date' },
  { key: 'teams', label: t('campaigns.columns.teams') },
  { key: 'ticks_count', label: t('campaigns.columns.ticks'), sortKey: 'ticks_count', align: 'end' as const, secondary: true },
  { key: 'state', label: t('campaigns.columns.state') },
  { key: 'created_at', label: t('studio.list.added'), sortKey: 'id', secondary: true },
])

const adding = ref(false)
const setting = ref(false)
const openPage = (row: Campaign) => router.push({ name: 'tenant-campaign', params: { id: row.id } })
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5" :class="canAdd && 'max-md:pb-20'">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.engage') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('campaigns.list.title') }}</h1>
          <p class="text-[13px] text-dl-muted">{{ t('campaigns.list.subtitle') }}</p>
        </div>
        <div class="flex gap-2.5">
          <DlButton v-if="canSet" variant="outline" icon="tabler-settings" @click="setting = true">{{ t('campaigns.settings.button') }}</DlButton>
          <DlButton v-if="canAdd" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="adding = true">{{ t('campaigns.add.button') }}</DlButton>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <div class="w-64 max-md:w-full"><DlInput v-model="search" :label="t('campaigns.filter.search')" :placeholder="t('campaigns.filter.search')" icon="tabler-search" hide-label /></div>
        <DlSelect v-model="team" :label="t('campaigns.columns.teams')" :options="teamItems" appearance="filter" />
        <DlSegmented v-model="state" :label="t('campaigns.columns.state')" :items="stateItems" />
        <DlButton v-if="filtering" variant="ghost" icon="tabler-x" @click="reset">{{ t('common.actions.resetFilters') }}</DlButton>
      </div>

      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          v-model:sort="sort"
          default-sort="-id"
          :label="t('campaigns.list.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :loading="loading"
          :empty-title="filtering ? t('geo.empty.search') : t('campaigns.list.emptyTitle')"
          :empty-text="filtering ? undefined : t('campaigns.list.emptyText')"
          @open="openPage"
        >
          <template #cell-code="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ row.code }}</span></template>
          <template #cell-name="{ row }"><strong class="font-semibold">{{ row.name }}</strong></template>
          <template #cell-start_date="{ row }"><span class="whitespace-nowrap">{{ text.period(row.start_date, row.end_date) }}</span></template>
          <template #cell-teams="{ row }">
            <span class="flex flex-wrap gap-1"><DlBadge v-for="item in row.teams" :key="item.id" size="sm">{{ item.name }}</DlBadge></span>
          </template>
          <template #cell-ticks_count="{ row }"><span class="tabular-nums">{{ row.ticks_count ?? 0 }}</span></template>
          <template #cell-state="{ row }"><DlBadge size="sm" :tone="STATE_TONE[row.state]" dot>{{ text.state(row.state) }}</DlBadge></template>
          <template #cell-created_at="{ row }"><span class="whitespace-nowrap text-dl-muted">{{ text.date(row.created_at) }}</span></template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.code }} · {{ row.name }}</strong>
            <span class="text-xs text-dl-muted">{{ [text.period(row.start_date, row.end_date), row.teams.map(item => item.name).join(', '), text.state(row.state)].join(' · ') }}</span>
          </template>
        </DlDataList>
        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>

      <div v-if="canAdd" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
        <DlButton variant="primary" icon="tabler-plus" block @click="adding = true">{{ t('campaigns.add.button') }}</DlButton>
      </div>
    </div>

    <CampaignAddPanel v-if="adding" v-model:open="adding" @created="openPage" />
    <CampaignSettingsPanel v-if="setting" v-model:open="setting" />
  </div>
</template>
