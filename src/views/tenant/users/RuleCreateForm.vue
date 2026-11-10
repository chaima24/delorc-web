<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fieldErrors } from '@/api/errors'
import { planningRulesApi, validationRulesApi, type PlanningRule, type ValidationRule } from '@/api/tenant/rules'
import DlButton from '@/components/DlButton.vue'
import DlInput from '@/components/DlInput.vue'
import { useToast } from '@/composables/useToast'
import { reloadRules } from './useUserLookups'

// A new planning or validation rule, created in place (given to nobody else). Not a <form>: it can
// sit inside another form. Enter creates the rule.
const props = defineProps<{ kind: 'planning' | 'validation' }>()
const emit = defineEmits<{ created: [rule: PlanningRule | ValidationRule]; cancel: [] }>()
const { t, n } = useI18n()
const toast = useToast()

const saving = ref(false)
const errors = ref<Record<string, string>>({})
const draft = reactive({ name: '', description: '', open: 10, close: 2, hours: 48 })
const daysBefore = (days: number) => t('users.rules.daysBefore', { count: n(days) }, days)

async function create() {
  errors.value = {}
  if (!draft.name.trim()) {
    errors.value = { name: t('users.add.required') }
    return
  }
  if (props.kind === 'planning' && Number(draft.close) > Number(draft.open)) {
    errors.value = { days_before_start_close: t('users.rules.closeAfterOpen') }
    return
  }
  saving.value = true
  try {
    const common = { name: draft.name.trim(), description: draft.description.trim() || null }
    const rule: PlanningRule | ValidationRule = props.kind === 'planning'
      ? await planningRulesApi.create({ ...common, days_before_start_open: Number(draft.open), days_before_start_close: Number(draft.close) })
      : await validationRulesApi.create({ ...common, duration_hours: Number(draft.hours) })
    await reloadRules()
    toast.success(t('users.rules.created', { name: rule.name }))
    emit('created', rule)
  }
  catch (error) {
    errors.value = fieldErrors(error)
    if (!Object.keys(errors.value).length) toast.error(t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-xl border-2 border-dl-fg px-3 py-3"
    role="group"
    :aria-label="t('users.rules.new')"
    @keydown.enter.prevent="create"
  >
    <strong class="text-[13px]">{{ t(kind === 'planning' ? 'users.rules.newPlanning' : 'users.rules.newValidation') }}</strong>
    <DlInput v-model="draft.name" :label="t('geo.fields.name')" :error="errors.name" />
    <template v-if="kind === 'planning'">
      <DlInput v-model="draft.open" type="number" min="0" :label="t('users.rules.openDays')" :hint="daysBefore(Number(draft.open) || 0)" :error="errors.days_before_start_open" />
      <DlInput v-model="draft.close" type="number" min="0" :label="t('users.rules.closeDays')" :hint="daysBefore(Number(draft.close) || 0)" :error="errors.days_before_start_close" />
    </template>
    <DlInput v-else v-model="draft.hours" type="number" min="0" :label="t('users.rules.hoursLabel')" :error="errors.duration_hours" />
    <DlInput v-model="draft.description" :label="t('users.rules.descriptionOptional')" :error="errors.description" />
    <p class="text-xs text-dl-muted">{{ t('users.rules.newHint') }}</p>
    <div class="flex justify-end gap-2">
      <DlButton variant="outline" size="sm" @click="emit('cancel')">{{ t('common.actions.cancel') }}</DlButton>
      <DlButton variant="dark" size="sm" :loading="saving" @click="create">{{ t('users.rules.createAndSelect') }}</DlButton>
    </div>
  </div>
</template>
