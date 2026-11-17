<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { fetchCampaigns } from '@/api/tenant/campaigns'
import { fetchActivityTypes } from '@/api/tenant/fieldSetup'
import { fetchActionProgress, type OwnAction, type ProgressRow } from '@/api/tenant/marketingActions'
import { fetchAllTeams } from '@/api/tenant/teams'
import DlDataList from '@/components/DlDataList.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { refreshOnFocus } from '@/composables/refreshOnFocus'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { useCampaignText } from '@/views/tenant/campaigns/campaignDisplay'
import ActionProgress from './ActionProgress.vue'

// Engager › Actions marketing (docs/api/marketing-actions.md, mockup frames 4 to 6): planned vs done of the people the
// viewer sees, by person (a row opens their actions beside the list) or by activity type. Someone who sees only
// themself (a rep) gets « Mes actions marketing »: one card per action with their progress.
const { t, n } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const text = useCampaignText()

type Option = { value: number | string; label: string }
const ALL = 'all'
const campaigns = ref<Option[]>([])
const teams = ref<Option[]>([])
const types = ref<Option[]>([])
function loadLists() {
  Promise.all([fetchCampaigns({ page: 1, per_page: 100, sort: '-start_date' }), auth.can('teams.show') ? fetchAllTeams() : Promise.resolve([]), auth.can('activity-types.show') ? fetchActivityTypes({ page: 1, per_page: 100, sort: 'activity' }) : Promise.resolve({ items: [] })])
    .then(([c, tm, ty]) => {
      campaigns.value = c.items.map(row => ({ value: row.id, label: row.name }))
      teams.value = tm.map(row => ({ value: row.id, label: row.name }))
      types.value = ty.items.map(row => ({ value: row.id, label: row.activity }))
    }).catch(() => undefined)
}
loadLists()
refreshOnFocus(loadLists)

const group = ref<'person' | 'type'>('person')
const campaignId = ref<string | number>(ALL)
const teamId = ref<string | number>(ALL)
const typeId = ref<string | number>(ALL)
const state = ref('current')
const page = ref(1)
const perPage = ref(25)
const rows = ref<ProgressRow[]>([])
const total = ref(0)
const loading = ref(true)
/** null until known; true when the viewer sees only themself. */
const own = ref<boolean | null>(null)
const mine = ref<OwnAction[]>([])
const pick = (value: string | number) => (value === ALL ? undefined : value)
const filters = () => ({ 'filter[campaign_id]': pick(campaignId.value), 'filter[team_id]': pick(teamId.value), 'filter[activity_type_id]': pick(typeId.value), 'filter[state]': state.value })

async function load() {
  loading.value = true
  try {
    const answer = await fetchActionProgress({ group: group.value, page: page.value, per_page: perPage.value, ...filters() })
    rows.value = answer.items
    total.value = answer.total
    if (own.value === null) {
      own.value = !auth.can('campaigns.update') && group.value === 'person' && answer.items.every(row => 'user' in row && row.user.id === auth.user?.id)
    }
    if (own.value) mine.value = (await fetchActionProgress<OwnAction>({ group: 'action', per_page: 100, ...filters() })).items
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    loading.value = false
  }
}
watch([group, campaignId, teamId, typeId, state], () => { page.value = 1 })
watch([group, campaignId, teamId, typeId, state, page, perPage], load, { immediate: true })

const groupItems = computed(() => [{ value: 'person', label: t('actions.progress.byPerson') }, { value: 'type', label: t('actions.progress.byType') }])
const stateItems = computed(() => [{ value: 'current', label: t('actions.progress.current') }, { value: 'past', label: t('actions.progress.past') }])
const withAll = (label: string, items: Option[]) => [{ value: ALL, label }, ...items]
const columns = computed(() => group.value === 'person'
  ? [
      { key: 'name', label: t('actions.columns.person') },
      { key: 'team', label: t('actions.columns.team') },
      { key: 'actions', label: t('actions.columns.actions'), align: 'end' as const },
      { key: 'progress', label: t('actions.columns.progress') },
    ]
  : [
      { key: 'name', label: t('actions.columns.type') },
      { key: 'actions', label: t('actions.columns.actions'), align: 'end' as const },
      { key: 'progress', label: t('actions.columns.progress') },
    ])
const rowKey = (row: ProgressRow) => ('user' in row ? `u${row.user.id}` : `t${row.activity_type.id}`)
const rowName = (row: ProgressRow) => ('user' in row ? row.user.full_name : row.activity_type.name)

