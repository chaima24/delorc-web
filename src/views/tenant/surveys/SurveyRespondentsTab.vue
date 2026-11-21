<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchAllTeams } from '@/api/tenant/teams'
import { errorMessage } from '@/api/errors'
import { fetchRespondents, setRespondentActive, type Respondent, type RespondentList, type Survey } from '@/api/tenant/surveys'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlInput from '@/components/DlInput.vue'
import DlProgress from '@/components/DlProgress.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useToast } from '@/composables/useToast'
import SurveyAddPeopleSheet from './SurveyAddPeopleSheet.vue'
import SurveyFiltersSheet from './SurveyFiltersSheet.vue'
import SurveyRespondentSheet from './SurveyRespondentSheet.vue'
import { PACE_TONE, useSurveyText } from './surveyDisplay'

// The « Répondants » tab: four figures, the copy filters, one row per person (where their list comes from, its size,
// answered, progress, pace). Marketing adds people, edits the filters, pauses; managers and reps read their scope.
// Mockup: surveys-mockups/Respondents.html frames 1, 7, 9.
const props = defineProps<{ survey: Survey }>()
const emit = defineEmits<{ survey: [survey: Survey] }>()
const { t, n } = useI18n()
const toast = useToast()
const text = useSurveyText()

const ALL = 'all'
const NONE = 0
const search = ref('')
const team = ref<number | string | null>(NONE)
const state = ref(ALL)
const sort = ref('name')
const answer = ref<RespondentList | null>(null)
const loading = ref(false)
async function load() {
  loading.value = true
  try {
    answer.value = await fetchRespondents(props.survey.id, {
      sort: sort.value,
      'filter[search]': search.value || undefined,
      'filter[team_id]': Number(team.value) || undefined,
      'filter[state]': state.value === ALL ? undefined : state.value,
    })
  }
  finally {
    loading.value = false
  }
}
watch([search, team, state, sort], load, { immediate: true })

const teams = ref<{ value: number; label: string }[]>([])
onMountedAndFocus(async () => {
  teams.value = (await fetchAllTeams().catch(() => [])).map(row => ({ value: row.id, label: row.name }))
})
const teamOptions = computed(() => [{ value: NONE, label: t('surveys.respondents.allTeams') }, ...teams.value])
const stateItems = computed(() => {
  const counts = answer.value?.counts ?? { all: 0, late: 0, paused: 0 }
  return [
    { value: ALL, label: `${t('surveys.list.all')} · ${counts.all}` },
    { value: 'late', label: `${t('surveys.respondents.late')} · ${counts.late}` },
    { value: 'paused', label: `${t('surveys.respondents.paused')} · ${counts.paused}` },
  ]
})
const canEdit = computed(() => !!answer.value?.can.update)
const figures = computed(() => answer.value?.figures)

const columns = computed(() => [
  { key: 'name', label: t('surveys.respondents.person'), sortKey: 'name' },
  { key: 'team', label: t('surveys.respondents.team'), secondary: true },
  { key: 'cycle', label: t('surveys.respondents.copiedFrom'), secondary: true },
  { key: 'list_count', label: t('surveys.respondents.list'), sortKey: 'list_count', align: 'end' as const },
  { key: 'answered_count', label: t('surveys.respondents.answered'), sortKey: 'answered_count', align: 'end' as const },
  { key: 'progress', label: t('surveys.respondents.progress'), sortKey: 'progress' },
  { key: 'pace', label: t('surveys.respondents.paceLabel'), secondary: true },
  ...(canEdit.value ? [{ key: 'active', label: t('surveys.respondents.active') }] : []),
])

