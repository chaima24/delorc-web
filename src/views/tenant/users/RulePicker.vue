<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PlanningRule, ValidationRule } from '@/api/tenant/rules'
import DlCombobox from '@/components/DlCombobox.vue'
import { useAuthStore } from '@/stores/auth'
import RuleCreateForm from './RuleCreateForm.vue'
import RuleTimeline from './RuleTimeline.vue'
import { reloadRules, useRuleLookups } from './useUserLookups'
import { onMountedAndFocus } from '@/composables/refreshOnFocus'

// Choose a planning or validation rule by name, seeing what each one does: its values under its
// name in the list, and the chosen one drawn on its timeline. No rule fits? "New rule" creates one in
// place (given to nobody else) and selects it.
const props = defineProps<{ kind: 'planning' | 'validation'; label: string; hideLabel?: boolean; error?: string; placeholder?: string }>()
const model = defineModel<number | null>()
const { t, n } = useI18n()
const auth = useAuthStore()
const lookups = useRuleLookups()
// Rules added a moment ago in Studio show up without reloading the page.
onMountedAndFocus(() => reloadRules())

type Rule = PlanningRule | ValidationRule
const rules = computed<Rule[]>(() => (props.kind === 'planning' ? lookups.planningRules.value : lookups.validationRules.value))
const daysBefore = (days: number) => t('users.rules.daysBefore', { count: n(days) }, days)
function details(rule: Rule) {
  return 'duration_hours' in rule
    ? t('users.rules.validationLine', { hours: n(rule.duration_hours ?? 0) })
    : t('users.rules.planningHint', { open: daysBefore(rule.days_before_start_open ?? 0), close: daysBefore(rule.days_before_start_close ?? 0) })
}
const options = computed(() => rules.value.map(rule => ({
  value: rule.id,
  label: rule.is_active === false ? `${rule.name} (${t('users.rules.inactive')})` : rule.name,
  hint: details(rule),
})))
const chosen = computed(() => rules.value.find(rule => rule.id === model.value) ?? null)

// —— New rule, in place ——
const canCreate = computed(() => auth.can(`${props.kind}-rules.create`))
const creating = ref(false)
function onCreated(rule: Rule) {
  model.value = rule.id
  creating.value = false
}
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <DlCombobox v-model="model" :label="label" :hide-label="hideLabel" :options="options" :placeholder="placeholder" :error="error" />

    <button
      v-if="canCreate && !creating"
      type="button"
      class="self-end text-xs font-semibold text-dl-cobalt hover:underline"
      @click="creating = true"
    >
      ＋ {{ t('users.rules.new') }}
    </button>

    <RuleCreateForm v-if="creating" :kind="kind" @created="onCreated" @cancel="creating = false" />

    <!-- The chosen rule, drawn as it will apply -->
    <div v-else-if="chosen" class="mt-1 flex flex-col gap-2 rounded-xl bg-dl-mist px-3 pt-2.5 pb-3">
      <div class="flex flex-col">
        <strong class="text-[13px]">{{ chosen.name }}</strong>
        <span v-if="chosen.description" class="text-xs text-dl-muted">{{ chosen.description }}</span>
      </div>
      <RuleTimeline
        :kind="kind"
        :open="'days_before_start_open' in chosen ? chosen.days_before_start_open : undefined"
        :close="'days_before_start_close' in chosen ? chosen.days_before_start_close : undefined"
        :hours="'duration_hours' in chosen ? chosen.duration_hours : undefined"
        :users-count="chosen.users_count ?? 0"
        on-tint
      />
    </div>
  </div>
</template>
