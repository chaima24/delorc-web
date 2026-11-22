<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { fetchSegmentations } from '@/api/tenant/customerSetup'
import {
  SCENARIO_MATRICES, deleteScenario, duplicateScenario, exportScenarioRows, fetchScenarioRows, updateScenario,
  type Scenario, type ScenarioCell, type ScenarioRow, type Survey,
} from '@/api/tenant/surveys'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useConfirm } from '@/composables/useConfirm'
import { exportToXlsx } from '@/composables/exportXlsx'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useToast } from '@/composables/useToast'
import SurveyScenarioSheet from './SurveyScenarioSheet.vue'

// A scenario's result (docs/api/survey-scenarios.md): the matrix (X across, Y up, the strongest cell top right), each
// cell with its segment (changeable), count, share and mean scores; the totals per segment; then the rep + professional
// rows (a cell filters them), searchable, sortable, exported to Excel. Mockup: surveys-mockups/Segmentation.html frames 3–6.
const props = defineProps<{ survey: Survey; scenario: Scenario }>()
const emit = defineEmits<{ back: []; changed: [scenario: Scenario | null] }>()
const { t, n } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()

const current = ref<Scenario>(props.scenario)
watch(() => props.scenario, value => { current.value = value })
const columns = computed(() => SCENARIO_MATRICES[current.value.matrix][0])
const hasY = computed(() => SCENARIO_MATRICES[current.value.matrix][1] > 1)
// Cells drawn in reading order: row by row from the top, columns from the left.
const grid = computed(() => [...current.value.cells].sort((a, b) => a.row - b.row || a.column - b.column))
const axisText = (axis: 'x' | 'y') => {
  const questions = current.value.questions.filter(q => q.axis === axis).map(q => (q.coefficient === 1 ? q.number : `${q.number} × ${n(q.coefficient)}`)).join(' + ')
  const cutoffs = (axis === 'x' ? current.value.x_cutoffs : current.value.y_cutoffs ?? []).map(value => n(value)).join(' · ')
  return t('surveys.scenarios.axisLine', { questions, cutoffs })
}

