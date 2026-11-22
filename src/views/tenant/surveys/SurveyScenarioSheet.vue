<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { fetchSpecialities } from '@/api/tenant/customerSetup'
import { fetchRegions } from '@/api/tenant/geography'
import {
  SCENARIO_MATRICES, createScenario, updateScenario,
  type Scenario, type ScenarioMatrix, type ScenarioPayload, type Survey,
} from '@/api/tenant/surveys'
import DlButton from '@/components/DlButton.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSheet from '@/components/DlSheet.vue'
import { useToast } from '@/composables/useToast'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'

// A segmentation scenario in a wide sheet (docs/api/survey-scenarios.md): its name, its matrix (5 sizes), for each axis
// the survey's number questions with a coefficient and its cut-offs (one fewer than the levels), then the population
// (specialities, regions). A 4×1 has no Y axis. Mockup: surveys-mockups/Segmentation.html frame 2.
const props = defineProps<{ survey: Survey; scenario: Scenario | null }>()
const emit = defineEmits<{ saved: [scenario: Scenario] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

type Axis = 'x' | 'y'
interface Row { question_id: number | null; coefficient: string }
const form = ref({
  name: '',
  matrix: '2x2' as ScenarioMatrix,
  x: [] as Row[],
  y: [] as Row[],
  xCutoffs: [] as string[],
  yCutoffs: [] as string[],
  specialityIds: [] as number[],
  regionIds: [] as number[],
})
const errors = ref<Record<string, string>>({})
const saving = ref(false)
const specialities = ref<{ value: number; label: string }[]>([])
const regions = ref<{ value: number; label: string }[]>([])

const size = computed(() => SCENARIO_MATRICES[form.value.matrix])
const hasY = computed(() => size.value[1] > 1)
// Keep one input per cut-off: a level more than cut-offs.
watch(size, ([columns, rows]) => {
  form.value.xCutoffs = Array.from({ length: columns - 1 }, (_, i) => form.value.xCutoffs[i] ?? '')
  form.value.yCutoffs = Array.from({ length: rows - 1 }, (_, i) => form.value.yCutoffs[i] ?? '')
})

watch(open, async (value) => {
  if (!value) return
  errors.value = {}
  const s = props.scenario
  const rowsOf = (axis: Axis) => (s?.questions ?? []).filter(q => q.axis === axis).map(q => ({ question_id: q.question_id, coefficient: String(q.coefficient) }))
  form.value = {
    name: s?.name ?? '',
    matrix: s?.matrix ?? '2x2',
    x: s ? rowsOf('x') : [{ question_id: null, coefficient: '1' }],
    y: s ? rowsOf('y') : [{ question_id: null, coefficient: '1' }],
    xCutoffs: (s?.x_cutoffs ?? ['']).map(String),
    yCutoffs: (s?.y_cutoffs ?? ['']).map(String),
    specialityIds: [...(s?.filters.speciality_ids ?? [])],
    regionIds: [...(s?.filters.region_ids ?? [])],
  }
  const [sp, rg] = await Promise.all([
    fetchSpecialities({ per_page: 100, sort: 'name' }).catch(() => ({ items: [] })),
    fetchRegions({ per_page: 100, sort: 'name' }).catch(() => ({ items: [] })),
  ])
  specialities.value = sp.items.map(row => ({ value: row.id, label: row.name }))
  regions.value = rg.items.map(row => ({ value: row.id, label: row.name }))
}, { immediate: true })

// Only number and % questions can be scored.
const questionOptions = computed(() => (props.survey.questions ?? [])
  .filter(q => q.type === 'numeric' || q.type === 'percentage')
  .map(q => ({ value: q.id, label: `${q.number} · ${q.question_text}` })))
const matrices = Object.keys(SCENARIO_MATRICES) as ScenarioMatrix[]

const number = (value: string) => Number(value.replace(',', '.'))
function payload(): ScenarioPayload {
  const rows = (axis: Axis) => form.value[axis].filter(row => row.question_id).map(row => ({ question_id: row.question_id!, axis, coefficient: number(row.coefficient || '1') }))
  return {
    name: form.value.name.trim(),
    matrix: form.value.matrix,
    questions: [...rows('x'), ...(hasY.value ? rows('y') : [])],
    x_cutoffs: form.value.xCutoffs.map(number),
    y_cutoffs: hasY.value ? form.value.yCutoffs.map(number) : null,
    filters: { speciality_ids: form.value.specialityIds, region_ids: form.value.regionIds },
  }
}
async function save() {
  errors.value = {}
  saving.value = true
  try {
    const scenario = props.scenario ? await updateScenario(props.survey.id, props.scenario.id, payload()) : await createScenario(props.survey.id, payload())
    toast.success(t('studio.list.toast.saved'))
    emit('saved', scenario)
    open.value = false
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
const questionError = computed(() => errors.value.questions ?? Object.entries(errors.value).find(([key]) => key.startsWith('questions.'))?.[1])
const chosen = (count: number) => (count ? t('surveys.respondents.filterCount', { count }, count) : t('surveys.respondents.filterAll'))
</script>

<template>
  <DlSheet v-model:open="open" size="lg" :title="scenario ? scenario.name : t('surveys.scenarios.new')" :description="survey.name">
    <form id="survey-scenario" class="flex flex-col gap-4" @submit.prevent="save">
      <DlInput v-model="form.name" :label="t('surveys.scenarios.name')" :error="errors.name" />

      <fieldset class="flex flex-col gap-2">
        <legend class="mb-1 text-[13px] font-semibold">{{ t('surveys.scenarios.matrix') }} <span class="font-normal text-dl-muted">· {{ t('surveys.scenarios.matrixHint') }}</span></legend>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="m in matrices"
            :key="m"
            type="button"
            class="flex flex-col items-center gap-1.5 rounded-xl border px-3 py-2 text-xs"
            :class="form.matrix === m ? 'border-dl-ink ring-2 ring-dl-ink' : 'border-dl-line'"
            :aria-pressed="form.matrix === m"
            @click="form.matrix = m"
          >
            <span class="grid gap-0.5" :style="{ gridTemplateColumns: `repeat(${SCENARIO_MATRICES[m][0]}, 10px)` }" aria-hidden="true">
              <i v-for="n in SCENARIO_MATRICES[m][0] * SCENARIO_MATRICES[m][1]" :key="n" class="block h-2.5 w-2.5 rounded-[3px] bg-dl-line" />
            </span>
            {{ m.replace('x', '×') }}
          </button>
        </div>
      </fieldset>

      <fieldset v-for="axis in (hasY ? ['x', 'y'] : ['x']) as Axis[]" :key="axis" class="flex flex-col gap-2.5 rounded-2xl border border-dl-line p-4">
        <legend class="px-1 text-[13px] font-semibold">{{ t(`surveys.scenarios.axis.${axis}`) }}</legend>
        <div v-for="(row, i) in form[axis]" :key="i" class="grid items-end gap-2 sm:grid-cols-[1fr_110px_auto]">
          <DlSelect v-model="row.question_id" :label="t('surveys.rules.question')" hide-label :options="questionOptions" :placeholder="t('surveys.scenarios.pickQuestion')" />
          <DlInput v-model="row.coefficient" type="number" :label="t('surveys.scenarios.coefficient')" hide-label :placeholder="'× 1'" />
          <DlIconButton icon="tabler-x" variant="ghost" :size="36" :label="t('common.actions.delete')" @click="form[axis].splice(i, 1)" />
        </div>
        <DlButton size="sm" variant="outline" icon="tabler-plus" class="self-start" @click="form[axis].push({ question_id: null, coefficient: '1' })">{{ t('surveys.scenarios.addQuestion') }}</DlButton>
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[13px] text-dl-muted">{{ t('surveys.scenarios.cutoffs', { count: (axis === 'x' ? form.xCutoffs : form.yCutoffs).length }, (axis === 'x' ? form.xCutoffs : form.yCutoffs).length) }}</span>
          <div v-for="(_, i) in (axis === 'x' ? form.xCutoffs : form.yCutoffs)" :key="i" class="w-24">
            <DlInput v-if="axis === 'x'" v-model="form.xCutoffs[i]!" type="number" :label="t('surveys.scenarios.cutoff', { n: i + 1 })" hide-label />
            <DlInput v-else v-model="form.yCutoffs[i]!" type="number" :label="t('surveys.scenarios.cutoff', { n: i + 1 })" hide-label />
          </div>
          <span class="text-xs text-dl-muted">{{ t('surveys.scenarios.cutoffHint') }}</span>
        </div>
        <span v-if="errors[`${axis}_cutoffs`]" class="text-xs text-dl-rejected">{{ errors[`${axis}_cutoffs`] }}</span>
      </fieldset>
      <p v-if="questionError" class="text-xs text-dl-rejected">{{ questionError }}</p>

      <fieldset class="flex flex-col gap-3 rounded-2xl border border-dl-line p-4">
        <legend class="px-1 text-[13px] font-semibold">{{ t('surveys.scenarios.population') }} <span class="font-normal text-dl-muted">· {{ t('visits.optional') }}</span></legend>
        <CheckList v-model="form.specialityIds" :legend="t('surveys.respondents.specialities')" :selected-label="chosen(form.specialityIds.length)" :search-label="t('common.search.typeToSearch')" :items="specialities" :empty-text="t('surveys.respondents.filterNone')" />
        <CheckList v-model="form.regionIds" :legend="t('surveys.scenarios.regions')" :selected-label="chosen(form.regionIds.length)" :search-label="t('common.search.typeToSearch')" :items="regions" :empty-text="t('surveys.respondents.filterNone')" />
        <p class="text-xs text-dl-muted">{{ t('surveys.scenarios.populationHint') }}</p>
      </fieldset>
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="survey-scenario" variant="primary" class="ms-auto" :loading="saving">{{ t('surveys.scenarios.saveAndSee') }}</DlButton>
    </template>
  </DlSheet>
</template>
