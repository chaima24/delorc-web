<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { SurveyQuestion } from '@/api/tenant/surveys'
import DlInput from '@/components/DlInput.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { computed } from 'vue'
import { payloadOf, shownOf, type AnswerDraft } from './surveyAnswers'
import { useRuleWords } from './surveyDisplay'
import { answersMap, failing, sumOf } from './surveyRules'

// A survey's questions as inputs, grouped under their titles (docs/api/survey-answers.md): numbers, percentages,
// texts, one choice (chips, or a list when its display says so), several choices (chips); « Autre » asks its text.
// The rules apply live (docs/api/survey-rules.md): a hidden question or title is not drawn, a failing check shows
// under its question, a sum shows its running total. Used in the visit report, the visit page's survey cards and
// « Aperçu ». Mockups: surveys-mockups/Answers.html frame 2, Rules.html frames 7–8.
const props = defineProps<{ questions: SurveyQuestion[]; errors?: Record<number, string> }>()
const draft = defineModel<AnswerDraft>({ required: true })
const { t, n } = useI18n()
const { words } = useRuleWords()

const answers = computed(() => answersMap(payloadOf(props.questions, draft.value)))
const visible = computed(() => shownOf(props.questions, draft.value))
const drawn = computed(() => props.questions.filter(question => visible.value[question.id]))
const hidden = computed(() => props.questions.filter(question => question.type !== 'title' && !visible.value[question.id]).length)
// The API's errors first, then the live checks.
const messages = computed(() => ({ ...failing(props.questions, answers.value, visible.value, words), ...props.errors }))
const sumLine = (question: SurveyQuestion) => {
  const sum = question.checks?.find(check => check.type === 'sum')
  return sum ? t('surveys.rules.total', { questions: sum.text?.split(' = ')[0] ?? '', total: n(sumOf(sum.question_ids ?? [], answers.value)), value: n(Number(sum.value)) }) : null
}

function toggle(question: SurveyQuestion, id: number) {
  const entry = draft.value[question.id]!
  if (question.type === 'single_choice') {
    entry.option_ids = entry.option_ids.includes(id) ? [] : [id]
    return
  }
  entry.option_ids = entry.option_ids.includes(id) ? entry.option_ids.filter(one => one !== id) : [...entry.option_ids, id]
}
const otherChosen = (question: SurveyQuestion) => question.options.some(option => option.is_other && draft.value[question.id]!.option_ids.includes(option.id))
const label = (question: SurveyQuestion) => `${question.number}. ${question.question_text}${question.is_required ? ' *' : ''}`
const listModel = (question: SurveyQuestion) => ({
  get: () => draft.value[question.id]!.option_ids[0] ?? null,
  set: (value: string | number | null | undefined) => { draft.value[question.id]!.option_ids = value == null ? [] : [Number(value)] },
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <template v-for="question in drawn" :key="question.id">
      <h3 v-if="question.type === 'title'" class="border-t border-dl-line-soft pt-3 text-xs font-bold uppercase tracking-[0.04em] text-dl-muted first:border-0 first:pt-0">{{ question.question_text }}</h3>
      <div v-else class="flex flex-col gap-1.5">
        <template v-if="question.type === 'numeric' || question.type === 'percentage'">
          <div class="max-w-48"><DlInput v-model="draft[question.id]!.value" type="number" inputmode="decimal" :label="label(question)" :placeholder="question.type === 'percentage' ? '0 – 100 %' : ''" :error="messages[question.id]" /></div>
          <span v-if="sumLine(question)" class="text-xs text-dl-muted">{{ sumLine(question) }}</span>
        </template>
        <DlInput v-else-if="question.type === 'text'" v-model="draft[question.id]!.value" :label="label(question)" :placeholder="question.is_required ? '' : t('surveys.answer.optional')" :error="messages[question.id]" />
        <template v-else-if="question.type === 'free_text'">
          <DlTextarea v-model="draft[question.id]!.value" :label="label(question)" :rows="3" :placeholder="question.is_required ? '' : t('surveys.answer.optional')" :error="messages[question.id]" />
        </template>
        <template v-else>
          <div v-if="question.type === 'single_choice' && question.display === 'list'" class="sm:max-w-md">
            <DlSelect :model-value="listModel(question).get()" :label="label(question)" :options="question.options.map(option => ({ value: option.id, label: option.label }))" :placeholder="t('surveys.preview.pick')" @update:model-value="listModel(question).set" />
          </div>
          <template v-else>
            <span class="text-[13px] font-semibold">{{ label(question) }}</span>
            <div class="flex flex-wrap gap-2" role="group" :aria-label="question.question_text">
              <button
                v-for="option in question.options"
                :key="option.id"
                type="button"
                class="rounded-[10px] border px-3 py-1.5 text-[13px] transition-colors"
                :class="draft[question.id]!.option_ids.includes(option.id) ? 'border-dl-ink bg-dl-ink text-dl-on-ink' : 'border-dl-line bg-dl-paper hover:border-dl-ink'"
                :aria-pressed="draft[question.id]!.option_ids.includes(option.id)"
                @click="toggle(question, option.id)"
              >
                {{ option.label }}
              </button>
            </div>
          </template>
          <div v-if="otherChosen(question)" class="sm:max-w-md"><DlInput v-model="draft[question.id]!.other_text" :label="t('surveys.answer.otherText')" :placeholder="t('surveys.answer.otherText')" hide-label /></div>
          <span v-if="messages[question.id]" class="text-xs text-dl-rejected">{{ messages[question.id] }}</span>
        </template>
      </div>
    </template>
    <p v-if="hidden" class="rounded-xl border border-dashed border-dl-line px-3 py-2 text-xs text-dl-muted">{{ t('surveys.rules.hiddenCount', { count: hidden }, hidden) }}</p>
  </div>
</template>