async function toggle(row: Respondent, active: boolean) {
  try {
    await setRespondentActive(props.survey.id, row.id, active)
    toast.success(t(active ? 'surveys.respondents.resumed' : 'surveys.respondents.pausedDone', { name: row.user.full_name }))
    await load()
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
}

// Sheets.
const adding = ref(false)
const filtering = ref(false)
const selected = ref<Respondent | null>(null)
const showing = ref(false)
function open(row: Respondent) {
  selected.value = row
  showing.value = true
}
const filterLabel = (ids: number[]) => (ids.length ? t('surveys.respondents.filterCount', { count: ids.length }, ids.length) : t('surveys.respondents.filterAll'))
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="figures" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="flex flex-col gap-1 rounded-2xl bg-dl-paper px-4 py-3">
        <strong class="font-display text-[26px] font-extrabold">{{ n(figures.people) }}</strong>
        <span class="text-xs text-dl-muted">{{ t('surveys.respondents.figurePeople', { paused: figures.paused }) }}</span>
      </div>
      <div class="flex flex-col gap-1 rounded-2xl bg-dl-paper px-4 py-3">
        <strong class="font-display text-[26px] font-extrabold">{{ n(figures.list_count) }}</strong>
        <span class="text-xs text-dl-muted">{{ t('surveys.respondents.figureList') }}</span>
      </div>
      <div class="flex flex-col gap-1.5 rounded-2xl bg-dl-paper px-4 py-3">
        <strong class="font-display text-[26px] font-extrabold">{{ n(figures.answered_count) }}</strong>
        <span class="text-xs text-dl-muted">{{ t('surveys.respondents.figureAnswered', { progress: figures.progress }) }}</span>
        <DlProgress :value="figures.progress" :label="t('surveys.respondents.progress')" />
      </div>
      <div class="flex flex-col gap-1 rounded-2xl bg-dl-paper px-4 py-3">
        <strong class="font-display text-[26px] font-extrabold">{{ figures.expected == null ? '—' : n(figures.expected) }}</strong>
        <span class="text-xs text-dl-muted">{{ t('surveys.respondents.figureExpected', { week: figures.week, weeks: figures.weeks_count }) }}</span>
      </div>
    </div>

    <section class="flex flex-col gap-2 rounded-3xl bg-dl-paper p-4 md:p-5">
      <header class="flex items-center gap-2">
        <h2 class="text-[15px] font-semibold">{{ t('surveys.respondents.filters') }}</h2>
        <DlButton v-if="canEdit" size="sm" variant="outline" icon="tabler-pencil" class="ms-auto" @click="filtering = true">{{ t('common.actions.edit') }}</DlButton>
      </header>
      <dl class="flex flex-wrap gap-x-5 gap-y-1 text-[13.5px]">
        <div class="flex gap-1.5"><dt class="text-dl-muted">{{ t('surveys.respondents.specialities') }}</dt><dd>{{ filterLabel(survey.copy_filters.speciality_ids) }}</dd></div>
        <div class="flex gap-1.5"><dt class="text-dl-muted">{{ t('surveys.respondents.segments') }}</dt><dd>{{ filterLabel(survey.copy_filters.segmentation_ids) }}</dd></div>
        <div class="flex gap-1.5"><dt class="text-dl-muted">{{ t('surveys.respondents.wilayas') }}</dt><dd>{{ filterLabel(survey.copy_filters.wilaya_ids) }}</dd></div>
      </dl>
      <p class="text-xs text-dl-muted">{{ t('surveys.respondents.filtersHint', { target: text.target(survey.target_type) }) }}</p>
    </section>

    <p v-if="survey.status === 'closed'" class="rounded-2xl bg-dl-mist px-4 py-3 text-[13.5px] text-dl-muted">{{ t('surveys.respondents.closed') }}</p>
    <p v-else-if="!canEdit" class="rounded-2xl bg-dl-mist px-4 py-3 text-[13.5px] text-dl-muted">{{ t('surveys.respondents.readOnly') }}</p>

    <div class="flex flex-wrap items-end gap-2.5">
      <div class="w-56 max-md:w-full"><DlInput v-model="search" :label="t('surveys.respondents.search')" :placeholder="t('surveys.respondents.search')" icon="tabler-search" hide-label /></div>
      <DlSelect v-model="team" :label="t('surveys.respondents.team')" :options="teamOptions" appearance="filter" />
      <DlSegmented v-model="state" :label="t('surveys.fields.status')" :items="stateItems" />
      <DlButton v-if="canEdit" variant="primary" icon="tabler-plus" class="ms-auto" @click="adding = true">{{ t('surveys.respondents.add') }}</DlButton>
    </div>

    <div class="rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
      <DlDataList
        v-model:sort="sort"
        default-sort="name"
        :label="t('surveys.respondents.title')"
        :columns="columns"
        :rows="answer?.items ?? []"
        :row-key="row => row.id"
        :selected-key="showing ? selected?.id : undefined"
        :loading="loading"
        :empty-title="t('surveys.respondents.emptyTitle')"
        :empty-text="canEdit ? t('surveys.respondents.emptyText') : undefined"
        @open="open"
      >
        <template #cell-name="{ row }"><strong class="font-semibold" :class="!row.is_active && 'text-dl-muted'">{{ row.user.full_name }}</strong></template>
        <template #cell-team="{ row }">{{ row.team?.name ?? '—' }}</template>
        <template #cell-cycle="{ row }"><span :class="!row.cycle && 'text-dl-pending'">{{ text.cycle(row.cycle) }}</span></template>
        <template #cell-list_count="{ row }">{{ n(row.list_count) }}</template>
        <template #cell-answered_count="{ row }">{{ n(row.answered_count) }}</template>
        <template #cell-progress="{ row }">
          <div class="flex min-w-28 flex-col gap-1"><DlProgress :value="row.progress" :label="t('surveys.respondents.progress')" /><span class="text-xs text-dl-muted">{{ row.progress }} %</span></div>
        </template>
        <template #cell-pace="{ row }">
          <DlBadge v-if="!row.is_active" size="sm">{{ t('surveys.respondents.paused') }}</DlBadge>
          <DlBadge v-else-if="row.pace && row.expected != null" size="sm" :tone="PACE_TONE[row.pace]">{{ text.pace(row.pace, row.answered_count, row.expected) }}</DlBadge>
          <span v-else class="text-dl-muted">—</span>
        </template>
        <template #cell-active="{ row }">
          <span @click.stop><DlSwitch :model-value="row.is_active" :label="t('surveys.respondents.active')" @update:model-value="(value: boolean) => toggle(row, value)" /></span>
        </template>
        <template #card="{ row }">
          <strong class="block font-semibold">{{ row.user.full_name }}</strong>
          <span class="text-xs text-dl-muted">{{ [row.team?.name, t('surveys.respondents.cardLine', { answered: row.answered_count, list: row.list_count })].filter(Boolean).join(' · ') }}</span>
        </template>
      </DlDataList>
    </div>

    <SurveyAddPeopleSheet v-if="adding" v-model:open="adding" :survey="survey" @added="load" />
    <SurveyFiltersSheet v-if="filtering" v-model:open="filtering" :survey="survey" @saved="value => emit('survey', value)" />
    <SurveyRespondentSheet v-if="selected && showing" v-model:open="showing" :survey="survey" :respondent="selected" :can-edit="canEdit" @changed="load" />
  </div>
</template>
