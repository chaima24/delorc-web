<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fieldErrors } from '@/api/errors'
import { fetchVisitSurveys, type VisitSurvey } from '@/api/tenant/surveys'
import { updateVisit, type Visit } from '@/api/tenant/visits'
import DlBadge from '@/components/DlBadge.vue'
import DlRecordSection from '@/components/DlRecordSection.vue'
import { useToast } from '@/composables/useToast'
import SurveyAnswersView from '@/views/tenant/surveys/SurveyAnswersView.vue'
import SurveyQuestionsForm from '@/views/tenant/surveys/SurveyQuestionsForm.vue'
import { draftOf, sentOf, type AnswerDraft } from '@/views/tenant/surveys/surveyAnswers'

// A done visit's surveys (docs/api/survey-answers.md): one card per survey answered here, and per survey still
// offered, edited in place like the other cards. Saving sends only that survey; an emptied card removes its answers.
// Read only once the visit is locked, the survey closed or the person paused. Mockup: surveys-mockups/Answers.html frames 5–6.
const props = defineProps<{ visit: Visit; canEdit: boolean }>()
const emit = defineEmits<{ saved: [visit: Visit] }>()
const { t, n } = useI18n()
const toast = useToast()

const surveys = ref<VisitSurvey[]>([])
async function load() {
  const visit = props.visit
  surveys.value = visit.target.type === 'hcp'
    ? (await fetchVisitSurveys({ user_id: visit.user?.id, visitable_type: 'hcp', visitable_id: visit.target.id, date: visit.visit_date, visit_id: visit.id }).catch(() => []))
        .filter(row => row.answers || (row.can_answer && !row.answered))
    : []
}
watch(() => `${props.visit.id}-${props.visit.surveys_count}`, load, { immediate: true })

const editing = ref<number | null>(null)
const draft = ref<AnswerDraft>({})
const errors = ref<Record<number, string>>({})
const error = ref('')
const busy = ref(false)
function edit(row: VisitSurvey) {
  draft.value = draftOf(row.questions, row.answers)
  errors.value = {}
  error.value = ''
  editing.value = row.survey.id
}
async function save(row: VisitSurvey) {
  const answers = sentOf(row.questions, draft.value)
  busy.value = true
  try {
    const visit = await updateVisit(props.visit.id, { surveys: [{ survey_id: row.survey.id, answers }] })
    toast.success(t('studio.list.toast.saved'))
    editing.value = null
    emit('saved', visit)
    await load()
  }
  catch (failure) {
    const found = fieldErrors(failure)
    errors.value = Object.fromEntries(answers.map((sent, j) => [sent.question_id, found[`surveys.0.answers.${j}`]]).filter(([, message]) => message))
    error.value = found['surveys.0.answers'] ?? found['surveys.0.survey_id'] ?? ''
  }
  finally {
    busy.value = false
  }
}
const answeredCount = (row: VisitSurvey) => row.answers?.length ?? 0
const total = (row: VisitSurvey) => row.questions.filter(question => question.type !== 'title').length
</script>

<template>
  <DlRecordSection
    v-for="row in surveys"
    :key="row.survey.id"
    :editing="editing === row.survey.id"
    :can-edit="canEdit && row.can_answer && editing === null"
    :saving="busy"
    :title="row.answers ? `${row.survey.name} · ${n(answeredCount(row))} / ${n(total(row))}` : row.survey.name"
    icon="tabler-clipboard-list"
    class="bg-dl-paper"
    @update:editing="edit(row)"
    @save="save(row)"
    @cancel="editing = null"
  >
    <SurveyAnswersView v-if="row.answers" :questions="row.questions" :answers="row.answers" />
    <p v-else class="text-[13px] text-dl-muted"><DlBadge size="sm" class="me-1.5">{{ t('surveys.answer.notAnswered') }}</DlBadge>{{ t('surveys.answer.notAnsweredHint') }}</p>
    <template #edit>
      <div class="flex flex-col gap-3">
        <SurveyQuestionsForm v-model="draft" :questions="row.questions" :errors="errors" />
        <p class="text-xs text-dl-muted">{{ t('surveys.answer.emptyRemoves') }}</p>
        <p v-if="error" class="rounded-xl bg-dl-rejected/8 px-3 py-2.5 text-xs text-dl-rejected">{{ error }}</p>
      </div>
    </template>
  </DlRecordSection>
</template>
