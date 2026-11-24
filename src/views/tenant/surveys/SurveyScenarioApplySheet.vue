<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import {
  APPLY_STATES, applyScenario, exportApplyRows, fetchApplyPreview, fetchApplyRows,
  type ApplyPreview, type ApplyResult, type ApplyRow, type ApplyState, type Scenario, type SegmentRef, type Survey,
} from '@/api/tenant/surveys'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSheet from '@/components/DlSheet.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { exportToXlsx } from '@/composables/exportXlsx'
import { useToast } from '@/composables/useToast'
import { useSurveyText } from './surveyDisplay'

// « Appliquer aux cycles » (docs/api/survey-scenario-apply.md): first the preview (four counts, each rep with the
// cycles concerned, the rows of one state with the segment before → after and the visits to do, Excel), then the
// write and what it did. Nothing is written before « Appliquer ». Mockup: surveys-mockups/Apply.html frames 2–3.
const props = defineProps<{ survey: Survey; scenario: Scenario }>()
const emit = defineEmits<{ applied: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const toast = useToast()
const text = useSurveyText()

const preview = ref<ApplyPreview | null>(null)
const result = ref<ApplyResult | null>(null)
const state = ref<ApplyState>('change')
const search = ref('')
const page = ref(1)
const perPage = ref(25)
const rows = ref<ApplyRow[]>([])
const total = ref(0)
const loading = ref(false)

const filters = (which: ApplyState = state.value) => ({ 'filter[state]': which, 'filter[search]': search.value || undefined, sort: 'user' })
async function loadRows() {
  loading.value = true
  try {
    const answer = await fetchApplyRows(props.survey.id, props.scenario.id, { ...filters(), page: page.value, per_page: perPage.value })
    rows.value = answer.items
    total.value = answer.total
  }
  finally {
    loading.value = false
  }
}
watch(open, async (value) => {
  if (!value) return
  preview.value = null
  result.value = null
  search.value = ''
  page.value = 1
  try {
    preview.value = await fetchApplyPreview(props.survey.id, props.scenario.id)
    state.value = APPLY_STATES.find(s => preview.value!.counts[s]) ?? 'change'
    await loadRows()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}, { immediate: true })
watch([state, search], () => { page.value = 1; loadRows() })
watch([page, perPage], loadRows)

const tiles = computed(() => APPLY_STATES.map(s => ({ state: s, count: preview.value?.counts[s] ?? 0 })))
const states = computed(() => APPLY_STATES.map(s => ({ value: s, label: `${t(`surveys.apply.state.${s}`)} · ${n(preview.value?.counts[s] ?? 0)}` })))
const cycles = (person: ApplyPreview['people'][number]) => person.cycles.map(c => text.period(c.start_date, c.end_date)).join(' + ') || t('surveys.apply.noCycle')
const columns = computed(() => [
  { key: 'user', label: t('surveys.respondents.person') },
  { key: 'hcp', label: t('surveys.respondents.professional') },
  { key: 'segment', label: t('surveys.scenarios.segment') },
  ...(state.value === 'change' || state.value === 'right' ? [{ key: 'to_do', label: t('surveys.apply.toDo'), align: 'end' as const }] : []),
])

const applying = ref(false)
async function apply() {
  applying.value = true
  try {
    result.value = await applyScenario(props.survey.id, props.scenario.id)
    toast.success(t('surveys.apply.done', { count: result.value.changed }, result.value.changed))
    emit('applied')
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    applying.value = false
  }
}

const exporting = ref(false)
const name = (segment: SegmentRef | null) => segment?.name ?? t('cycles.segment.none')
async function download(which: ApplyState = state.value) {
  exporting.value = true
  try {
    const all = await exportApplyRows(props.survey.id, props.scenario.id, { ...filters(which), 'filter[search]': undefined })
    await exportToXlsx(all.map(row => ({
      [t('surveys.answers.xl.user')]: row.user.full_name,
      [t('surveys.answers.xl.hcp')]: row.hcp.name,
      [t('surveys.answers.xl.speciality')]: row.speciality ?? '',
      [t('surveys.scenarios.region')]: row.region ?? '',
      [t('surveys.apply.xl.now')]: row.current ? row.current.name : '',
      [t('surveys.scenarios.segment')]: name(row.segmentation),
      [t('surveys.apply.state.label')]: t(`surveys.apply.state.${row.state}`),
    })), `${props.scenario.name} · ${t(`surveys.apply.state.${which}`)}`, props.scenario.name)
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
  <DlSheet v-model:open="open" size="lg" :title="t('surveys.apply.title')" :description="`${scenario.name} · ${survey.name}`">
    <div v-if="result" class="flex flex-col gap-4 text-[13.5px]">
      <h3 class="text-base font-bold">{{ t('surveys.apply.writtenTitle') }}</h3>
      <p>{{ t('surveys.apply.written', { count: n(result.changed), cycles: n(result.cycles.length) }, result.changed) }}</p>
      <ul class="flex flex-col gap-1.5">
        <li v-for="cycle in result.cycles" :key="cycle.id" class="flex gap-2 rounded-xl bg-dl-mist px-3 py-2">
          <strong class="font-semibold">{{ cycle.user.full_name }}</strong>
          <span class="text-dl-muted">{{ text.period(cycle.start_date, cycle.end_date) }}</span>
          <span class="ms-auto">{{ t('surveys.apply.changed', { count: n(cycle.changed) }, cycle.changed) }}</span>
        </li>
      </ul>
      <p v-if="result.missing || result.no_cycle" class="rounded-xl bg-dl-pending/10 px-3 py-2 text-xs text-dl-pending">
        {{ t('surveys.apply.left', { missing: n(result.missing), none: n(result.no_cycle) }) }}
      </p>
    </div>

    <div v-else-if="!preview" class="flex flex-col gap-3"><DlSkeleton v-for="i in 4" :key="i" class="h-14 rounded-2xl" /></div>

    <div v-else class="flex flex-col gap-4">
      <p class="text-[13px] text-dl-muted">{{ t('surveys.apply.hint') }}</p>
      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div
          v-for="tile in tiles"
          :key="tile.state"
          class="flex flex-col gap-0.5 rounded-2xl px-3.5 py-3 text-xs"
          :class="tile.state === 'missing' || tile.state === 'no_cycle' ? 'bg-dl-pending/10' : tile.state === 'right' ? 'bg-dl-signal-soft' : 'bg-dl-mist'"
        >
          <strong class="font-display text-2xl text-dl-ink">{{ n(tile.count) }}</strong>{{ t(`surveys.apply.state.${tile.state}`) }}
        </div>
      </div>

      <section class="flex flex-col gap-1.5">
        <h3 class="text-sm font-bold">{{ t('surveys.apply.people') }}</h3>
        <div v-for="person in preview.people" :key="person.user.id" class="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-dl-line-soft py-2 text-[13px] last:border-0">
          <strong class="font-semibold">{{ person.user.full_name }}</strong>
          <span :class="person.cycles.length ? 'text-dl-muted' : 'text-dl-pending'">{{ cycles(person) }}</span>
          <span class="ms-auto text-xs text-dl-muted">
            {{ APPLY_STATES.filter(s => person[s]).map(s => `${t(`surveys.apply.state.${s}`)} ${n(person[s])}`).join(' · ') }}
          </span>
        </div>
      </section>

      <section class="flex flex-col gap-3">
        <DlSegmented v-model="state" :label="t('surveys.apply.state.label')" :items="states" />
        <div class="flex flex-wrap items-center gap-2.5">
          <div class="w-60 max-md:w-full"><DlInput v-model="search" :label="t('surveys.scenarios.searchRows')" :placeholder="t('surveys.scenarios.searchRows')" icon="tabler-search" hide-label /></div>
          <DlButton size="sm" variant="outline" icon="tabler-file-spreadsheet" class="ms-auto" :loading="exporting" :disabled="!preview.counts[state]" @click="download()">{{ t('surveys.answers.export') }}</DlButton>
        </div>
        <p v-if="state === 'missing'" class="rounded-xl bg-dl-pending/10 px-3 py-2 text-xs text-dl-pending">{{ t('surveys.apply.missingHint') }}</p>
        <DlDataList :label="t('surveys.apply.title')" :columns="columns" :rows="rows" :row-key="row => `${row.user.id}-${row.hcp.id}`" :loading="loading" :empty-title="t('surveys.scenarios.noRows')">
          <template #cell-user="{ row }">{{ row.user.full_name }}</template>
          <template #cell-hcp="{ row }">
            <strong class="block font-semibold">{{ row.hcp.name }}</strong>
            <span class="text-xs text-dl-muted">{{ [row.speciality, row.region].filter(Boolean).join(' · ') }}</span>
          </template>
          <template #cell-segment="{ row }">
            <span class="inline-flex items-center gap-1.5 font-semibold">
              <template v-if="row.state === 'change'">
                <span class="inline-flex items-center gap-1.5 text-dl-muted"><i v-if="row.current" class="h-2.5 w-2.5 rounded-[3px]" :style="{ background: row.current.color }" />{{ name(row.current) }}</span>
                <span class="text-dl-muted">→</span>
              </template>
              <i class="h-2.5 w-2.5 rounded-[3px]" :style="{ background: row.segmentation?.color }" />{{ name(row.segmentation) }}
            </span>
          </template>
          <template #cell-to_do="{ row }">
            <template v-if="row.to_do">{{ row.state === 'change' ? `${n(row.to_do.from)} → ${n(row.to_do.to)}` : n(row.to_do.to) }}</template>
          </template>
          <template #card="{ row }">
            <strong class="block font-semibold">{{ row.hcp.name }}</strong>
            <span class="text-xs text-dl-muted">{{ row.user.full_name }} · {{ row.state === 'change' ? `${name(row.current)} → ` : '' }}{{ name(row.segmentation) }}</span>
          </template>
        </DlDataList>
        <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
      </section>
    </div>

    <template #footer>
      <template v-if="result">
        <DlButton v-if="result.missing" variant="outline" icon="tabler-file-spreadsheet" :loading="exporting" @click="download('missing')">{{ t('surveys.apply.exportMissing') }}</DlButton>
        <DlButton variant="primary" class="ms-auto" @click="open = false">{{ t('surveys.apply.close') }}</DlButton>
      </template>
      <template v-else>
        <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
        <DlButton variant="primary" class="ms-auto" :loading="applying" :disabled="!preview?.counts.change" @click="apply">
          {{ t('surveys.apply.confirm', { count: n(preview?.counts.change ?? 0) }, preview?.counts.change ?? 0) }}
        </DlButton>
      </template>
    </template>
  </DlSheet>
</template>