// By person: a row opens their actions beside the list.
const person = ref<{ id: number; name: string } | null>(null)
const personActions = ref<OwnAction[] | null>(null)
const panelOpen = computed({ get: () => person.value !== null, set: value => { if (!value) person.value = null } })
async function open(row: ProgressRow) {
  if (!('user' in row)) return
  person.value = { id: row.user.id, name: row.user.full_name }
  personActions.value = null
  personActions.value = (await fetchActionProgress<OwnAction>({ group: 'action', per_page: 100, ...filters(), 'filter[user_id]': row.user.id }).catch(() => ({ items: [] }))).items
}
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5">
      <div class="flex flex-col gap-1.5">
        <span class="text-sm text-dl-muted">{{ t('nav.workspaces.engage') }}</span>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ own ? t('actions.progress.mineTitle') : t('actions.progress.title') }}</h1>
        <p class="text-[13px] text-dl-muted">{{ own ? t('actions.progress.mineSubtitle') : t('actions.progress.subtitle') }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <DlSegmented v-if="!own" v-model="group" :label="t('actions.progress.group')" :items="groupItems" />
        <DlSelect v-model="campaignId" :label="t('actions.columns.campaign')" :options="withAll(t('actions.progress.allCampaigns'), campaigns)" appearance="filter" />
        <DlSelect v-if="!own && teams.length" v-model="teamId" :label="t('actions.columns.team')" :options="withAll(t('actions.progress.allTeams'), teams)" appearance="filter" />
        <DlSelect v-if="!own && types.length" v-model="typeId" :label="t('actions.columns.type')" :options="withAll(t('actions.progress.allTypes'), types)" appearance="filter" />
        <DlSegmented v-model="state" :label="t('actions.progress.state')" :items="stateItems" />
      </div>

      <template v-if="own">
        <DlSkeleton v-if="loading" class="h-32 rounded-3xl" />
        <p v-else-if="!mine.length" class="rounded-3xl bg-dl-paper p-6 text-[13px] text-dl-muted">{{ t('actions.progress.mineNone') }}</p>
        <div v-else class="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="row in mine" :key="row.id" class="flex flex-col gap-2.5 rounded-3xl bg-dl-paper p-4">
            <strong class="text-base">{{ row.activity_type }}</strong>
            <span class="text-xs text-dl-muted">{{ [row.campaign.name, text.period(row.start_date, row.end_date), row.wilaya].filter(Boolean).join(' · ') }}</span>
            <ActionProgress :done="row.done" :planned="row.planned" />
            <span class="text-xs text-dl-muted">{{ row.done >= row.planned ? t('actions.progress.reached') : t('actions.progress.left', { count: n(row.planned - row.done) }, row.planned - row.done) }}</span>
          </div>
        </div>
        <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('actions.progress.mineNote') }}</p>
      </template>

      <div v-else class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList :label="t('actions.progress.title')" :columns="columns" :rows="rows" :row-key="rowKey" :loading="loading"
          :empty-title="t('actions.progress.emptyTitle')" :empty-text="t('actions.progress.emptyText')" @open="open">
          <template #cell-name="{ row }"><strong class="font-semibold">{{ rowName(row) }}</strong></template>
          <template #cell-team="{ row }">{{ 'team' in row ? row.team ?? '—' : '' }}</template>
          <template #cell-actions="{ row }"><span class="tabular-nums">{{ n(row.actions) }}</span></template>
          <template #cell-progress="{ row }"><ActionProgress :done="row.done" :planned="row.planned" /></template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ rowName(row) }}</strong>
            <span class="text-xs text-dl-muted">{{ n(row.done) }} / {{ n(row.planned) }} · {{ row.rate }} %</span>
          </template>
        </DlDataList>
        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
        <p class="text-xs text-dl-muted">{{ group === 'person' ? t('actions.progress.personNote') : t('actions.progress.typeNote') }}</p>
      </div>
    </div>

    <DlRecordPanel v-if="person" v-model:open="panelOpen" :title="person.name" :description="t('actions.progress.panelHint')">
      <DlSkeleton v-if="!personActions" class="h-32 rounded-2xl" />
      <p v-else-if="!personActions.length" class="text-[13px] text-dl-muted">{{ t('actions.progress.mineNone') }}</p>
      <RouterLink v-for="row in personActions ?? []" :key="row.id" :to="{ name: 'tenant-marketing-action', params: { id: row.campaign.id, actionId: row.id } }"
        class="mb-2 flex flex-col gap-1.5 rounded-2xl bg-dl-mist px-3 py-2.5 text-dl-fg no-underline">
        <strong class="text-sm">{{ row.activity_type }}</strong>
        <span class="text-xs text-dl-muted">{{ row.campaign.name }} · {{ text.period(row.start_date, row.end_date) }}</span>
        <ActionProgress :done="row.done" :planned="row.planned" />
      </RouterLink>
    </DlRecordPanel>
  </div>
</template>
