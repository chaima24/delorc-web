<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { fetchAllTeams } from '@/api/tenant/teams'
import { exportSurveyAnswers, fetchRespondents, fetchSurveyAnswers, type Survey, type SurveyAnswerRow } from '@/api/tenant/surveys'
import DlButton from '@/components/DlButton.vue'
import DlDataList from '@/components/DlDataList.vue'
import DlDateRangePicker from '@/components/DlDateRangePicker.vue'
import DlInput from '@/components/DlInput.vue'
import DlPagination from '@/components/DlPagination.vue'
import DlSelect from '@/components/DlSelect.vue'
import { exportToXlsx } from '@/composables/exportXlsx'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'
import { useToast } from '@/composables/useToast'
import SurveyAnswerSheet from './SurveyAnswerSheet.vue'
import { useSurveyText } from './surveyDisplay'

// The « Réponses » tab (docs/api/survey-answers.md): one row per visit with answers (per professional for a « once »
// survey), filters, the Excel export with the same filters. Same scope as « Répondants ». A row opens its answers.
// Mockup: surveys-mockups/Answers.html frames 7–11.
const props = defineProps<{ survey: Survey }>()
const { t, n } = useI18n()
const toast = useToast()
const text = useSurveyText()

const NONE = 0
const search = ref('')
const user = ref<number | string | null>(NONE)
const team = ref<number | string | null>(NONE)
const from = ref('')
const to = ref('')
const sort = ref('-visit_date')
const page = ref(1)
const perPage = ref(25)
const rows = ref<SurveyAnswerRow[]>([])
const total = ref(0)
const professionals = ref(0)
const loading = ref(false)

const filters = () => ({
  sort: sort.value,
  'filter[search]': search.value || undefined,
  'filter[user_id]': Number(user.value) || undefined,
  'filter[team_id]': Number(team.value) || undefined,
  'filter[from]': from.value || undefined,
  'filter[to]': to.value || undefined,
})
async function load() {
  loading.value = true
  try {
    const answer = await fetchSurveyAnswers(props.survey.id, { ...filters(), page: page.value, per_page: perPage.value })
    rows.value = answer.items
    total.value = answer.total
    professionals.value = answer.professionals
  }
  finally {
    loading.value = false
  }
}
watch([search, user, team, from, to, sort], () => { page.value = 1; load() })
watch([page, perPage], load, { immediate: true })

// The filters' lists: the people of the survey the viewer sees, and the teams.
const people = ref<{ value: number; label: string }[]>([])
const teams = ref<{ value: number; label: string }[]>([])
onMountedAndFocus(async () => {
  const [list, allTeams] = await Promise.all([fetchRespondents(props.survey.id).catch(() => null), fetchAllTeams().catch(() => [])])
  people.value = (list?.items ?? []).map(row => ({ value: row.user.id, label: row.user.full_name }))
  teams.value = allTeams.map(row => ({ value: row.id, label: row.name }))
})
const peopleOptions = computed(() => [{ value: NONE, label: t('surveys.answers.allPeople') }, ...people.value])
const teamOptions = computed(() => [{ value: NONE, label: t('surveys.respondents.allTeams') }, ...teams.value])

// An « at each visit » survey shows its first short answers as columns (one row per visit, to follow a professional).
const extra = computed(() => rows.value[0]?.columns ?? [])
const columns = computed(() => [
  { key: 'hcp', label: t('surveys.respondents.professional'), sortKey: 'hcp' },
  { key: 'where', label: t('surveys.answers.where'), secondary: true },
  { key: 'user', label: t('surveys.respondents.person'), sortKey: 'user' },
  { key: 'team', label: t('surveys.respondents.team'), secondary: true },
  { key: 'visit', label: t('surveys.answers.visit'), sortKey: 'visit_date' },
  ...extra.value.map((column, i) => ({ key: `column${i}`, label: column.number, secondary: true })),
  { key: 'answered', label: t('surveys.answers.answered'), align: 'end' as const },
])

const selected = ref<SurveyAnswerRow | null>(null)
const showing = ref(false)
function open(row: SurveyAnswerRow) {
  selected.value = row
  showing.value = true
}

