<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  fetchObjective,
  fetchObjectives,
  fetchUncoveredPeople,
  OBJECTIVE_NUMBERS,
  type Objective,
  type ObjectiveState,
  type UncoveredPerson,
} from '@/api/tenant/objectives'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useAuthStore } from '@/stores/auth'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { useUserText } from '@/views/tenant/users/userDisplay'
import { numbersFor, objectiveState, useObjectiveText } from './objectiveDisplay'
import ObjectiveCreatePanel from './ObjectiveCreatePanel.vue'
import ObjectivePanel from './ObjectivePanel.vue'
import ObjectiveUncoveredPanel from './ObjectiveUncoveredPanel.vue'

// Planifier › Objectifs (docs/api/objectives-frequencies.md): what each person must do a day, by role and team (or all teams).
// A side panel to read one and change it from a date, "Add objective", and the people no row covers.
// Mockup: docs/design/plan-mockups/ObjectivesFrequencies.html
const { t, n } = useI18n()
const auth = useAuthStore()
const canStore = (resource: string) => auth.can(`${resource}.create`)
const text = useObjectiveText()
const dates = useUserText()

const ALL = 'all'
const rows = ref<Objective[]>([])
const loading = ref(true)
const state = ref<ObjectiveState>('current')
const role = ref<number | string>(ALL)
const uncovered = ref<UncoveredPerson[]>([])

async function load() {
  loading.value = true
  try {
    const [list, people] = await Promise.all([
      fetchObjectives(state.value),
      fetchUncoveredPeople(),
    ])
    rows.value = list
    uncovered.value = people
  }
  finally {
    loading.value = false
  }
}
load()
watch(state, load)

const shown = computed(() => role.value === ALL ? rows.value : rows.value.filter(row => row.role_id === Number(role.value)))
const roleOptions = computed(() => {
  const seen = new Map(rows.value.map(row => [row.role_id, roleLabel(row.role?.name)]))
  return [{ value: ALL, label: t('objectives.filter.allRoles') }, ...[...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))]
})
const stateOptions = computed(() => (['current', 'past', 'all'] as const).map(value => ({ value, label: t(`objectives.filter.${value}`) })))

// Panel: an objective, "Add objective" or the people with none.
type Panel = 'record' | 'add' | 'uncovered'
const open = ref(false)
const panel = ref<Panel>('record')
const selected = ref<Objective | null>(null)
const preset = ref<{ roleId: number | null; teamId: number | null } | null>(null)

async function show(row: Objective) {
  panel.value = 'record'
  selected.value = row
  open.value = true
  // The row has the list's fields; the panel also shows people, history and next month.
  const full = await fetchObjective(row.id)
  if (selected.value?.id === row.id) selected.value = full
}
function add(roleId: number | null = null) {
  preset.value = { roleId, teamId: null }
  selected.value = null
  panel.value = 'add'
  open.value = true
}
function showUncovered() {
  selected.value = null
  panel.value = 'uncovered'
  open.value = true
}
async function onSaved(objective: Objective) {
  await load()
  await show(objective)
}
function onDeleted() {
  open.value = false
  load()
}

/** A number this role doesn't need, or 0, reads "—". */
function cell(row: Objective, number: typeof OBJECTIVE_NUMBERS[number]) {
  return numbersFor(row.role?.visits).includes(number) && row[number] ? n(row[number]) : '—'
}
const stateTone = { current: 'success', upcoming: 'info', ended: 'neutral' } as const
const columns = computed(() => [
  { key: 'name', label: t('objectives.columns.roleTeam') },
  ...OBJECTIVE_NUMBERS.map(number => ({ key: number, label: text.number(number), align: 'end' as const, secondary: number === 'wholesaler' })),
  { key: 'since', label: t('objectives.columns.since'), secondary: true },
  { key: 'people', label: t('objectives.columns.people'), align: 'end' as const },
])
</script>

