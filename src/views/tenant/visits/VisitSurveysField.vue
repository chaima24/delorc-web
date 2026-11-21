<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchVisitSurveys, type VisitSurvey, type VisitSurveyPayload } from '@/api/tenant/surveys'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import SurveyAnswersView from '@/views/tenant/surveys/SurveyAnswersView.vue'
import SurveyQuestionsForm from '@/views/tenant/surveys/SurveyQuestionsForm.vue'
import { draftOf, missingRequired, payloadOf, type AnswerDraft } from '@/views/tenant/surveys/surveyAnswers'
import { useSurveyText } from '@/views/tenant/surveys/surveyDisplay'

// The surveys of a visit report (docs/api/survey-answers.md), one block each: closed with « Répondre », open with
// its questions and « Ne pas répondre »; « Reprendre les réponses du … » for an « at each visit » survey; a « once »
// survey answered on another visit shows its answers read only, with the visit to correct. The answers go with the
// report: `entries` is what the page sends as `surveys`. Mockup: surveys-mockups/Answers.html frames 1–4.
export interface SurveySummaryLine { name: string; label: string; tone: 'success' | 'warning' | 'neutral' }

const props = defineProps<{
  query: { user_id?: number | null; visitable_type: string; visitable_id: number; date: string } | null
  visitId?: number
  /** The page's field errors (`surveys.0.answers.2`…), read against the entries sent. */
  errors?: Record<string, string>
}>()
const entries = defineModel<VisitSurveyPayload[]>('entries', { default: () => [] })
const summary = defineModel<SurveySummaryLine[]>('summary', { default: () => [] })
const { t, n } = useI18n()
const text = useSurveyText()

interface Block { data: VisitSurvey; open: boolean; draft: AnswerDraft; showAnswers: boolean }
const blocks = ref<Block[]>([])
watch(() => (props.query ? JSON.stringify({ ...props.query, visit_id: props.visitId }) : ''), async () => {
  const surveys = props.query ? await fetchVisitSurveys({ ...props.query, visit_id: props.visitId }).catch(() => []) : []
  blocks.value = surveys.map(data => ({ data, open: !!data.answers, draft: draftOf(data.questions, data.answers), showAnswers: false }))
}, { immediate: true })

function answer(block: Block) {
  block.open = true
}
function skip(block: Block) {
  block.open = false
  block.draft = draftOf(block.data.questions)
}
function takeLast(block: Block) {
  block.draft = draftOf(block.data.questions, block.data.last?.answers ?? null)
}

// What the report sends: an open survey with its answers; a closed one that had answers here loses them.
watch(blocks, () => {
  entries.value = blocks.value.filter(block => block.data.can_answer && (block.open || block.data.answers))
    .map(block => ({ survey_id: block.data.survey.id, answers: block.open ? payloadOf(block.data.questions, block.draft) : [] }))
  summary.value = blocks.value.map(block => ({ name: block.data.survey.name, ...line(block) }))
}, { deep: true, immediate: true })

function line(block: Block): Omit<SurveySummaryLine, 'name'> {
  if (block.data.answered) return { label: t('surveys.answer.answeredOn', { date: text.date(block.data.answered.visit_date) }), tone: 'success' }
  if (!block.open) return { label: t(block.data.can_answer ? 'surveys.answer.skipped' : 'surveys.answer.readOnly'), tone: 'neutral' }
  const missing = missingRequired(block.data.questions, block.draft).length
  if (missing) return { label: t('surveys.answer.missing', { count: missing }, missing), tone: 'warning' }
  const total = block.data.questions.filter(question => question.type !== 'title').length
  return { label: `${n(payloadOf(block.data.questions, block.draft).length)} / ${n(total)}`, tone: 'success' }
}

