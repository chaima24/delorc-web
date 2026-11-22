<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchScenarios, type Scenario, type Survey } from '@/api/tenant/surveys'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import SurveyScenarioSheet from './SurveyScenarioSheet.vue'
import SurveyScenarioView from './SurveyScenarioView.vue'

// The survey's « Segmentation » tab (docs/api/survey-scenarios.md): one card per scenario (its matrix, axes, population
// and how many professionals each segment gets now), « + Nouveau scénario »; a card opens its result. Marketing and
// admins. Mockup: surveys-mockups/Segmentation.html frame 1.
const props = defineProps<{ survey: Survey }>()
const { t, n } = useI18n()

const scenarios = ref<Scenario[] | null>(null)
async function load() {
  scenarios.value = await fetchScenarios(props.survey.id).catch(() => [])
}
onMountedAndFocus(load)

const selected = ref<Scenario | null>(null)
const adding = ref(false)
function saved(scenario: Scenario) {
  selected.value = scenario
  load()
}
function changed(scenario: Scenario | null) {
  if (scenario) selected.value = scenario
  load()
}
const axes = (scenario: Scenario) => (['x', 'y'] as const)
  .map(axis => scenario.questions.filter(q => q.axis === axis).map(q => (q.coefficient === 1 ? q.number : `${q.number} × ${n(q.coefficient)}`)).join(' + '))
  .filter(Boolean).map((text, i) => `${i ? 'Y' : 'X'} : ${text}`).join(' — ')
</script>

<template>
  <SurveyScenarioView v-if="selected" :survey="survey" :scenario="selected" @back="selected = null" @changed="changed" />
  <div v-else class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-3">
      <p class="text-[13px] text-dl-muted">{{ t('surveys.scenarios.hint') }}</p>
      <DlButton variant="primary" icon="tabler-plus" class="ms-auto" @click="adding = true">{{ t('surveys.scenarios.new') }}</DlButton>
    </div>
    <div v-if="!scenarios" class="grid gap-4 md:grid-cols-3"><DlSkeleton v-for="i in 3" :key="i" class="h-40 rounded-3xl" /></div>
    <DlEmptyState v-else-if="!scenarios.length" icon="tabler-chart-dots-3" :title="t('surveys.scenarios.emptyTitle')" :text="t('surveys.scenarios.emptyText')" />
    <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <button
        v-for="scenario in scenarios"
        :key="scenario.id"
        type="button"
        class="flex flex-col gap-2.5 rounded-3xl bg-dl-paper p-4 text-start text-[13.5px] transition hover:ring-2 hover:ring-dl-line focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt md:p-5"
        @click="selected = scenario"
      >
        <span class="flex items-center gap-2"><strong class="text-[15px]">{{ scenario.name }}</strong><DlBadge size="sm">{{ scenario.matrix.replace('x', '×') }}</DlBadge></span>
        <span class="text-xs text-dl-muted">{{ axes(scenario) }}</span>
        <span class="flex flex-wrap gap-1.5">
          <span v-for="row in scenario.segments" :key="row.segmentation?.id" class="inline-flex items-center gap-1.5 rounded-full border border-dl-line-soft px-2 py-0.5 text-xs font-semibold">
            <i class="h-2.5 w-2.5 rounded-[3px]" :style="{ background: row.segmentation?.color }" />{{ row.segmentation?.name }} · {{ n(row.count) }}
          </span>
        </span>
        <span v-if="scenario.unclassified" class="text-xs text-dl-muted">{{ t('surveys.scenarios.unclassifiedCount', { count: scenario.unclassified }, scenario.unclassified) }}</span>
      </button>
    </div>
    <SurveyScenarioSheet v-if="adding" v-model:open="adding" :survey="survey" :scenario="null" @saved="saved" />
  </div>
</template>