<template>
  <div class="flex w-full flex-col gap-5" :class="canStore('objectives') && 'max-md:pb-20'">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="text-sm text-dl-muted">{{ t('nav.workspaces.plan') }}</span>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('objectives.title') }}</h1>
        <p class="text-[13px] text-dl-muted">{{ t('objectives.subtitle') }}</p>
      </div>
      <DlButton v-if="canStore('objectives')" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add()">{{ t('objectives.add.button') }}</DlButton>
    </div>

    <div class="flex items-start gap-5">
      <div class="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
        <div class="flex flex-wrap items-center gap-2.5">
          <button
            v-if="uncovered.length"
            type="button"
            class="flex h-10 items-center gap-2 rounded-xl border border-dl-line bg-dl-paper px-3 text-[13px] font-semibold text-dl-body hover:bg-dl-line-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
            :class="open && panel === 'uncovered' && 'border-dl-fg'"
            @click="showUncovered"
          >
            <DlIcon icon="tabler-alert-circle" :size="16" class="text-dl-pending" />
            {{ t('objectives.uncovered.chip') }} <strong class="tabular-nums text-dl-fg">{{ n(uncovered.length) }}</strong>
          </button>
          <DlSelect v-model="role" :label="t('objectives.fields.role')" :options="roleOptions" appearance="filter" />
          <DlSelect v-model="state" :label="t('objectives.filter.show')" :options="stateOptions" appearance="filter" />
        </div>

        <DlDataList
          :label="t('objectives.title')"
          :columns="columns"
          :rows="shown"
          :row-key="row => row.id"
          :selected-key="panel === 'record' ? selected?.id : null"
          :loading="loading"
          :compact="open"
          :empty-title="t('objectives.empty')"
          @open="show"
        >
          <template #cell-name="{ row }">
            <span class="flex min-w-0 flex-col">
              <strong class="truncate font-semibold">{{ roleLabel(row.role?.name) }}</strong>
              <span class="truncate text-xs text-dl-muted">{{ text.team(row) }}</span>
            </span>
          </template>
          <template v-for="number in OBJECTIVE_NUMBERS" :key="number" #[`cell-${number}`]="{ row }">
            <span class="tabular-nums" :class="cell(row, number) === '—' && 'text-dl-muted'">{{ cell(row, number) }}</span>
          </template>
          <template #cell-since="{ row }">
            <span class="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
              {{ row.end_date ? dates.range(row.start_date, row.end_date) : dates.date(row.start_date) }}
              <DlBadge v-if="objectiveState(row) !== 'current'" size="sm" :tone="stateTone[objectiveState(row)]">{{ t(`objectives.state.${objectiveState(row)}`) }}</DlBadge>
            </span>
          </template>
          <template #cell-people="{ row }"><span class="tabular-nums">{{ n(row.people_count ?? 0) }}</span></template>
          <template #card="{ row }">
            <span class="flex flex-col gap-1">
              <span class="flex items-center justify-between gap-3">
                <strong class="truncate font-semibold">{{ text.name(row) }}</strong>
                <span class="text-xs text-dl-muted">{{ t('objectives.peopleCount', { count: n(row.people_count ?? 0) }, row.people_count ?? 0) }}</span>
              </span>
              <span class="text-xs text-dl-muted">
                {{ numbersFor(row.role?.visits).filter(number => row[number]).map(number => `${n(row[number])} ${t(`objectives.numbers.${number}Short`, row[number])}`).join(' · ') || t('objectives.read.allZero') }}
              </span>
            </span>
          </template>
        </DlDataList>
        <p class="text-xs text-dl-muted">{{ t('objectives.list.hint') }}</p>
      </div>

      <ObjectiveCreatePanel v-if="panel === 'add'" v-model:open="open" :preset="preset" @created="onSaved" />
      <ObjectiveUncoveredPanel v-else-if="panel === 'uncovered'" v-model:open="open" :people="uncovered" @add="add" />
      <ObjectivePanel v-else-if="selected" v-model:open="open" :objective="selected" @changed="onSaved" @deleted="onDeleted" />
    </div>

    <!-- Phone: "Add" sits at the bottom, in reach of the thumb -->
    <div v-if="canStore('objectives')" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
      <DlButton variant="primary" size="lg" icon="tabler-plus" block @click="add()">{{ t('objectives.add.button') }}</DlButton>
    </div>
  </div>
</template>