// The API's errors, put back on their survey and question.
const sentIndex = (block: Block) => entries.value.findIndex(entry => entry.survey_id === block.data.survey.id)
function surveyError(block: Block): string | undefined {
  const i = sentIndex(block)
  return i < 0 ? undefined : props.errors?.[`surveys.${i}.survey_id`] ?? props.errors?.[`surveys.${i}.answers`]
}
function questionErrors(block: Block): Record<number, string> {
  const i = sentIndex(block)
  const found: Record<number, string> = {}
  entries.value[i]?.answers.forEach((sent, j) => {
    const message = props.errors?.[`surveys.${i}.answers.${j}`]
    if (message) found[sent.question_id] = message
  })
  return found
}
const count = (block: Block) => block.data.questions.filter(question => question.type !== 'title').length
const required = (block: Block) => block.data.questions.filter(question => question.is_required).length
const meta = (block: Block) => [text.mode(block.data.survey.is_per_visit), t('surveys.answer.questions', { count: count(block), required: required(block) })].join(' · ')
</script>

<template>
  <section v-for="block in blocks" :key="block.data.survey.id" class="flex flex-col gap-3 rounded-3xl bg-dl-paper p-4 md:p-5" :class="block.open && 'ring-2 ring-dl-ink'">
    <header class="flex flex-wrap items-center gap-2">
      <DlBadge v-if="block.data.answered" size="sm" tone="success">{{ t('surveys.answer.answeredOn', { date: text.date(block.data.answered.visit_date) }) }}</DlBadge>
      <DlBadge v-else size="sm" tone="info">{{ t('surveys.answer.survey') }}</DlBadge>
      <h2 class="text-base font-semibold">{{ block.data.survey.name }}</h2>
      <span class="text-xs text-dl-muted">{{ meta(block) }}</span>
      <span class="ms-auto flex gap-2">
        <DlButton v-if="block.data.can_answer && !block.open" size="sm" variant="primary" @click="answer(block)">{{ t('surveys.answer.answer') }}</DlButton>
        <DlButton v-else-if="block.data.can_answer" size="sm" variant="ghost" @click="skip(block)">{{ t('surveys.answer.skip') }}</DlButton>
        <DlButton v-else-if="block.data.answered" size="sm" variant="ghost" :icon="block.showAnswers ? 'tabler-chevron-up' : 'tabler-chevron-down'" @click="block.showAnswers = !block.showAnswers">{{ t('surveys.answer.seeAnswers') }}</DlButton>
      </span>
    </header>

    <template v-if="block.data.answered">
      <SurveyAnswersView v-if="block.showAnswers" :questions="block.data.questions" :answers="block.data.answered.answers" />
      <p class="rounded-xl bg-dl-mist px-3 py-2.5 text-xs text-dl-muted">
        {{ t('surveys.answer.answeredHint', { date: text.date(block.data.answered.visit_date) }) }}
        <RouterLink :to="{ name: 'tenant-visit-detail', params: { id: block.data.answered.visit_id } }" class="font-semibold text-dl-cobalt underline">{{ t('surveys.answer.openVisit') }}</RouterLink>
      </p>
    </template>
    <SurveyAnswersView v-else-if="!block.data.can_answer && block.data.answers" :questions="block.data.questions" :answers="block.data.answers" />
    <template v-else-if="block.open">
      <div v-if="block.data.last" class="flex flex-wrap items-center gap-2.5">
        <DlButton size="sm" variant="outline" icon="tabler-arrow-back-up" @click="takeLast(block)">{{ t('surveys.answer.takeLast', { date: text.date(block.data.last.visit_date) }) }}</DlButton>
        <span class="text-xs text-dl-muted">{{ t('surveys.answer.takeLastHint') }}</span>
      </div>
      <SurveyQuestionsForm v-model="block.draft" :questions="block.data.questions" :errors="questionErrors(block)" />
    </template>
    <p v-if="surveyError(block)" class="rounded-xl bg-dl-rejected/8 px-3 py-2.5 text-xs text-dl-rejected">{{ surveyError(block) }}</p>
  </section>
</template>
