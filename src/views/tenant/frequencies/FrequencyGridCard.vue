<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { fetchSpecialities, type Segmentation, type Speciality } from '@/api/tenant/customerSetup'
import {
  changeFrequencyGrid,
  createFrequencyGrid,
  deleteFrequencyGrid,
  type FrequencyGrid,
} from '@/api/tenant/frequencies'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlCombobox from '@/components/DlCombobox.vue'
import DlIcon from '@/components/DlIcon.vue'
import DlInput from '@/components/DlInput.vue'
import DlMenu from '@/components/DlMenu.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { dayAfter, nextMonthStart, objectiveState } from '@/views/tenant/objectives/objectiveDisplay'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { useUserText } from '@/views/tenant/users/userDisplay'
import {
  cellsOf,
  LINE_KINDS,
  type GridLine,
  type GridValues,
  refOf,
  sortLines,
  valuesOf,
} from './frequencyDisplay'

// One grid: specialities / kinds / "all the others" × segments → visits per cycle.
// Read it, "Change from a date…" (editable, changed cells show the old value), or fill a new one.
// Mockup: docs/design/plan-mockups/ObjectivesFrequencies.html (frames 7–8)
const props = defineProps<{
  /** The saved grid (read / change), or null with `draft` for a new one. */
  grid: FrequencyGrid | null
  draft?: { role: { id: number; name: string; visits: string[] }; team: { id: number; name: string } | null; start_date: string; lines: GridLine[]; values: GridValues } | null
  segments: Segmentation[]
}>()
const emit = defineEmits<{ saved: [grid: FrequencyGrid]; deleted: []; cancel: []; version: [start: string] }>()
const { t, n } = useI18n()
const dates = useUserText()
const toast = useToast()
const { confirm } = useConfirm()
const auth = useAuthStore()
const canUpdate = (resource: string) => auth.can(`${resource}.update`)
const canDelete = (resource: string) => auth.can(`${resource}.delete`)
const specialities = ref<Speciality[]>([])
fetchSpecialities({ per_page: 100, sort: 'name' }).then(page => { specialities.value = page.items })

const isNew = computed(() => !props.grid)
const editing = ref(false)
const from = ref('')
const lines = ref<GridLine[]>([])
const values = ref<GridValues>({})
const errors = ref<Record<string, string>>({})
const saving = ref(false)

function reset() {
  editing.value = isNew.value
  errors.value = {}
  lines.value = sortLines(props.grid ? props.grid.lines : props.draft?.lines ?? [])
  values.value = JSON.parse(JSON.stringify(props.grid ? valuesOf(props.grid.cells) : props.draft?.values ?? {}))
}
watch(() => [props.grid, props.draft], reset, { immediate: true })

const role = computed(() => props.grid?.role ?? props.draft?.role ?? null)
const team = computed(() => props.grid ? props.grid.team : props.draft?.team ?? null)
const title = computed(() => `${roleLabel(role.value?.name)} · ${team.value?.name ?? t('objectives.allTeams')}`)
const state = computed(() => props.grid ? objectiveState(props.grid) : null)
const stateTone = { current: 'success', upcoming: 'info', ended: 'neutral' } as const
const segmentIds = computed(() => props.segments.map(segment => segment.id))
const previous = computed(() => props.grid ? valuesOf(props.grid.cells) : null)
const versions = computed(() => props.grid?.versions ?? [])
const isLatest = computed(() => !versions.value.some(row => props.grid && row.start_date > props.grid.start_date))
const canChange = computed(() => !!props.grid && canUpdate('frequencies') && isLatest.value && state.value !== 'ended')

function lineLabel(line: GridLine) {
  return line.speciality?.name ?? (line.hcp_type ? t(`frequencies.kinds.${line.hcp_type}`) : t('frequencies.otherLine'))
}

function startChange() {
  if (!props.grid) return
  const start = props.grid.start_date.slice(0, 10)
  const next = nextMonthStart()
  from.value = state.value === 'upcoming' ? start : next > start ? next : dayAfter(start)
  reset()
  editing.value = true
}
function cancel() {
  if (isNew.value) emit('cancel')
  else reset()
}

function setValue(line: GridLine, segmentId: number, raw: string) {
  const parsed = Number.parseInt(raw, 10)
  values.value = { ...values.value, [line.key]: { ...values.value[line.key], [segmentId]: Number.isNaN(parsed) || parsed < 0 ? 0 : Math.min(parsed, 99) } }
}
const changed = (line: GridLine, segmentId: number) =>
  !!previous.value && editing.value && (previous.value[line.key]?.[segmentId] ?? 0) !== (values.value[line.key]?.[segmentId] ?? 0)

