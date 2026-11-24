<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { errorMessage } from '@/api/errors'
import { duplicateSurvey, type Survey } from '@/api/tenant/surveys'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import { useToast } from '@/composables/useToast'
import { STATUS_TONE, useSurveyText } from './surveyDisplay'

// Reading panel beside the list: the survey's card; its questions on its page. Mockup frame 1.
const props = defineProps<{ survey: Survey }>()
const open = defineModel<boolean>('open', { default: false })
const { t, n } = useI18n()
const router = useRouter()
const toast = useToast()
const text = useSurveyText()

const rows = computed(() => [
  { label: t('surveys.fields.target'), value: text.target(props.survey.target_type) },
  { label: t('surveys.fields.mode'), value: text.mode(props.survey.is_per_visit) },
  { label: t('surveys.fields.period'), value: `${text.period(props.survey.start_date, props.survey.end_date)} · ${t('surveys.fields.weeks', { count: props.survey.weeks_count }, props.survey.weeks_count)}` },
  { label: t('surveys.fields.objective'), value: props.survey.objective_per_week == null ? '—' : n(props.survey.objective_per_week) },
  { label: t('surveys.fields.brands'), value: props.survey.brands ? props.survey.brands.map(brand => brand.name).join(', ') || '—' : '…' },
  { label: t('surveys.fields.questions'), value: t('surveys.read.questions', { count: props.survey.questions_count, required: props.survey.required_count }) },
])

const copying = ref(false)
async function duplicate() {
  copying.value = true
  try {
    const copy = await duplicateSurvey(props.survey.id)
    toast.success(t('surveys.page.duplicated'))
    router.push({ name: 'tenant-survey', params: { id: copy.id } })
  }
  catch (error) {
    toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    copying.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="survey.name">
    <template #badges>
      <span class="mt-1 flex flex-wrap items-center gap-1.5">
        <DlBadge size="sm" :tone="STATUS_TONE[survey.status]" dot>{{ text.status(survey.status) }}</DlBadge>
        <span v-if="survey.created_by" class="text-xs text-dl-muted">{{ t('surveys.read.by', { name: survey.created_by.full_name, date: text.date(survey.created_at) }) }}</span>
      </span>
    </template>
    <dl class="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-[13px]">
      <template v-for="row in rows" :key="row.label">
        <dt class="text-dl-muted">{{ row.label }}</dt><dd>{{ row.value }}</dd>
      </template>
    </dl>
    <template #footer>
      <DlButton v-if="survey.can?.duplicate" variant="outline" icon="tabler-copy" :loading="copying" @click="duplicate">{{ t('surveys.page.duplicate') }}</DlButton>
      <DlButton variant="dark" icon-end="tabler-arrow-up-right" class="flex-1" :to="{ name: 'tenant-survey', params: { id: survey.id } }">
        {{ t('surveys.read.open') }}
      </DlButton>
    </template>
  </DlRecordPanel>
</template>