// The lab's cycle segments, for a cell's segment.
const segments = ref<{ value: number; label: string }[]>([])
onMountedAndFocus(async () => {
  segments.value = (await fetchSegmentations({ per_page: 100, sort: 'position', 'filter[type]': 'cycle_target' }).catch(() => ({ items: [] }))).items
    .map(row => ({ value: row.id, label: row.name }))
})
async function setSegment(cell: ScenarioCell, value: string | number | null | undefined) {
  if (value == null) return
  const cells = [...current.value.cell_segments]
  cells[cell.index] = Number(value)
  try {
    current.value = await updateScenario(props.survey.id, current.value.id, { cell_segments: cells })
    emit('changed', current.value)
    await load()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

// Rows.
const cellFilter = ref<number | null>(null)
const search = ref('')
const sort = ref('-x')
const page = ref(1)
const perPage = ref(25)
const rows = ref<ScenarioRow[]>([])
const total = ref(0)
const loading = ref(false)
const filters = () => ({ sort: sort.value, 'filter[cell]': cellFilter.value ?? undefined, 'filter[search]': search.value || undefined })
async function load() {
  loading.value = true
  try {
    const answer = await fetchScenarioRows(props.survey.id, current.value.id, { ...filters(), page: page.value, per_page: perPage.value })
    rows.value = answer.items
    total.value = answer.total
  }
  finally {
    loading.value = false
  }
}
watch([cellFilter, search, sort], () => { page.value = 1; load() })
watch([page, perPage, () => current.value.id], load, { immediate: true })
const segmentName = (id: number | null) => segments.value.find(s => s.value === id)?.label ?? null
const segmentColor = (id: number | null) => current.value.cells.find(cell => cell.segmentation?.id === id)?.segmentation?.color
const listColumns = computed(() => [
  { key: 'user', label: t('surveys.respondents.person'), sortKey: 'user' },
  { key: 'hcp', label: t('surveys.respondents.professional'), sortKey: 'hcp' },
  { key: 'where', label: t('surveys.scenarios.where'), secondary: true },
  { key: 'x', label: 'X', sortKey: 'x', align: 'end' as const },
  ...(hasY.value ? [{ key: 'y', label: 'Y', sortKey: 'y', align: 'end' as const }] : []),
  { key: 'segment', label: t('surveys.scenarios.segment') },
])

// Actions.
const editing = ref(false)
async function duplicate() {
  try {
    emit('changed', await duplicateScenario(props.survey.id, current.value.id))
    toast.success(t('surveys.scenarios.duplicated'))
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
async function remove() {
  const ok = await confirm({ title: t('surveys.scenarios.deleteTitle', { name: current.value.name }), text: t('surveys.scenarios.deleteText'), confirmButtonText: t('common.actions.delete'), icon: 'warning' })
  if (!ok) return
  try {
    await deleteScenario(props.survey.id, current.value.id)
    toast.success(t('studio.list.toast.deleted'))
    emit('changed', null)
    emit('back')
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}
const exporting = ref(false)
async function download() {
  exporting.value = true
  try {
    const all = await exportScenarioRows(props.survey.id, current.value.id, filters())
    await exportToXlsx(all.map(row => ({
      [t('surveys.answers.xl.user')]: row.user.full_name,
      [t('surveys.answers.xl.hcp')]: row.hcp.name,
      [t('surveys.answers.xl.speciality')]: row.speciality ?? '',
      [t('surveys.scenarios.region')]: row.region ?? '',
      X: row.x ?? '',
      ...(hasY.value ? { Y: row.y ?? '' } : {}),
      [t('surveys.scenarios.segment')]: segmentName(row.segmentation_id) ?? t('surveys.scenarios.unclassified'),
    })), `${props.survey.name} · ${current.value.name}`, current.value.name)
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2.5">
      <DlButton size="sm" variant="ghost" icon="tabler-arrow-left" @click="emit('back')">{{ t('surveys.scenarios.back') }}</DlButton>
      <h2 class="text-xl font-bold">{{ current.name }}</h2>
      <DlBadge size="sm">{{ current.matrix.replace('x', '×') }}</DlBadge>
      <span class="text-[13px] text-dl-muted">{{ t('surveys.scenarios.counts', { classified: n(current.classified), unclassified: n(current.unclassified) }) }}</span>
      <span class="ms-auto flex flex-wrap gap-2">
        <DlButton size="sm" variant="outline" icon="tabler-pencil" @click="editing = true">{{ t('common.actions.edit') }}</DlButton>
        <DlButton size="sm" variant="outline" icon="tabler-copy" @click="duplicate">{{ t('surveys.page.duplicate') }}</DlButton>
        <DlButton size="sm" variant="outline" icon="tabler-file-spreadsheet" :loading="exporting" :disabled="!current.classified && !current.unclassified" @click="download">{{ t('surveys.answers.export') }}</DlButton>
        <DlButton size="sm" variant="ghost" icon="tabler-trash" @click="remove">{{ t('common.actions.delete') }}</DlButton>
      </span>
    </div>

    <div class="grid gap-4 xl:grid-cols-[1fr_280px]">
      <section class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
        <div class="grid gap-2" :class="hasY ? 'grid-cols-[22px_1fr]' : ''">
          <span v-if="hasY" class="text-center text-[11.5px] text-dl-muted [writing-mode:vertical-rl] rotate-180">{{ t('surveys.scenarios.yAxis', { text: axisText('y') }) }}</span>
          <div class="grid gap-1.5" :style="{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }">
            <div
              v-for="cell in grid"
              :key="cell.index"
              class="flex min-h-24 cursor-pointer flex-col gap-1 rounded-2xl border p-2.5 text-xs transition"
              :class="cellFilter === cell.index ? 'border-dl-ink ring-2 ring-dl-ink' : 'border-dl-line-soft'"
              :style="cell.segmentation ? { background: `color-mix(in srgb, ${cell.segmentation.color} 22%, transparent)` } : undefined"
              role="button"
              tabindex="0"
              :aria-pressed="cellFilter === cell.index"
              @click="cellFilter = cellFilter === cell.index ? null : cell.index"
              @keydown.enter="cellFilter = cellFilter === cell.index ? null : cell.index"
            >
              <span class="flex items-center gap-1.5" @click.stop>
                <DlSelect :model-value="cell.segmentation?.id ?? null" :label="t('surveys.scenarios.cellSegment')" hide-label appearance="filter" :options="segments" @update:model-value="value => setSegment(cell, value)" />
                <span class="ms-auto text-dl-muted">{{ n(cell.share) }} %</span>
              </span>
              <strong class="font-display text-xl">{{ n(cell.count) }}</strong>
              <span class="text-dl-muted">{{ cell.x_avg == null ? '—' : t(hasY ? 'surveys.scenarios.avgXY' : 'surveys.scenarios.avgX', { x: n(cell.x_avg), y: n(cell.y_avg ?? 0) }) }}</span>
            </div>
          </div>
          <span v-if="hasY" />
          <span class="text-center text-[11.5px] text-dl-muted">{{ t('surveys.scenarios.xAxis', { text: axisText('x') }) }}</span>
        </div>
      </section>
      <section class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 text-[13.5px] md:p-5">
        <h3 class="text-sm font-bold">{{ t('surveys.scenarios.bySegment') }}</h3>
        <div v-for="row in current.segments" :key="row.segmentation?.id" class="flex items-center gap-2">
          <i class="h-2.5 w-2.5 rounded-[3px]" :style="{ background: row.segmentation?.color }" />
          <span class="flex-1 font-semibold">{{ row.segmentation?.name ?? '—' }}</span>
          <span>{{ n(row.count) }}</span>
          <span class="w-14 text-end text-dl-muted">{{ n(row.share) }} %</span>
        </div>
        <p v-if="current.unclassified" class="mt-1 rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-muted">{{ t('surveys.scenarios.unclassifiedHint', { count: current.unclassified }, current.unclassified) }}</p>
      </section>
    </div>

    <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
      <div class="flex flex-wrap items-center gap-2.5">
        <h3 class="text-sm font-bold">{{ cellFilter === null ? t('surveys.scenarios.rowsAll', { count: n(total) }) : t('surveys.scenarios.rowsCell', { count: n(total) }) }}</h3>
        <DlButton v-if="cellFilter !== null" size="sm" variant="ghost" icon="tabler-x" @click="cellFilter = null">{{ t('surveys.scenarios.allCells') }}</DlButton>
        <div class="ms-auto w-60 max-md:w-full"><DlInput v-model="search" :label="t('surveys.scenarios.searchRows')" :placeholder="t('surveys.scenarios.searchRows')" icon="tabler-search" hide-label /></div>
      </div>
      <DlDataList v-model:sort="sort" default-sort="-x" :label="current.name" :columns="listColumns" :rows="rows" :row-key="row => `${row.user.id}-${row.hcp.id}`" :loading="loading" :empty-title="t('surveys.scenarios.noRows')">
        <template #cell-user="{ row }">{{ row.user.full_name }}</template>
        <template #cell-hcp="{ row }"><strong class="font-semibold">{{ row.hcp.name }}</strong></template>
        <template #cell-where="{ row }"><span class="text-dl-muted">{{ [row.speciality, row.region].filter(Boolean).join(' · ') || '—' }}</span></template>
        <template #cell-x="{ row }">{{ row.x == null ? '—' : n(row.x) }}</template>
        <template #cell-y="{ row }">{{ row.y == null ? '—' : n(row.y) }}</template>
        <template #cell-segment="{ row }">
          <span v-if="row.segmentation_id" class="inline-flex items-center gap-1.5 font-semibold"><i class="h-2.5 w-2.5 rounded-[3px]" :style="{ background: segmentColor(row.segmentation_id) }" />{{ segmentName(row.segmentation_id) }}</span>
          <DlBadge v-else size="sm">{{ t('surveys.scenarios.unclassified') }}</DlBadge>
        </template>
        <template #card="{ row }">
          <strong class="block font-semibold">{{ row.hcp.name }}</strong>
          <span class="text-xs text-dl-muted">{{ [row.user.full_name, segmentName(row.segmentation_id) ?? t('surveys.scenarios.unclassified')].join(' · ') }}</span>
        </template>
      </DlDataList>
      <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
    </section>

    <SurveyScenarioSheet v-if="editing" v-model:open="editing" :survey="survey" :scenario="current" @saved="value => { current = value; emit('changed', value); load() }" />
  </div>
</template>
