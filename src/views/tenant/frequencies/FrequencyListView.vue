<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  fetchFrequencyGrid,
  fetchFrequencyGrids,
  fetchPeopleWithoutGrid,
  type FrequencyGrid,
  type FrequencyGridRef,
} from '@/api/tenant/frequencies'
import { fetchSegmentations, type Segmentation } from '@/api/tenant/customerSetup'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useAuthStore } from '@/stores/auth'
import { objectiveState } from '@/views/tenant/objectives/objectiveDisplay'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { useUserText } from '@/views/tenant/users/userDisplay'
import FrequencyCreatePanel from './FrequencyCreatePanel.vue'
import FrequencyGridCard from './FrequencyGridCard.vue'
import { type GridLine, type GridValues, refOf } from './frequencyDisplay'

// Planifier › Fréquences (docs/api/objectives-frequencies.md): how many times each professional of a cycle is visited during the cycle.
// One grid per role + team (or all teams): lines (specialities, kinds, all the others) × segments.
// Mockup: docs/design/plan-mockups/ObjectivesFrequencies.html (frames 7–8)
const { t, n } = useI18n()
const auth = useAuthStore()
const canStore = (resource: string) => auth.can(`${resource}.create`)
const dates = useUserText()
// The cycle segments are the grid's columns.
const segmentations = ref<Segmentation[]>([])
fetchSegmentations({ per_page: 100, sort: 'position', 'filter[type]': 'cycle_target' }).then(page => { segmentations.value = page.items })

const grids = ref<FrequencyGrid[]>([])
const uncovered = ref<{ id: number; full_name: string; role: { id: number; name: string } | null }[]>([])
const loading = ref(true)
const state = ref<'current' | 'past' | 'all'>('current')
const stateOptions = computed(() => (['current', 'past', 'all'] as const).map(value => ({ value, label: t(`objectives.filter.${value}`) })))
const segments = computed(() => [...segmentations.value].sort((a, b) => a.position - b.position))

async function load() {
  loading.value = true
  try {
    const [list, people] = await Promise.all([fetchFrequencyGrids(state.value), fetchPeopleWithoutGrid()])
    grids.value = list
    uncovered.value = people
  }
  finally {
    loading.value = false
  }
}
watch(state, load)

/** People with no grid today, by role ("KAM · No grid yet · 2 people"). */
const missing = computed(() => {
  const groups = new Map<number, { roleId: number; role: string; people: string[] }>()
  for (const person of uncovered.value) {
    if (!person.role) continue
    const group = groups.get(person.role.id) ?? { roleId: person.role.id, role: roleLabel(person.role.name), people: [] }
    group.people.push(person.full_name)
    groups.set(person.role.id, group)
  }
  return [...groups.values()].sort((a, b) => a.role.localeCompare(b.role))
})

// The grid on the right: a saved one, or a new one being filled.
const selected = ref<FrequencyGrid | null>(null)
const draft = ref<{ role: { id: number; name: string; visits: string[] }; team: { id: number; name: string } | null; start_date: string; lines: GridLine[]; values: GridValues } | null>(null)
const selectedKey = computed(() => selected.value?.key ?? null)

async function open(gridRef: FrequencyGridRef) {
  draft.value = null
  adding.value = false
  const preview = grids.value.find(grid => grid.role_id === gridRef.role_id && grid.team_id === gridRef.team_id && grid.start_date === gridRef.start_date)
  if (preview) selected.value = preview
  selected.value = await fetchFrequencyGrid(gridRef)
}
async function refresh(grid?: FrequencyGrid) {
  await load()
  if (grid) await open(refOf(grid))
  else if (grids.value[0]) await open(refOf(grids.value[0]))
  else selected.value = null
}
load().then(() => grids.value[0] && open(refOf(grids.value[0])))

// "New grid" panel, then the grid is filled on the right.
const adding = ref(false)
const preset = ref<{ roleId: number | null } | null>(null)
function add(roleId: number | null = null) {
  preset.value = { roleId }
  adding.value = true
}
function startDraft(value: NonNullable<typeof draft.value>) {
  adding.value = false
  selected.value = null
  draft.value = value
}
function cancelDraft() {
  draft.value = null
  if (grids.value[0]) open(refOf(grids.value[0]))
}

function subtitle(grid: FrequencyGrid) {
  const specialities = grid.lines.filter(line => line.speciality).length
  const since = grid.end_date ? dates.range(grid.start_date, grid.end_date) : t('objectives.period.since', { date: dates.date(grid.start_date) })
  return `${since} · ${t('frequencies.list.specialities', { count: n(specialities) }, specialities)}`
}
const stateTone = { current: 'success', upcoming: 'info', ended: 'neutral' } as const
</script>