// Excel: one line per professional and visit, one column per question (built here, docs/api/survey-answers.md).
const exporting = ref(false)
async function download() {
  exporting.value = true
  try {
    const { rows: lines, questions } = await exportSurveyAnswers(props.survey.id, filters())
    const sheet = lines.map(line => ({
      [t('surveys.answers.xl.user')]: line.user,
      [t('surveys.answers.xl.team')]: line.team ?? '',
      [t('surveys.answers.xl.hcp')]: line.hcp,
      [t('surveys.answers.xl.type')]: t(`surveys.respondents.kind.${line.hcp_type}`),
      [t('surveys.answers.xl.speciality')]: line.speciality ?? '',
      [t('surveys.answers.xl.segment')]: line.segment ?? '',
      [t('surveys.answers.xl.wilaya')]: line.wilaya ?? '',
      [t('surveys.answers.xl.visitDate')]: line.visit_date,
      ...Object.fromEntries(questions.map(question => [`${question.number} ${question.question_text}`, line.answers[question.id] ?? ''])),
    }))
    await exportToXlsx(sheet, `${props.survey.name} ${text.date(new Date().toISOString())}`, t('surveys.answers.xl.sheet'))
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
    <div class="flex flex-wrap items-end gap-2.5">
      <div class="w-56 max-md:w-full"><DlInput v-model="search" :label="t('surveys.respondents.searchHcp')" :placeholder="t('surveys.respondents.searchHcp')" icon="tabler-search" hide-label /></div>
      <DlSelect v-model="user" :label="t('surveys.respondents.person')" :options="peopleOptions" appearance="filter" />
      <DlSelect v-model="team" :label="t('surveys.respondents.team')" :options="teamOptions" appearance="filter" />
      <div class="w-64 max-md:w-full"><DlDateRangePicker v-model:start="from" v-model:end="to" :label="t('surveys.answers.period')" :placeholder="t('surveys.answers.period')" hide-label clearable /></div>
      <DlButton variant="outline" icon="tabler-file-spreadsheet" class="ms-auto" :loading="exporting" :disabled="!total" @click="download">{{ t('surveys.answers.export') }}</DlButton>
    </div>

    <div class="rounded-3xl bg-dl-paper p-4 md:p-5 max-md:bg-transparent max-md:p-0">
      <DlDataList
        v-model:sort="sort"
        default-sort="-visit_date"
        :label="t('surveys.answers.title')"
        :columns="columns"
        :rows="rows"
        :row-key="row => row.visit.id"
        :selected-key="showing ? selected?.visit.id : undefined"
        :loading="loading"
        :empty-title="t('surveys.answers.emptyTitle')"
        :empty-text="t('surveys.answers.emptyText')"
        @open="open"
      >
        <template #cell-hcp="{ row }"><strong class="font-semibold">{{ row.hcp.name }}</strong></template>
        <template #cell-where="{ row }"><span class="text-dl-muted">{{ [row.speciality, row.segment, row.wilaya].filter(Boolean).join(' · ') || '—' }}</span></template>
        <template #cell-user="{ row }">{{ row.user.full_name }}</template>
        <template #cell-team="{ row }">{{ row.team?.name ?? '—' }}</template>
        <template #cell-visit="{ row }">{{ text.date(row.visit.visit_date) }}</template>
        <template v-for="(column, i) in extra" :key="column.question_id" #[`cell-column${i}`]="{ row }">{{ row.columns[i]?.text ?? '—' }}</template>
        <template #cell-answered="{ row }">{{ n(row.answered_count) }} / {{ n(row.questions_count) }}</template>
        <template #card="{ row }">
          <strong class="block font-semibold">{{ row.hcp.name }}</strong>
          <span class="text-xs text-dl-muted">{{ [row.user.full_name, text.date(row.visit.visit_date), `${row.answered_count} / ${row.questions_count}`].join(' · ') }}</span>
        </template>
      </DlDataList>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <span class="text-xs text-dl-muted">{{ t(survey.is_per_visit ? 'surveys.answers.countPerVisit' : 'surveys.answers.count', { visits: n(total), professionals: n(professionals) }) }}</span>
      <DlPagination v-model="page" v-model:per-page="perPage" :total="total" class="ms-auto" />
    </div>

    <SurveyAnswerSheet v-if="selected && showing" v-model:open="showing" :survey="survey" :row="selected" />
  </div>
</template>
