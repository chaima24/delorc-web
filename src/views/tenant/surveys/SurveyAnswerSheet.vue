<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchSurveyAnswerSet, type Survey, type SurveyAnswerRow } from '@/api/tenant/surveys'
import DlButton from '@/components/DlButton.vue'
import DlSheet from '@/components/DlSheet.vue'
import DlSkeleton from '@/components/DlSkeleton.vue'
import { useAuthStore } from '@/stores/auth'
import SurveyAnswersView from './SurveyAnswersView.vue'
import { useSurveyText } from './surveyDisplay'

// One professional's answers on one visit, grouped like the questions, with the visit to open (where they are
// corrected). The questions come from the survey's page. Mockup: surveys-mockups/Answers.html frame 8.
const props = defineProps<{ survey: Survey; row: SurveyAnswerRow }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const auth = useAuthStore()
const text = useSurveyText()

const set = ref<SurveyAnswerRow | null>(null)
watch(() => props.row.visit.id, async (visit) => {
  set.value = null
  set.value = await fetchSurveyAnswerSet(props.survey.id, visit).catch(() => null)
}, { immediate: true })
</script>

<template>
  <DlSheet
    v-model:open="open"
    size="lg"
    :title="row.hcp.name"
    :description="[[row.speciality, row.segment, row.wilaya].filter(Boolean).join(' · '), t('surveys.answers.answeredBy', { name: row.user.full_name, date: text.date(row.visit.visit_date) })].filter(Boolean).join(' · ')"
  >
    <div class="flex flex-col gap-4">
      <DlSkeleton v-if="!set" class="h-48 rounded-2xl" />
      <SurveyAnswersView v-else :questions="survey.questions ?? []" :answers="set.answers ?? []" />
      <p class="rounded-xl bg-dl-mist px-3 py-2.5 text-xs text-dl-muted">{{ t('surveys.answers.fixInVisit') }}</p>
    </div>
    <template #footer>
      <DlButton v-if="auth.can('visits.show')" variant="outline" icon="tabler-external-link" :to="{ name: 'tenant-visit-detail', params: { id: row.visit.id } }">{{ t('surveys.answers.openVisit', { date: text.date(row.visit.visit_date) }) }}</DlButton>
      <DlButton variant="dark" class="ms-auto" @click="open = false">{{ t('common.actions.close') }}</DlButton>
    </template>
  </DlSheet>
</template>
