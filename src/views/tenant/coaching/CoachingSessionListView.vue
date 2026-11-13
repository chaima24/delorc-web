<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { fetchCoachingSessionCounts, fetchCoachingSessions, type CoachingSession, type CoachingSessionPage } from '@/api/tenant/coaching'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { useStudioList } from '@/views/tenant/settings/shared/useStudioList'
import { SESSION_TONE, sessionState, useSessionText } from './coachingDisplay'
import CoachingSessionPlanPanel from './CoachingSessionPlanPanel.vue'

// Coaching › Séances: a coach's sessions with their team, or the sessions a person received. Four figures,
// search, state and month filters; a click opens the session. Mockup: docs/design/coaching-mockups/CoachingSessions.html (frames 1, 2)
const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const text = useSessionText()
const canPlan = computed(() => auth.can('coaching-sessions.create'))

const ALL = 'all'
const list = useStudioList<CoachingSession, { state: string | null; month: string | null }>(
  ({ page, perPage, search, sort, filters }) => fetchCoachingSessions({
    page,
    per_page: perPage,
    sort,
    'filter[search]': search || undefined,
    'filter[state]': filters.state ?? undefined,
    'filter[month]': filters.month ?? undefined,
  }),
  { state: null, month: null },
)
const { page, perPage, search, sort, filters, items, total, loading } = list
list.reload()

const counts = ref({ planned: 0, late: 0, validated: 0, refused: 0 })
const loadCounts = async () => { counts.value = await fetchCoachingSessionCounts() }
loadCounts()
const figures = computed(() => (['planned', 'late', 'validated', 'refused'] as const).map(key => ({ key, value: counts.value[key] })))

const STATES = ['planned', 'late', 'validated', 'accepted', 'refused', 'cancelled'] as const
const state = computed({
  get: () => filters.state ?? ALL,
  set: value => { filters.state = value === ALL || value == null ? null : String(value) },
})
const stateOptions = computed(() => [{ value: ALL, label: t('coaching.sessions.filter.all') }, ...STATES.map(value => ({ value, label: t(`coaching.sessions.state.${value}`) }))])
const month = computed({ get: () => filters.month ?? '', set: value => { filters.month = value ? String(value) : null } })
const filtering = computed(() => !!search.value || filters.state != null || filters.month != null)

const columns = computed(() => [
  { key: 'date', label: t('coaching.sessions.columns.day'), sortKey: 'date' },
  { key: 'person', label: t('coaching.sessions.columns.person') },
  { key: 'coach', label: t('coaching.sessions.columns.coach'), secondary: true },
  { key: 'program', label: t('coaching.columns.program'), secondary: true },
  { key: 'state', label: t('coaching.columns.state') },
  { key: 'score', label: t('coaching.sessions.columns.score'), sortKey: 'score', align: 'end' as const },
])

const open = ref(false)
const openPage = (row: CoachingSession | CoachingSessionPage) => router.push({ name: 'tenant-coaching-session', params: { id: row.id } })
</script>

<template>
  <div class="flex w-full items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-5" :class="canPlan && 'max-md:pb-20'">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1.5">
          <span class="text-sm text-dl-muted">{{ t('nav.workspaces.coaching') }}</span>
          <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('coaching.sessions.title') }}</h1>
          <p class="text-[13px] text-dl-muted">{{ t(canPlan ? 'coaching.sessions.subtitleCoach' : 'coaching.sessions.subtitlePerson') }}</p>
        </div>
        <DlButton v-if="canPlan" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="open = true">{{ t('coaching.sessions.plan.button') }}</DlButton>
      </div>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <button
          v-for="figure in figures"
          :key="figure.key"
          type="button"
          class="rounded-2xl bg-dl-paper px-4 py-3.5 text-start hover:ring-1 hover:ring-dl-line"
          :class="filters.state === figure.key && 'ring-2 ring-dl-fg hover:ring-2 hover:ring-dl-fg'"
          @click="filters.state = filters.state === figure.key ? null : figure.key"
        >
          <b class="block font-display text-[28px] leading-none" :class="figure.key === 'late' && figure.value > 0 && 'text-dl-pending'">{{ figure.value }}</b>
          <span class="text-xs text-dl-muted">{{ t(`coaching.sessions.figures.${figure.key}`) }}</span>
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <div class="w-64 max-md:w-full"><DlInput v-model="search" :label="t('coaching.sessions.filter.search')" :placeholder="t('coaching.sessions.filter.search')" icon="tabler-search" hide-label /></div>
        <DlSelect v-model="state" :label="t('coaching.columns.state')" :options="stateOptions" appearance="filter" />
        <div class="w-44"><DlInput v-model="month" type="month" :label="t('coaching.sessions.filter.month')" hide-label /></div>
        <DlButton v-if="filtering" variant="ghost" icon="tabler-x" @click="search = ''; filters.state = null; filters.month = null">{{ t('common.actions.resetFilters') }}</DlButton>
      </div>

      <div class="flex min-w-0 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <DlDataList
          v-model:sort="sort"
          default-sort="-date"
          :label="t('coaching.sessions.title')"
          :columns="columns"
          :rows="items"
          :row-key="row => row.id"
          :loading="loading"
          :empty-title="filtering ? t('geo.empty.search') : t('coaching.sessions.emptyTitle')"
          :empty-text="filtering ? undefined : t(canPlan ? 'coaching.sessions.emptyCoach' : 'coaching.sessions.emptyPerson')"
          @open="openPage"
        >
          <template #cell-date="{ row }"><span class="whitespace-nowrap">{{ text.day(row.date) }}</span></template>
          <template #cell-person="{ row }">
            <strong class="block font-semibold">{{ row.medical_rep.full_name }}</strong>
            <small class="text-xs text-dl-muted">{{ [roleLabel(row.medical_rep.role), row.medical_rep.team].filter(Boolean).join(' · ') }}</small>
          </template>
          <template #cell-coach="{ row }">{{ row.coach.full_name }}</template>
          <template #cell-program="{ row }"><span class="text-dl-muted">{{ row.coaching.name }}</span></template>
          <template #cell-state="{ row }"><DlBadge size="sm" :tone="SESSION_TONE[sessionState(row)]" dot>{{ text.state(row) }}</DlBadge></template>
          <template #cell-score="{ row }"><strong class="tabular-nums">{{ text.score(row.score) }}</strong></template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.medical_rep.full_name }}</strong>
            <span class="text-xs text-dl-muted">{{ [text.day(row.date), text.state(row), row.score == null ? null : text.score(row.score)].filter(Boolean).join(' · ') }}</span>
          </template>
        </DlDataList>
        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>

      <div v-if="canPlan" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
        <DlButton variant="primary" icon="tabler-plus" block @click="open = true">{{ t('coaching.sessions.plan.button') }}</DlButton>
      </div>
    </div>

    <CoachingSessionPlanPanel v-if="open" v-model:open="open" @created="openPage" />
  </div>
</template>
