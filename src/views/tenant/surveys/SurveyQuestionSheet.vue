<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage, fieldErrors } from '@/api/errors'
import {
  ANSWER_TYPES, CHOICE_TYPES, createQuestion, updateQuestion,
  type QuestionCategory, type QuestionDisplay, type QuestionPayload, type QuestionType, type Survey, type SurveyQuestion,
} from '@/api/tenant/surveys'
import DlButton from '@/components/DlButton.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import DlSheet from '@/components/DlSheet.vue'
import DlSwitch from '@/components/DlSwitch.vue'
import DlTextarea from '@/components/DlTextarea.vue'
import { useToast } from '@/composables/useToast'
import { useSurveyText } from './surveyDisplay'

// A question in a side panel: its type (picked first for a new one), text, category, title it sits under, required,
// and for a choice its options in order, how it is drawn and an « Autre » to type. A title has only its text.
// Mockup: surveys-mockups/Surveys.html frames 5, 6.
const props = defineProps<{
  survey: Survey
  /** null = a new one. */
  question: SurveyQuestion | null
  /** A new title (« + Titre ») rather than a question. */
  title?: boolean
  categories: QuestionCategory[]
}>()
const emit = defineEmits<{ saved: [survey: Survey] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
const toast = useToast()
const text = useSurveyText()

const NONE = 0
interface Option { key: number; label: string; is_other: boolean }
let nextKey = 1
const option = (label = '', isOther = false): Option => ({ key: nextKey++, label, is_other: isOther })
const empty = () => ({
  type: (props.title ? 'title' : 'numeric') as QuestionType,
  question_text: '',
  category: NONE as number | string | null,
  parent: NONE as number | string | null,
  is_required: false,
  display: 'expanded' as string,
  options: [option(), option()] as Option[],
})
const form = ref(empty())
const errors = ref<Record<string, string>>({})
const saving = ref(false)
watch(open, value => {
  if (!value) return
  errors.value = {}
  const q = props.question
  form.value = q
    ? {
        type: q.type,
        question_text: q.question_text,
        category: q.category?.id ?? NONE,
        parent: q.parent_id ?? NONE,
        is_required: q.is_required,
        display: q.display ?? 'expanded',
        options: q.options.length ? q.options.map(o => option(o.label, o.is_other)) : [option(), option()],
      }
    : empty()
}, { immediate: true })

const isTitle = computed(() => form.value.type === 'title')
const isChoice = computed(() => CHOICE_TYPES.includes(form.value.type))
const heading = computed(() => {
  if (props.question) return props.question.number ? `${props.question.number} · ${props.question.question_text}` : props.question.question_text
  return t(props.title ? 'surveys.question.newTitle' : 'surveys.question.new')
})
const typeOptions = computed(() => ANSWER_TYPES.map(type => ({ value: type, label: text.type(type) })))
const categoryOptions = computed(() => [{ value: NONE, label: t('surveys.question.noCategory') }, ...props.categories.map(c => ({ value: c.id, label: c.category }))])
const titleOptions = computed(() => [
  { value: NONE, label: t('surveys.question.noTitle') },
  ...(props.survey.questions ?? []).filter(q => q.type === 'title').map(q => ({ value: q.id, label: q.question_text })),
])
const displayItems = computed(() => [
  { value: 'expanded', label: t(form.value.type === 'multiple_choice' ? 'surveys.question.display.checkboxes' : 'surveys.question.display.buttons') },
  { value: 'list', label: t('surveys.question.display.list') },
])
const hasOther = computed(() => form.value.options.some(o => o.is_other))

function move(index: number, by: number) {
  const list = form.value.options
  const to = index + by
  if (to < 0 || to >= list.length) return
  ;[list[index], list[to]] = [list[to]!, list[index]!]
}

function payload(): QuestionPayload {
  if (isTitle.value) return { type: 'title', question_text: form.value.question_text }
  return {
    type: form.value.type,
    question_text: form.value.question_text,
    survey_question_category_id: Number(form.value.category) || null,
    parent_id: Number(form.value.parent) || null,
    is_required: form.value.is_required,
    ...(isChoice.value
      ? { display: form.value.display as QuestionDisplay, options: form.value.options.map(o => ({ label: o.label.trim(), is_other: o.is_other })) }
      : {}),
  }
}

async function save(again = false) {
  errors.value = {}
  saving.value = true
  try {
    const survey = props.question
      ? await updateQuestion(props.survey.id, props.question.id, payload())
      : await createQuestion(props.survey.id, payload())
    toast.success(t('studio.list.toast.saved'))
    emit('saved', survey)
    if (again) {
      const keep = { type: form.value.type, category: form.value.category, parent: form.value.parent }
      form.value = { ...empty(), ...keep }
    }
    else {
      open.value = false
    }
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(errorMessage(error) ?? t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
const optionError = (i: number) => errors.value[`options.${i}.label`]
</script>

<template>
  <DlSheet v-model:open="open" :title="heading" :description="question ? survey.name : t('surveys.question.pickType')" size="lg">
    <form id="survey-question" class="flex flex-col gap-4" @submit.prevent="save(false)">
      <fieldset v-if="!isTitle && !question" class="grid gap-2.5 sm:grid-cols-2">
        <legend class="sr-only">{{ t('surveys.question.type') }}</legend>
        <button
          v-for="type in ANSWER_TYPES"
          :key="type"
          type="button"
          class="flex flex-col gap-1 rounded-2xl border px-3.5 py-3 text-start text-[13px] transition hover:bg-dl-line-soft focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
          :class="form.type === type ? 'border-dl-ink ring-2 ring-dl-ink' : 'border-dl-line'"
          :aria-pressed="form.type === type"
          @click="form.type = type"
        >
          <strong class="text-sm">{{ text.type(type) }}</strong>
          <span>{{ t(`surveys.types.${type}.hint`) }}</span>
          <span class="text-xs text-dl-muted">{{ t(`surveys.types.${type}.example`) }}</span>
        </button>
      </fieldset>
      <p v-if="!isTitle && !question" class="rounded-2xl bg-dl-mist px-4 py-3 text-[13px] text-dl-muted">{{ t('surveys.question.titleHint') }}</p>

      <DlTextarea v-model="form.question_text" :label="t(isTitle ? 'surveys.question.titleText' : 'surveys.question.text')" :error="errors.question_text" />

      <template v-if="!isTitle">
        <div class="grid gap-3 sm:grid-cols-2">
          <DlSelect v-if="question" v-model="form.type" :label="t('surveys.question.type')" :options="typeOptions" />
          <DlSelect v-model="form.category" :label="t('surveys.question.category')" :options="categoryOptions" />
          <DlSelect v-model="form.parent" :label="t('surveys.question.underTitle')" :options="titleOptions" />
        </div>
        <p v-if="errors.parent_id || errors.type" class="text-xs text-dl-rejected">{{ errors.parent_id ?? errors.type }}</p>
        <div class="flex flex-col gap-1">
          <DlSwitch v-model="form.is_required" :label="t('surveys.question.required')" />
          <span class="text-xs text-dl-muted">{{ t('surveys.question.requiredHint') }}</span>
        </div>

        <template v-if="isChoice">
          <div class="flex flex-col gap-1.5">
            <span class="text-[13px] font-semibold">{{ t('surveys.question.displayLabel') }}</span>
            <DlSegmented v-model="form.display" :label="t('surveys.question.displayLabel')" :items="displayItems" block />
          </div>
          <fieldset class="flex flex-col gap-2">
            <legend class="mb-1 text-[13px] font-semibold">{{ t('surveys.question.options') }} <span class="font-normal text-dl-muted">· {{ t('surveys.question.optionsHint') }}</span></legend>
            <div v-for="(row, i) in form.options" :key="row.key" class="flex items-start gap-1.5">
              <div class="min-w-0 flex-1">
                <DlInput v-model="row.label" :label="t('surveys.question.option', { n: i + 1 })" hide-label :placeholder="row.is_other ? t('surveys.question.otherPlaceholder') : t('surveys.question.option', { n: i + 1 })" :error="optionError(i)" />
                <span v-if="row.is_other" class="text-xs text-dl-muted">{{ t('surveys.question.otherHint') }}</span>
              </div>
              <DlIconButton icon="tabler-arrow-up" variant="ghost" :size="36" :label="t('surveys.question.moveUp')" :disabled="i === 0" @click="move(i, -1)" />
              <DlIconButton icon="tabler-arrow-down" variant="ghost" :size="36" :label="t('surveys.question.moveDown')" :disabled="i === form.options.length - 1" @click="move(i, 1)" />
              <DlIconButton icon="tabler-trash" variant="ghost" :size="36" :label="t('common.actions.delete')" @click="form.options.splice(i, 1)" />
            </div>
            <div class="flex flex-wrap gap-2">
              <DlButton size="sm" variant="outline" icon="tabler-plus" @click="form.options.push(option())">{{ t('surveys.question.addOption') }}</DlButton>
              <DlButton v-if="!hasOther" size="sm" variant="ghost" icon="tabler-plus" @click="form.options.push(option(t('surveys.question.otherLabel'), true))">{{ t('surveys.question.addOther') }}</DlButton>
            </div>
            <p v-if="errors.options" class="text-xs text-dl-rejected">{{ errors.options }}</p>
          </fieldset>
        </template>
        <p class="rounded-2xl bg-dl-mist px-4 py-3 text-[13px] text-dl-muted">{{ t('surveys.question.rulesLater') }}</p>
      </template>
    </form>
    <template #footer>
      <DlButton variant="ghost" @click="open = false">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton v-if="!question && !isTitle" variant="outline" class="ms-auto" :loading="saving" @click="save(true)">{{ t('surveys.question.saveAndNew') }}</DlButton>
      <DlButton type="submit" form="survey-question" variant="primary" :class="(question || isTitle) && 'ms-auto'" :loading="saving">
        {{ question ? t('geo.save') : t('surveys.question.add') }}
      </DlButton>
    </template>
  </DlSheet>
</template>
