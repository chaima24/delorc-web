<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import { createCoachingQuestion, updateCoachingQuestion, type CoachingFamily, type CoachingQuestion } from '@/api/tenant/coaching'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlRecordPanel from '@/components/DlRecordPanel.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useToast } from '@/composables/useToast'

// Add or change a question: its section, its text, its place, active or not. Mockup frame 2.
const props = defineProps<{
  families: CoachingFamily[]
  sectionId: number
  /** The question changed, or null to add one. */
  question: CoachingQuestion | null
  /** How many questions the section holds (for "at the end"). */
  count: number
}>()
const emit = defineEmits<{ saved: [question: CoachingQuestion] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()

const section = ref<string | number | null>(props.sectionId)
const text = ref('')
const place = ref<string | number | null>('')
const active = ref(true)
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(open, value => {
  if (!value) return
  section.value = props.question?.coaching_category_id ?? props.sectionId
  text.value = props.question?.question ?? ''
  place.value = props.question?.sort ?? ''
  active.value = props.question?.is_active ?? true
  errors.value = {}
}, { immediate: true })

const sectionOptions = computed(() => props.families.flatMap(family => family.sections.map(row => ({ value: row.id, label: `${family.name} › ${row.name}` }))))
const sectionName = computed(() => sectionOptions.value.find(option => option.value === section.value)?.label ?? '')

async function save() {
  errors.value = {}
  saving.value = true
  try {
    const sort = place.value === '' || place.value == null ? undefined : Number(place.value)
    const sectionId = Number(section.value)
    const saved = props.question
      ? await updateCoachingQuestion(props.question.id, { coaching_category_id: sectionId, question: text.value, is_active: active.value, ...(sectionId === props.question.coaching_category_id && sort ? { sort } : {}) })
      : await createCoachingQuestion({ coaching_category_id: sectionId, question: text.value, is_active: active.value, sort })
    toast.success(t('studio.list.toast.saved'))
    open.value = false
    emit('saved', saved)
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
  <DlRecordPanel v-model:open="open" :title="question ? t('coaching.question.edit') : t('coaching.question.add')" :description="sectionName">
    <form id="coaching-question" class="flex flex-col gap-4" @submit.prevent="save">
      <DlSelect v-model="section" :label="t('coaching.fields.section')" :options="sectionOptions" />
      <DlTextarea v-model="text" :label="t('coaching.fields.question')" :rows="3" :error="errors.question || errors.coaching_category_id" />
      <DlInput v-model="place" type="number" :label="t('coaching.fields.place')" :hint="t('coaching.question.placeHint', { n: question ? count : count + 1 })" :error="errors.sort" />
      <DlSwitch v-model="active" :label="t('coaching.question.active')" />
      <p class="rounded-xl bg-dl-mist px-3 py-2 text-xs text-dl-body">{{ t('coaching.question.notes') }}</p>
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton type="submit" form="coaching-question" variant="primary" class="ms-auto" :loading="saving">{{ question ? t('common.actions.save') : t('coaching.question.addButton') }}</DlButton>
    </template>
  </DlRecordPanel>
</template>
