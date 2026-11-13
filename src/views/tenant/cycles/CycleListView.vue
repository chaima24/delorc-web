<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { fetchCycleBoard, fetchWholeBoard, type CycleBoardMeta, type CycleBoardRow } from '@/api/tenant/cycles'
import DlAvatar from '@/components/DlAvatar.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
import { exportToXlsx } from '@/composables/exportXlsx'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { roleLabel, useRolesAndTeams, useTeamOptions } from '@/views/tenant/settings/shared/lookups'
import { today } from '@/views/tenant/users/userDisplay'
import CyclePanel from './CyclePanel.vue'
import { shiftMonth, STATE_TONE, useCycleText } from './cycleDisplay'

// Planifier › Cycles (docs/api/cycles.md): one month at a time. Each person's professionals and goal, with the two
// warnings (ending with no next cycle, no cycle this month); coverage and pace come with visits.
// Mockup: docs/design/plan-mockups/Cycles.html
const { t, n } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const text = useCycleText()
const auth = useAuthStore()
const canStore = (resource: string) => auth.can(`${resource}.create`)
const { roles } = useRolesAndTeams()
const { teams } = useTeamOptions()

const ALL = 'all'
const month = ref(typeof route.query.month === 'string' && /^\d{4}-\d{2}$/.test(route.query.month) ? route.query.month : today().slice(0, 7))
const filters = reactive({ q: '', role: ALL as string | number, team: ALL as string | number })
/** "Ending without a next cycle" / "No cycle this month" quick views. */
const only = ref<'ending' | null>(null)
const page = ref(1)
const perPage = ref(25)
watch(month, () => router.replace({ query: { ...route.query, month: month.value } }))
watch([month, () => ({ ...filters }), only], () => { page.value = 1 }, { deep: true })

const rows = ref<CycleBoardRow[]>([])
const meta = ref<Omit<CycleBoardMeta, 'total'> | null>(null)
const total = ref(0)
const loading = ref(true)
let request = 0
async function load() {
  const mine = ++request
  loading.value = true
  try {
    const body = await fetchCycleBoard({ ...boardParams(), page: page.value, per_page: perPage.value })
    if (mine !== request) return
    rows.value = body.data
    meta.value = body.meta
    total.value = body.meta.total
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    if (mine === request) loading.value = false
  }
}
watch([month, page, perPage, () => ({ ...filters }), only], load, { immediate: true, deep: true })

function boardParams() {
  return {
    month: month.value,
    q: filters.q.trim() || undefined,
    role_id: filters.role === ALL ? undefined : Number(filters.role),
    team_id: filters.team === ALL ? undefined : Number(filters.team),
    ...(only.value === 'ending' && meta.value ? { ids: meta.value.ending_soon_cycles } : {}),
  }
}

const roleOptions = computed(() => [{ value: ALL, label: t('users.filter.allRoles') }, ...roles.value])
const teamOptions = computed(() => [{ value: ALL, label: t('users.filter.allTeams') }, ...teams.value])

const columns = computed(() => [
  { key: 'person', label: t('cycles.columns.person') },
  { key: 'territory', label: t('cycles.columns.territory'), secondary: true },
  { key: 'professionals', label: t('cycles.columns.professionals'), align: 'end' as const },
  { key: 'coverage', label: t('cycles.columns.coverage') },
  { key: 'visits', label: t('cycles.columns.visits') },
  { key: 'state', label: t('cycles.columns.state'), secondary: true },
])

// Side panel: one cycle; "No cycle this month": who is missing.
const open = ref(false)
const selectedId = ref<number | null>(null)
const showMissing = ref(false)
function show(row: CycleBoardRow) {
  showMissing.value = false
  selectedId.value = row.id
  open.value = true
}
function missing() {
  selectedId.value = null
  showMissing.value = true
  open.value = true
}
function onDeleted() {
  open.value = false
  selectedId.value = null
  load()
}

