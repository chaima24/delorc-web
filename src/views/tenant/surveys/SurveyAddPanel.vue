<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createSurvey, SURVEY_TARGETS, type Survey, type SurveyTarget } from '@/api/tenant/surveys'
import DlButton from '@/components/DlButton.vue'
import DlDatePicker from '@/components/DlDatePicker.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import { useToast } from '@/composables/useToast'
import { today, useSurveyText, weeks } from './surveyDisplay'

// « Nouvelle enquête »: name, target, mode, period. Brands, objective and questions are filled on its page.
// Mockup: surveys-mockups/Surveys.html frame 2.
const emit = defineEmits<{ created: [survey: Survey] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const text = useSurveyText()

const ONCE = 'once'
const PER_VISIT = 'perVisit'
const empty = () => ({ name: '', target_type: 'doctor' as string, mode: ONCE, start_date: today(), end_date: '' })
const form = ref(empty())
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(open, value => {
  if (!value) return
  form.value = empty()
  errors.value = {}
}, { immediate: true })
const targetItems = computed(() => SURVEY_TARGETS.map(target => ({ value: target, label: text.target(target) })))
const modeItems = computed(() => [{ value: ONCE, label: text.mode(false) }, { value: PER_VISIT, label: text.mode(true) }])
const weekCount = computed(() => weeks(form.value.start_date, form.value.end_date))

async function save() {
  errors.value = {}
  saving.value = true
  try {
    const created = await createSurvey({
      name: form.value.name,
      target_type: form.value.target_type as SurveyTarget,
      is_per_visit: form.value.mode === PER_VISIT,
      start_date: form.value.start_date,
      end_date: form.value.end_date,
    })
    toast.success(t('surveys.add.done'))
    emit('created', created)
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <DlRecordPanel v-model:open="open" :title="t('surveys.add.title')" :description="t('surveys.add.description')">
    <form id="survey-add" class="flex flex-col gap-4" @submit.prevent="save">
      <DlInput v-model="form.name" :label="t('surveys.fields.name')" :error="errors.name" />
      <div class="flex flex-col gap-1.5">
        <span class="text-[13px] font-semibold">{{ t('surveys.fields.target') }}</span>
        <DlSegmented v-model="form.target_type" :label="t('surveys.fields.target')" :items="targetItems" block />
        <p class="text-xs text-dl-muted">{{ t('surveys.fields.targetHint') }}</p>
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="text-[13px] font-semibold">{{ t('surveys.fields.mode') }}</span>
        <DlSegmented v-model="form.mode" :label="t('surveys.fields.mode')" :items="modeItems" block />
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <DlDatePicker v-model="form.start_date" :label="t('surveys.fields.start')" :error="errors.start_date" />
        <DlDatePicker v-model="form.end_date" :label="t('surveys.fields.end')" :min="form.start_date" :error="errors.end_date" />
      </div>
      <p v-if="weekCount" class="text-xs text-dl-muted">{{ t('surveys.fields.weeks', { count: weekCount }, weekCount) }}</p>
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="survey-add" variant="primary" class="ms-auto" :loading="saving">{{ t('surveys.add.save') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