// ── Lines ───────────────────────────────────────────────────
const newLine = ref<string | number | null>(null)
const lineOptions = computed(() => {
  const taken = new Set(lines.value.map(line => line.key))
  return [
    ...LINE_KINDS.filter(kind => !taken.has(`k:${kind}`)).map(kind => ({ value: `k:${kind}`, label: t(`frequencies.kinds.${kind}`) })),
    ...specialities.value
      .filter(speciality => !taken.has(`s:${speciality.id}`))
      .map(speciality => ({ value: `s:${speciality.id}`, label: speciality.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ]
})
watch(newLine, key => {
  if (!key) return
  const value = String(key)
  const speciality = value.startsWith('s:') ? specialities.value.find(row => `s:${row.id}` === value) : null
  lines.value = sortLines([...lines.value, {
    key: value,
    speciality: speciality ? { id: speciality.id, name: speciality.name } : null,
    hcp_type: value.startsWith('k:') ? value.slice(2) : null,
  }])
  newLine.value = null
})
function removeLine(line: GridLine) {
  lines.value = lines.value.filter(row => row.key !== line.key)
}

// ── Save ────────────────────────────────────────────────────
async function save() {
  saving.value = true
  errors.value = {}
  const cells = cellsOf(lines.value, values.value, segmentIds.value)
  try {
    const saved = props.grid
      ? await changeFrequencyGrid(refOf(props.grid), { from: from.value, cells })
      : await createFrequencyGrid({ role_id: props.draft!.role.id, team_id: props.draft!.team?.id ?? null, start_date: props.draft!.start_date, cells })
    toast.success(props.grid ? t('objectives.change.done', { date: dates.date(from.value) }) : t('frequencies.add.done'))
    editing.value = false
    emit('saved', saved)
  }
  catch (error) {
    // The API's messages come translated; a cell's message shows under the grid ("cells.3.frequency" → cells).
    errors.value = Object.fromEntries(Object.entries(fieldErrors(error)).map(([key, message]) => [key.split('.')[0], message]))
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}

// ── Delete ──────────────────────────────────────────────────
const menuItems = computed(() => props.grid && canDelete('frequencies') && !editing.value
  ? [{ label: t('common.actions.delete'), icon: 'tabler-trash', danger: true, onSelect: remove }]
  : [])
async function remove() {
  if (!props.grid) return
  const grid = props.grid
  const previousVersion = versions.value.find(row => row.end_date && dayAfter(row.end_date) === grid.start_date)
  const ok = await confirm({
    title: t('studio.list.delete.title', { name: title.value }),
    text: previousVersion ? t('objectives.delete.previousRunsOn', { date: dates.date(previousVersion.start_date) }) : t('frequencies.delete.text'),
    confirmButtonText: t('common.actions.delete'),
    icon: 'warning',
  })
  if (!ok) return
  try {
    await deleteFrequencyGrid(refOf(grid))
    toast.success(t('studio.list.toast.deleted'))
    emit('deleted')
  }
  catch (error) {
    // A grid a cycle uses is refused (with cycles): the API says why.
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
</script>

<template>
  <section class="flex min-w-0 flex-col gap-4 rounded-3xl bg-dl-paper p-4 md:p-5">
    <header class="flex flex-wrap items-start gap-3">
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <h2 class="font-display text-xl font-extrabold">{{ isNew ? t('frequencies.add.newTitle', { name: title }) : title }}</h2>
        <span class="flex flex-wrap items-center gap-1.5 text-xs text-dl-muted">
          <DlBadge v-if="state" size="sm" dot :tone="stateTone[state]">{{ t(`objectives.state.${state}`) }}</DlBadge>
          <template v-if="grid">
            {{ grid.end_date ? dates.range(grid.start_date, grid.end_date) : t('objectives.period.since', { date: dates.date(grid.start_date) }) }}
            · {{ t('objectives.peopleCount', { count: n(grid.people_count ?? 0) }, grid.people_count ?? 0) }}
          </template>
          <template v-else-if="draft">{{ t('objectives.period.from', { date: dates.date(draft.start_date) }) }}</template>
        </span>
      </div>
      <DlInput
        v-if="editing && grid"
        v-model="from"
        type="date"
        :label="t('frequencies.change.from')"
        :error="errors.from"
        class="w-48"
      />
      <DlButton v-else-if="canChange" variant="outline" size="sm" icon="tabler-calendar-plus" @click="startChange">{{ t('objectives.change.button') }}</DlButton>
      <DlMenu v-if="menuItems.length" :label="t('fieldSetup.menu.label')" :items="menuItems" />
    </header>

    <div class="overflow-x-auto">
      <table class="w-full min-w-[480px] border-collapse text-[13.5px]">
        <thead>
          <tr class="text-xs text-dl-muted">
            <th class="py-2 pe-3 text-start font-semibold">{{ t('frequencies.columns.line') }}</th>
            <th v-for="segment in segments" :key="segment.id" class="px-1 py-2 text-center font-semibold">
              <span class="inline-flex items-center gap-1.5 rounded-lg border border-dl-line px-2 py-0.5 text-dl-fg">
                <span class="h-2.5 w-2.5 rounded-[3px]" :style="{ background: segment.color }" />{{ segment.name }}
              </span>
            </th>
            <th v-if="editing" class="w-8" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="line in lines" :key="line.key" class="border-t border-dl-line-soft">
            <td class="py-2.5 pe-3">
              <span class="flex flex-col">
                <span :class="!line.speciality && !line.hcp_type && 'italic'">{{ lineLabel(line) }}</span>
                <span v-if="!line.speciality && !line.hcp_type" class="text-xs text-dl-muted">{{ t('frequencies.otherLineHint') }}</span>
              </span>
            </td>
            <td v-for="segment in segments" :key="segment.id" class="px-1 py-2 text-center">
              <input
                v-if="editing"
                :value="values[line.key]?.[segment.id] ?? 0"
                type="number"
                inputmode="numeric"
                min="0"
                max="99"
                :aria-label="`${lineLabel(line)} · ${segment.name}`"
                class="h-9 w-14 rounded-[10px] border bg-dl-paper text-center font-semibold tabular-nums focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
                :class="changed(line, segment.id) ? 'border-2 border-dl-fg bg-dl-signal-soft' : 'border-dl-line'"
                @input="setValue(line, segment.id, ($event.target as HTMLInputElement).value)"
              >
              <span
                v-else
                class="inline-flex h-9 w-14 items-center justify-center rounded-[10px] border font-semibold tabular-nums"
                :class="values[line.key]?.[segment.id] ? 'border-dl-line' : 'border-dashed border-dl-line text-dl-muted'"
              >{{ n(values[line.key]?.[segment.id] ?? 0) }}</span>
              <span v-if="changed(line, segment.id)" class="block text-[11px] text-dl-muted">{{ t('objectives.change.was', { value: n(previous?.[line.key]?.[segment.id] ?? 0) }) }}</span>
            </td>
            <td v-if="editing" class="text-end">
              <button
                v-if="line.key !== 'other'"
                type="button"
                :aria-label="t('frequencies.lines.remove', { name: lineLabel(line) })"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-dl-muted hover:bg-dl-line-soft hover:text-dl-fg"
                @click="removeLine(line)"
              >
                <DlIcon icon="tabler-x" :size="16" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!segments.length" class="py-3 text-[13px] text-dl-muted">{{ t('frequencies.noSegments') }}</p>
    </div>

    <div v-if="editing" class="max-w-sm">
      <DlCombobox v-model="newLine" :label="t('frequencies.lines.add')" :options="lineOptions" :placeholder="t('frequencies.lines.addPlaceholder')" />
    </div>
    <p v-if="errors.cells || errors.team_id" class="text-[13px] text-dl-rejected">{{ errors.cells || errors.team_id }}</p>

    <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-body">{{ editing && grid ? t('frequencies.change.cycles') : t('frequencies.rule') }}</p>

    <div v-if="editing" class="flex flex-wrap justify-end gap-2.5">
      <DlButton variant="ghost" @click="cancel">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton variant="primary" :loading="saving" :disabled="!segments.length" @click="save">
        {{ grid ? t('objectives.change.save', { date: from ? dates.date(from) : '' }) : t('frequencies.add.save') }}
      </DlButton>
    </div>

    <div v-if="grid && !editing" class="grid gap-3 md:grid-cols-2">
      <section class="rounded-2xl border border-dl-line px-3.5 py-3 text-[13px]">
        <h3 class="mb-1.5 text-sm font-semibold">{{ t('objectives.read.people', { count: n(grid.people?.length ?? 0) }) }}</h3>
        <p v-if="!grid.people?.length" class="text-dl-body">{{ t('objectives.read.nobody') }}</p>
        <p v-else class="text-dl-body">{{ grid.people.slice(0, 6).map(person => person.full_name).join(', ') }}<template v-if="grid.people.length > 6"> {{ t('objectives.read.morePeople', { count: n(grid.people.length - 6) }) }}</template></p>
        <p class="mt-1.5 text-xs text-dl-muted">{{ grid.team ? t('objectives.read.whoTeam', { role: roleLabel(grid.role?.name), team: grid.team.name }) : t('frequencies.whoAllTeams') }}</p>
      </section>
      <section class="rounded-2xl border border-dl-line px-3.5 py-3 text-[13px]">
        <h3 class="mb-2 text-sm font-semibold">{{ t('objectives.read.history') }}</h3>
        <ol class="flex flex-col gap-2">
          <li v-for="row in versions" :key="row.start_date">
            <button type="button" class="flex w-full items-start gap-2.5 text-start" :disabled="row.start_date === grid.start_date" @click="emit('version', row.start_date)">
              <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" :class="row.start_date === grid.start_date ? 'bg-dl-fg' : 'bg-dl-line'" />
              <span class="flex flex-col">
                <span :class="row.start_date === grid.start_date ? 'font-semibold' : 'text-dl-cobalt hover:underline'">
                  {{ row.end_date ? dates.range(row.start_date, row.end_date) : t('objectives.period.from', { date: dates.date(row.start_date) }) }}
                </span>
                <span class="text-xs text-dl-muted">{{ t('frequencies.usedByTargets', { count: n(row.cycle_targets_count) }, row.cycle_targets_count) }}</span>
              </span>
            </button>
          </li>
        </ol>
      </section>
    </div>
  </section>
</template>
