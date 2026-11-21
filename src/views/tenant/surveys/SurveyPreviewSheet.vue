<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Survey } from '@/api/tenant/surveys'
import DlButton from '@/components/DlButton.vue'
import DlSheet from '@/components/DlSheet.vue'
import SurveyQuestionsForm from './SurveyQuestionsForm.vue'
import { draftOf, type AnswerDraft } from './surveyAnswers'

// « Aperçu »: the survey as the rep will fill it, to try out (19c): answers can be typed, the conditions and checks
// apply live; nothing is saved. Mockups: surveys-mockups/Surveys.html frame 7, Rules.html (proposals).
const props = defineProps<{ survey: Survey }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()

const draft = ref<AnswerDraft>({})
const reset = () => { draft.value = draftOf(props.survey.questions ?? []) }
watch(open, value => { if (value) reset() }, { immediate: true })
</script>

<template>
  <DlSheet v-model:open="open" :title="t('surveys.preview.title')" :description="t('surveys.preview.description')" size="lg">
    <p v-if="!survey.questions?.length" class="text-sm text-dl-muted">{{ t('surveys.page.noQuestions') }}</p>
    <div v-else class="flex flex-col gap-4">
      <p class="rounded-xl bg-dl-mist px-3 py-2.5 text-xs text-dl-muted">{{ t('surveys.preview.tryHint') }}</p>
      <SurveyQuestionsForm v-model="draft" :questions="survey.questions" />
    </div>
    <template #footer>
      <DlButton variant="ghost" icon="tabler-refresh" @click="reset">{{ t('surveys.preview.reset') }}</DlButton>
      <DlButton variant="dark" class="ms-auto" @click="open = false">{{ t('common.actions.close') }}</DlButton>
    </template>
  </DlSheet>
</template>
