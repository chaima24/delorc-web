<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { SurveyAnswer, SurveyQuestion } from '@/api/tenant/surveys'
import { answerText } from './surveyAnswers'

// A survey's answers read only, grouped like its questions (docs/api/survey-answers.md): Q-number, question, answer
// (« — » when left empty). Used in the visit report (« Répondue le… »), the visit page and the « Réponses » sheet.
const props = defineProps<{ questions: SurveyQuestion[]; answers: SurveyAnswer[] }>()
const { t } = useI18n()
const text = (question: SurveyQuestion) => answerText(question, props.answers.find(answer => answer.question_id === question.id), other => t('surveys.answer.other', { text: other }))
</script>

<template>
  <div class="flex flex-col gap-2 text-[13.5px]">
    <template v-for="question in questions" :key="question.id">
      <h3 v-if="question.type === 'title'" class="border-t border-dl-line-soft pt-2 text-xs font-bold uppercase tracking-[0.04em] text-dl-muted first:border-0 first:pt-0">{{ question.question_text }}</h3>
      <div v-else class="grid grid-cols-[40px_1fr] gap-x-2.5">
        <span class="text-dl-muted">{{ question.number }}</span>
        <span>
          <span class="text-dl-muted">{{ question.question_text }}</span>
          <strong class="block font-semibold" :class="!text(question) && 'font-normal text-dl-muted'">{{ text(question) ?? '—' }}</strong>
        </span>
      </div>
    </template>
  </div>
</template>