<template>
  <div class="flex w-full flex-col gap-5" :class="canStore('frequencies') && 'max-md:pb-20'">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="text-sm text-dl-muted">{{ t('nav.workspaces.plan') }}</span>
        <h1 class="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">{{ t('frequencies.title') }}</h1>
        <p class="text-[13px] text-dl-muted">{{ t('frequencies.subtitle') }}</p>
      </div>
      <DlButton v-if="canStore('frequencies')" variant="primary" icon="tabler-plus" class="max-md:hidden" @click="add()">{{ t('frequencies.add.button') }}</DlButton>
    </div>

    <div class="grid items-start gap-4 lg:grid-cols-[300px_1fr]">
      <!-- The grids -->
      <aside class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-2" :aria-label="t('frequencies.title')">
        <div class="px-2 pt-1">
          <DlSelect v-model="state" :label="t('objectives.filter.show')" :options="stateOptions" appearance="filter" />
        </div>
        <template v-if="loading && !grids.length">
          <DlSkeleton v-for="i in 3" :key="i" class="h-14 rounded-xl" />
        </template>
        <button
          v-for="grid in grids"
          :key="grid.key"
          type="button"
          class="flex flex-col gap-0.5 rounded-xl px-3 py-2.5 text-start hover:bg-dl-line-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
          :class="selectedKey === grid.key && 'bg-dl-signal-soft hover:bg-dl-signal-soft'"
          :aria-current="selectedKey === grid.key"
          @click="open(refOf(grid))"
        >
          <span class="flex items-center gap-2">
            <strong class="flex-1 truncate text-sm font-semibold">{{ roleLabel(grid.role?.name) }} · {{ grid.team?.name ?? t('objectives.allTeams') }}</strong>
            <DlBadge v-if="objectiveState(grid) !== 'current'" size="sm" :tone="stateTone[objectiveState(grid)]">{{ t(`objectives.state.${objectiveState(grid)}`) }}</DlBadge>
          </span>
          <span class="text-xs text-dl-muted">{{ subtitle(grid) }}</span>
          <span class="text-xs text-dl-muted">{{ t('objectives.peopleCount', { count: n(grid.people_count ?? 0) }, grid.people_count ?? 0) }}</span>
        </button>
        <p v-if="!loading && !grids.length" class="px-3 py-2 text-[13px] text-dl-muted">{{ t('frequencies.empty') }}</p>

        <div v-for="group in missing" :key="group.roleId" class="flex flex-col gap-0.5 rounded-xl px-3 py-2.5">
          <strong class="text-sm font-semibold">{{ group.role }}</strong>
          <span class="flex items-center gap-1.5 text-xs text-dl-pending">
            <DlIcon icon="tabler-alert-circle" :size="14" />{{ t('frequencies.list.noGrid', { count: n(group.people.length) }, group.people.length) }}
          </span>
          <span class="truncate text-xs text-dl-muted">{{ group.people.join(', ') }}</span>
          <button v-if="canStore('frequencies')" type="button" class="self-start text-xs font-semibold text-dl-cobalt hover:underline" @click="add(group.roleId)">
            {{ t('frequencies.list.addFor', { role: group.role }) }}
          </button>
        </div>
      </aside>

      <!-- The grid -->
      <div class="flex min-w-0 items-start gap-4">
        <FrequencyGridCard
          v-if="selected || draft"
          class="flex-1"
          :grid="draft ? null : selected"
          :draft="draft"
          :segments="segments"
          @saved="refresh"
          @deleted="refresh()"
          @cancel="cancelDraft"
          @version="start => selected && open({ ...refOf(selected), start_date: start })"
        />
        <div v-else-if="!loading" class="flex-1 rounded-3xl bg-dl-paper p-6">
          <DlEmptyState :title="t('frequencies.empty')" :description="t('frequencies.emptyText')" />
        </div>
        <FrequencyCreatePanel v-if="adding" v-model:open="adding" :grids="grids" :preset="preset" @start="startDraft" />
      </div>
    </div>

    <!-- Phone: "New grid" sits at the bottom, in reach of the thumb -->
    <div v-if="canStore('frequencies')" class="fixed inset-x-4 bottom-24 z-800 md:hidden">
      <DlButton variant="primary" size="lg" icon="tabler-plus" block @click="add()">{{ t('frequencies.add.button') }}</DlButton>
    </div>
  </div>
</template>
