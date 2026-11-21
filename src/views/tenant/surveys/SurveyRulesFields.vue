<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NUMBER_OPERATORS, type DisplayMatch, type QuestionType, type SurveyCheck, type SurveyCondition, type SurveyQuestion } from '@/api/tenant/surveys'
import DlButton from '@/components/DlButton.vue'
import DlIconButton from '@/components/DlIconButton.vue'
import DlInput from '@/components/DlInput.vue'
import DlSegmented from '@/components/DlSegmented.vue'
import DlSelect from '@/components/DlSelect.vue'
import { useRuleWords } from './surveyDisplay'

// The rules of a question or a title, in its sheet (docs/api/survey-rules.md): « Afficher seulement si… » (conditions on
// earlier choice or number questions, « toutes » or « au moins une »), and for a number « Contrôles » (compare with
// another number question, or a sum equal to a value). The API checks everything again on save.
// Mockup: surveys-mockups/Rules.html frames 2–5.
export interface RulesForm { display_match: DisplayMatch; conditions: SurveyCondition[]; checks: SurveyCheck[] }

const props = defineProps<{
  /** The survey's questions, in order. */
  questions: SurveyQuestion[]
  /** The question being edited (null for a new one: every current question comes before it). */
  questionId: number | null
  type: QuestionType
  errors: Record<string, string>
}>()
const rules = defineModel<RulesForm>({ required: true })
const { t } = useI18n()
const { operator } = useRuleWords()

const isNumberType = (type: QuestionType) => type === 'numeric' || type === 'percentage'
const isChoiceType = (type: QuestionType) => type === 'single_choice' || type === 'multiple_choice'
const label = (q: SurveyQuestion) => `${q.number} · ${q.question_text}`

// A condition looks at a choice or number question placed before (the server checks the title's place too).
const before = computed(() => {
  const at = props.questionId ? props.questions.findIndex(q => q.id === props.questionId) : props.questions.length
  return props.questions.slice(0, at < 0 ? props.questions.length : at).filter(q => isChoiceType(q.type) || isNumberType(q.type))
})
const sourceOptions = computed(() => before.value.map(q => ({ value: q.id, label: label(q) })))
const source = (condition: SurveyCondition) => props.questions.find(q => q.id === condition.source_question_id)
const operatorOptions = (condition: SurveyCondition) => {
  const q = source(condition)
  const ops: (SurveyCondition['operator'])[] = q && isChoiceType(q.type) ? ['is', 'is_not'] : NUMBER_OPERATORS
  return ops.map(op => ({ value: op, label: operator(op) }))
}
function addCondition() {
  const first = before.value[0]
  if (!first) return
  rules.value.conditions.push(isChoiceType(first.type)
    ? { source_question_id: first.id, operator: 'is', option_ids: [] }
    : { source_question_id: first.id, operator: 'gt', value: null })
}
function setSource(condition: SurveyCondition, value: string | number | null | undefined) {
  const q = props.questions.find(one => one.id === Number(value))
  if (!q) return
  condition.source_question_id = q.id
  condition.operator = isChoiceType(q.type) ? 'is' : 'gt'
  condition.option_ids = isChoiceType(q.type) ? [] : null
  condition.value = null
}
function toggleOption(condition: SurveyCondition, id: number) {
  const ids = condition.option_ids ?? []
  condition.option_ids = ids.includes(id) ? ids.filter(one => one !== id) : [...ids, id]
}
const numberModel = (row: { value?: number | null }) => ({
  get: () => (row.value == null ? '' : String(row.value)),
  set: (value: string | number | null | undefined) => {
    const typed = String(value ?? '').trim()
    row.value = typed === '' ? null : Number(typed.replace(',', '.'))
  },
})
const matchItems = computed(() => [{ value: 'all', label: t('surveys.rules.matchAll') }, { value: 'any', label: t('surveys.rules.matchAny') }])

// Checks: number questions only.
const numbers = computed(() => props.questions.filter(q => isNumberType(q.type) && q.id !== props.questionId))
const numberOptions = computed(() => numbers.value.map(q => ({ value: q.id, label: label(q) })))
function addCompare() {
  rules.value.checks.push({ type: 'compare', operator: 'lte', compare_question_id: numbers.value[0]?.id ?? null })
}
function addSum() {
  rules.value.checks.push({ type: 'sum', question_ids: props.questionId ? [props.questionId] : [], value: 100 })
}
function toggleSum(check: SurveyCheck, id: number) {
  const ids = check.question_ids ?? []
  check.question_ids = ids.includes(id) ? ids.filter(one => one !== id) : [...ids, id]
}
const selfNumber = computed(() => props.questions.find(q => q.id === props.questionId)?.number ?? t('surveys.rules.thisQuestion'))
const conditionError = (i: number) => props.errors[`conditions.${i}.source_question_id`] ?? props.errors[`conditions.${i}`]
</script>

