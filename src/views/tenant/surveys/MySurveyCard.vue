<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchRespondentHcps, type MySurvey, type RespondentHcp } from '@/api/tenant/surveys'
import DlBadge from '@/components/DlBadge.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlProgress from '@/components/DlProgress.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { PACE_TONE, useSurveyText } from './surveyDisplay'

// One open survey on « Mes enquêtes »: my progress, pace, this week, and my list (to do first, with my next planned
// visit). Answering is in the visit (19b-2). Mockup: surveys-mockups/Respondents.html frame 8.
const props = defineProps<{ survey: MySurvey }>()
const { t, n } = useI18n()
const text = useSurveyText()

const state = ref('todo')
const search = ref('')
const page = ref(1)
const perPage = ref(10)
const rows = ref<RespondentHcp[]>([])
const total = ref(0)
const counts = ref({ all: 0, todo: 0, answered: 0 })
async function load() {
  const answer = await fetchRespondentHcps(props.survey.id, props.survey.respondent_id, {
    page: page.value, per_page: perPage.value, 'filter[search]': search.value || undefined, 'filter[state]': state.value,
  })
  rows.value = answer.items
  total.value = answer.total
  counts.value = answer.counts
}
watch([state, search], () => { page.value = 1; load() })
watch([page, perPage], load, { immediate: true })
const stateItems = computed(() => [
  { value: 'todo', label: `${t('surveys.respondents.todo')} · ${counts.value.todo}` },
  { value: 'answered', label: `${t('surveys.respondents.answered')} · ${counts.value.answered}` },
])
const objective = computed(() => (props.survey.objective_per_week ? t('surveys.mine.objective', { count: props.survey.objective_per_week }) : t('surveys.mine.noObjective')))
</script>

<template>
  <section class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5">
    <header class="flex flex-wrap items-center gap-2">
      <h2 class="text-base font-bold">{{ survey.name }}</h2>
      <DlBadge size="sm" tone="info" class="ms-auto">{{ t('surveys.mine.until', { date: text.date(survey.end_date) }) }}</DlBadge>
    </header>
    <p class="text-xs text-dl-muted">{{ [text.target(survey.target_type), text.mode(survey.is_per_visit), objective].join(' · ') }}</p>
    <DlProgress :value="survey.progress" :label="t('surveys.respondents.progress')" />
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px]">
      <span>{{ t('surveys.mine.answered', { answered: n(survey.answered_count), list: n(survey.list_count) }) }}</span>
      <DlBadge v-if="survey.pace && survey.expected != null" size="sm" :tone="PACE_TONE[survey.pace]">{{ text.pace(survey.pace, survey.answered_count, survey.expected) }}</DlBadge>
      <span v-if="survey.objective_per_week" class="text-dl-muted">{{ t('surveys.mine.thisWeek', { done: survey.week_answered, goal: survey.objective_per_week }) }}</span>
      <span v-if="survey.is_per_visit" class="text-dl-muted">{{ t('surveys.mine.answers', { count: n(survey.answers_count) }) }}</span>
    </div>
    <p v-if="survey.is_per_visit" class="rounded-2xl bg-dl-mist px-4 py-2.5 text-[13px] text-dl-muted">{{ t('surveys.mine.perVisit') }}</p>
    <div class="flex flex-wrap items-end gap-2">
      <DlSegmented v-model="state" :label="t('surveys.fields.status')" :items="stateItems" />
      <div class="min-w-40 flex-1"><DlInput v-model="search" :label="t('surveys.respondents.searchHcp')" :placeholder="t('surveys.respondents.searchHcp')" icon="tabler-search" hide-label /></div>
    </div>
    <ul class="flex flex-col text-[13.5px]">
      <li v-for="row in rows" :key="row.hcp.id" class="flex flex-wrap items-center gap-x-2 border-b border-dl-line-soft py-2 last:border-0">
        <RouterLink :to="{ name: 'tenant-hcp-detail', params: { id: row.hcp.id } }" class="font-semibold text-dl-fg no-underline hover:underline">{{ row.hcp.name }}</RouterLink>
        <span class="text-dl-muted">{{ [row.speciality, row.segment, row.wilaya].filter(Boolean).join(' · ') }}</span>
        <span v-if="row.next_visit_date" class="ms-auto text-xs text-dl-muted">{{ t('surveys.mine.nextVisit', { date: text.date(row.next_visit_date) }) }}</span>
      </li>
      <li v-if="!rows.length" class="py-4 text-center text-dl-muted">{{ state === 'todo' ? t('surveys.mine.allDone') : t('surveys.mine.noneYet') }}</li>
    </ul>
    <DlPagination v-model="page" v-model:per-page="perPage" :total="total" />
  </section>
</template>