// Export: every cycle of the month matching the filters (all pages), in the viewer's language. Visit columns come with visits.
const exporting = ref(false)
async function exportList() {
  exporting.value = true
  try {
    const all = await fetchWholeBoard(boardParams())
    exportToXlsx(all.map(row => ({
      [t('cycles.columns.person')]: row.user?.full_name ?? '',
      [t('cycles.filter.role')]: roleLabel(row.user?.role?.name),
      [t('cycles.filter.team')]: row.user?.team?.name ?? '',
      [t('cycles.columns.territory')]: row.territory?.name ?? '',
      [t('cycles.dates.start')]: row.start_date,
      [t('cycles.dates.end')]: row.end_date,
      [t('cycles.columns.state')]: t(`cycles.state.${row.state}`),
      [t('cycles.columns.professionals')]: row.professionals,
      [t('cycles.export.goal')]: row.goal_visits,
      [t('cycles.create.noSegment')]: row.no_segment,
    })), `${t('cycles.title')} ${month.value}`, t('cycles.title'))
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    exporting.value = false
  }
}

const nextMonth = computed(() => shiftMonth(month.value, 1))
/** "Create cycles" opens on the month shown when it hasn't started yet, else on the next one. */
const createMonth = computed(() => (month.value > today().slice(0, 7) ? month.value : shiftMonth(today().slice(0, 7), 1)))
function createFor(userIds: number[]) {
  router.push({ name: 'tenant-cycle-create', query: { month: month.value, users: userIds.join(',') } })
}
</script>