<template>
  <fieldset class="flex flex-col gap-3 rounded-2xl border border-dl-line p-4">
    <legend class="px-1 text-[13px] font-semibold">{{ t('surveys.rules.showIf') }}</legend>
    <p v-if="!rules.conditions.length" class="text-[13px] text-dl-muted">{{ t('surveys.rules.always') }}</p>
    <DlSegmented v-if="rules.conditions.length > 1" v-model="rules.display_match" :label="t('surveys.rules.match')" :items="matchItems" class="self-start" />
    <div v-for="(condition, i) in rules.conditions" :key="i" class="flex flex-col gap-2 rounded-xl bg-dl-mist p-3">
      <div class="grid gap-2 sm:grid-cols-[1fr_170px_auto]">
        <DlSelect :model-value="condition.source_question_id" :label="t('surveys.rules.question')" hide-label :options="sourceOptions" @update:model-value="value => setSource(condition, value)" />
        <DlSelect v-model="condition.operator" :label="t('surveys.rules.operatorLabel')" hide-label :options="operatorOptions(condition)" />
        <DlIconButton icon="tabler-x" variant="ghost" :size="36" :label="t('common.actions.delete')" @click="rules.conditions.splice(i, 1)" />
      </div>
      <div v-if="source(condition) && isChoiceType(source(condition)!.type)" class="flex flex-wrap gap-2" role="group" :aria-label="t('surveys.rules.options')">
        <button
          v-for="option in source(condition)!.options"
          :key="option.id"
          type="button"
          class="rounded-[10px] border px-3 py-1.5 text-[13px]"
          :class="condition.option_ids?.includes(option.id) ? 'border-dl-ink bg-dl-ink text-dl-on-ink' : 'border-dl-line bg-dl-paper'"
          :aria-pressed="!!condition.option_ids?.includes(option.id)"
          @click="toggleOption(condition, option.id)"
        >
          {{ option.label }}
        </button>
      </div>
      <div v-else class="max-w-40"><DlInput :model-value="numberModel(condition).get()" type="number" :label="t('surveys.rules.value')" hide-label :placeholder="t('surveys.rules.value')" @update:model-value="numberModel(condition).set" /></div>
      <span v-if="conditionError(i)" class="text-xs text-dl-rejected">{{ conditionError(i) }}</span>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <DlButton size="sm" variant="outline" icon="tabler-plus" :disabled="!before.length" @click="addCondition">{{ t('surveys.rules.addCondition') }}</DlButton>
      <span class="text-xs text-dl-muted">{{ t(before.length ? 'surveys.rules.beforeHint' : 'surveys.rules.noneBefore') }}</span>
    </div>
    <span v-if="errors.conditions" class="text-xs text-dl-rejected">{{ errors.conditions }}</span>
  </fieldset>

  <fieldset v-if="isNumberType(type)" class="flex flex-col gap-3 rounded-2xl border border-dl-line p-4">
    <legend class="px-1 text-[13px] font-semibold">{{ t('surveys.rules.checks') }}</legend>
    <p v-if="!rules.checks.length" class="text-[13px] text-dl-muted">{{ t('surveys.rules.noCheck') }}</p>
    <div v-for="(check, i) in rules.checks" :key="i" class="flex flex-col gap-2 rounded-xl bg-dl-mist p-3">
      <div v-if="check.type === 'compare'" class="grid items-center gap-2 sm:grid-cols-[auto_170px_1fr_auto]">
        <strong class="text-[13px]">{{ selfNumber }}</strong>
        <DlSelect v-model="check.operator" :label="t('surveys.rules.operatorLabel')" hide-label :options="NUMBER_OPERATORS.map(op => ({ value: op, label: operator(op) }))" />
        <DlSelect v-model="check.compare_question_id" :label="t('surveys.rules.question')" hide-label :options="numberOptions" />
        <DlIconButton icon="tabler-x" variant="ghost" :size="36" :label="t('common.actions.delete')" @click="rules.checks.splice(i, 1)" />
      </div>
      <template v-else>
        <div class="flex items-center gap-2">
          <span class="text-[13px]">{{ t('surveys.rules.sumOf') }}</span>
          <DlIconButton icon="tabler-x" variant="ghost" :size="36" class="ms-auto" :label="t('common.actions.delete')" @click="rules.checks.splice(i, 1)" />
        </div>
        <div class="flex flex-wrap gap-2" role="group" :aria-label="t('surveys.rules.sumOf')">
          <span class="rounded-[10px] border border-dl-ink bg-dl-ink px-3 py-1.5 text-[13px] text-dl-on-ink">{{ selfNumber }}</span>
          <button
            v-for="q in numbers"
            :key="q.id"
            type="button"
            class="rounded-[10px] border px-3 py-1.5 text-[13px]"
            :class="check.question_ids?.includes(q.id) ? 'border-dl-ink bg-dl-ink text-dl-on-ink' : 'border-dl-line bg-dl-paper'"
            :aria-pressed="!!check.question_ids?.includes(q.id)"
            :title="q.question_text"
            @click="toggleSum(check, q.id)"
          >
            {{ q.number }}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[13px]">{{ t('surveys.rules.equals') }}</span>
          <div class="w-28"><DlInput :model-value="numberModel(check).get()" type="number" :label="t('surveys.rules.value')" hide-label @update:model-value="numberModel(check).set" /></div>
        </div>
      </template>
      <span v-if="errors[`checks.${i}`]" class="text-xs text-dl-rejected">{{ errors[`checks.${i}`] }}</span>
    </div>
    <div class="flex flex-wrap gap-2">
      <DlButton size="sm" variant="outline" icon="tabler-plus" :disabled="!numbers.length" @click="addCompare">{{ t('surveys.rules.addCompare') }}</DlButton>
      <DlButton size="sm" variant="outline" icon="tabler-plus" :disabled="!numbers.length" @click="addSum">{{ t('surveys.rules.addSum') }}</DlButton>
    </div>
    <p class="text-xs text-dl-muted">{{ t('surveys.rules.checksHint') }}</p>
  </fieldset>
</template>