<template>
  <div class="flex w-full flex-col gap-5" :class="canStore('cycles') && 'max-md:pb-20'">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="text-sm text-dl-muted">{{ t('nav.workspaces.plan') }}</span>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('cycles.title') }}</h1>
      </div>
      <div class="flex gap-2.5 max-md:hidden">
        <DlButton variant="outline" icon="tabler-download" :loading="exporting" :disabled="!total" @click="exportList">{{ t('cycles.export.button') }}</DlButton>
        <DlButton v-if="canStore('cycles')" variant="outline" icon="tabler-copy" :to="{ name: 'tenant-cycle-create', query: { prepare: month } }">{{ t('cycles.prepare.button', { month: text.month(nextMonth) }) }}</DlButton>
        <DlButton v-if="canStore('cycles')" variant="primary" icon="tabler-plus" :to="{ name: 'tenant-cycle-create', query: { month: createMonth } }">{{ t('cycles.create.button') }}</DlButton>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2.5">
      <span class="flex items-center gap-1 rounded-2xl bg-dl-paper p-1">
        <DlIconButton icon="tabler-chevron-left" variant="ghost" :size="34" :label="t('activities.month.previous')" class="rtl:-scale-x-100" @click="month = shiftMonth(month, -1)" />
        <strong class="min-w-36 px-2 text-center text-[13px] first-letter:uppercase" aria-live="polite">{{ text.month(month) }}</strong>
        <DlIconButton icon="tabler-chevron-right" variant="ghost" :size="34" :label="t('activities.month.next')" class="rtl:-scale-x-100" @click="month = shiftMonth(month, 1)" />
      </span>
      <span v-if="meta" class="inline-flex h-9 items-center gap-1.5 rounded-[11px] border border-dl-line bg-dl-paper px-3 text-[13px] font-semibold text-dl-body">
        {{ t('cycles.board.day', { day: n(meta.days_passed), total: n(meta.working_days) }) }}
      </span>
      <button
        v-if="meta?.ending_soon.length"
        type="button"
        class="inline-flex h-9 items-center gap-2 rounded-[11px] border px-3 text-[13px] font-semibold"
        :class="only === 'ending' ? 'border-dl-fg bg-dl-signal-soft text-dl-fg' : 'border-dl-line bg-dl-paper text-dl-body'"
        :aria-pressed="only === 'ending'"
        @click="only = only === 'ending' ? null : 'ending'"
      >
        <i class="h-2 w-2 rounded-full bg-dl-pending" />{{ t('cycles.board.endingSoon') }} <b class="text-dl-fg tabular-nums">{{ n(meta.ending_soon.length) }}</b>
      </button>
      <button
        v-if="meta?.without_cycle.length"
        type="button"
        class="inline-flex h-9 items-center gap-2 rounded-[11px] border border-dl-line bg-dl-paper px-3 text-[13px] font-semibold text-dl-body"
        @click="missing"
      >
        <i class="h-2 w-2 rounded-full bg-dl-pending" />{{ t('cycles.board.noCycle') }} <b class="text-dl-fg tabular-nums">{{ n(meta.without_cycle.length) }}</b>
      </button>
    </div>

    <div class="flex items-start gap-5">
      <div class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <div class="flex flex-wrap gap-2.5">
          <DlInput v-model="filters.q" type="search" icon="tabler-search" :label="t('cycles.filter.person')" :placeholder="t('cycles.filter.person')" hide-label class="w-full sm:max-w-60" />
          <DlSelect v-model="filters.role" :label="t('cycles.filter.role')" :options="roleOptions" appearance="filter" />
          <DlSelect v-model="filters.team" :label="t('cycles.filter.team')" :options="teamOptions" appearance="filter" />
        </div>

        <DlDataList
          :label="t('cycles.title')"
          :columns="columns"
          :rows="rows"
          :row-key="row => row.id"
          :selected-key="open ? selectedId : null"
          :loading="loading"
          :compact="open"
          :empty-title="t('cycles.empty.title', { month: text.month(month) })"
          :empty-text="t('cycles.empty.text')"
          @open="show"
        >
          <template #cell-person="{ row }">
            <span class="flex items-center gap-2.5">
              <DlAvatar :name="row.user?.full_name ?? '?'" :src="row.user?.avatar?.url" size="sm" />
              <span class="min-w-0">
                <strong class="block truncate font-semibold">{{ row.user?.full_name }}</strong>
                <small class="block truncate text-xs text-dl-muted">{{ text.roleTeam(row.user) }}</small>
              </span>
            </span>
          </template>
          <template #cell-territory="{ row }">{{ row.territory?.name ?? '—' }}</template>
          <template #cell-professionals="{ row }"><span class="tabular-nums">{{ n(row.professionals) }}</span></template>
          <template #cell-coverage><span class="text-[12.5px] text-dl-muted">{{ t('cycles.laterVisits') }}</span></template>
          <template #cell-visits="{ row }">
            <span class="text-[13px] text-dl-muted">{{ t('cycles.board.goal', { n: n(row.goal_visits) }) }}</span>
          </template>
          <template #cell-state="{ row }">
            <DlBadge size="sm" :tone="STATE_TONE[row.state]" :dot="row.state === 'running'">{{ text.state(row.state, row.start_date) }}</DlBadge>
          </template>
          <template #card="{ row }">
            <span class="flex items-center gap-2.5">
              <DlAvatar :name="row.user?.full_name ?? '?'" :src="row.user?.avatar?.url" size="sm" />
              <span class="min-w-0 flex-1">
                <strong class="block truncate font-semibold">{{ row.user?.full_name }}</strong>
                <small class="block truncate text-xs text-dl-muted">{{ t('cycles.board.goal', { n: n(row.goal_visits) }) }}</small>
              </span>
              <DlBadge size="sm" :tone="STATE_TONE[row.state]">{{ text.state(row.state, row.start_date) }}</DlBadge>
            </span>
          </template>
        </DlDataList>

        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </div>

      <CyclePanel v-if="selectedId && !showMissing" v-model:open="open" :cycle-id="selectedId" @deleted="onDeleted" @changed="load" />
      <DlRecordPanel v-else-if="showMissing && meta" v-model:open="open" :title="t('cycles.missing.title')" :description="text.month(month)">
        <div class="flex flex-col gap-3">
          <p class="rounded-xl bg-dl-mist px-3 py-2 text-[12.5px] text-dl-body">{{ t('cycles.missing.why') }}</p>
          <ul class="flex flex-col">
            <li v-for="person in meta.without_cycle" :key="person.id" class="flex items-center gap-2.5 border-b border-dl-line-soft py-2 text-[13px]">
              <DlAvatar :name="person.full_name" size="sm" />
              <span class="min-w-0 flex-1">
                <RouterLink :to="{ name: 'tenant-user-detail', params: { id: person.id } }" class="font-semibold text-dl-fg no-underline hover:underline">{{ person.full_name }}</RouterLink>
                <small class="block text-xs text-dl-muted">{{ text.roleTeam(person) }}</small>
              </span>
            </li>
          </ul>
        </div>
        <template v-if="canStore('cycles')" #footer>
          <DlButton variant="primary" icon="tabler-plus" class="flex-1" @click="createFor(meta.without_cycle.map(person => person.id))">
            {{ t('cycles.missing.create', meta.without_cycle.length) }}
          </DlButton>
        </template>
      </DlRecordPanel>
    </div>

    <div v-if="canStore('cycles')" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
      <DlButton variant="primary" size="lg" icon="tabler-plus" block :to="{ name: 'tenant-cycle-create', query: { month: createMonth } }">{{ t('cycles.create.button') }}</DlButton>
    </div>
  </div>
</template>
