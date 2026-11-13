<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { updateUserPlanningRule, updateUserValidationRule, type TenantUser } from '@/api/tenant/users'
import DlButton from '@/components/DlButton.vue'
import DlIcon from '@/components/DlIcon.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import RulePicker from '../RulePicker.vue'
import RuleTimeline from '../RuleTimeline.vue'
import { reloadRules, useRuleLookups } from '../useUserLookups'

// The person's planning and validation rule as timeline cards: the rule drawn on a small axis,
// then the key numbers. "Change" turns the card into the rule picker.
// Mockup: docs/design/studio-mockups/UserRules.html (A)
const props = defineProps<{ user: TenantUser }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()
const lookups = useRuleLookups()

type Kind = 'planning' | 'validation'
const editing = ref<Kind | null>(null)
const choice = ref<number | null>(null)
const saving = ref(false)
watch(editing, kind => {
  choice.value = kind === 'planning' ? props.user.planning_rule_id ?? null : kind === 'validation' ? props.user.validation_rule_id ?? null : null
})

async function save() {
  if (!choice.value || !editing.value) return
  saving.value = true
  try {
    await (editing.value === 'planning' ? updateUserPlanningRule : updateUserValidationRule)(props.user.id, choice.value)
    toast.success(t('studio.list.toast.saved'))
    editing.value = null
    reloadRules()
    emit('changed')
  }
  catch {
    toast.error(t('studio.list.toast.failed'))
  }
  finally {
    saving.value = false
  }
}

// The full rules (with how many people use them) from the shared list; the user's own copy as a fallback.
interface CardRule { name: string; description?: string | null; open?: number; close?: number; hours?: number; usersCount: number | null }
const planningRule = computed<CardRule | null>(() => {
  const rule = lookups.planningRules.value.find(item => item.id === props.user.planning_rule_id)
  const own = props.user.planning_rule
  if (!rule && !own) return null
  return {
    name: rule?.name ?? own!.name,
    description: rule?.description,
    open: rule?.days_before_start_open ?? own?.days_before_start_open,
    close: rule?.days_before_start_close ?? own?.days_before_start_close,
    usersCount: rule?.users_count ?? null,
  }
})
const validationRule = computed<CardRule | null>(() => {
  const rule = lookups.validationRules.value.find(item => item.id === props.user.validation_rule_id)
  const own = props.user.validation_rule
  if (!rule && !own) return null
  return { name: rule?.name ?? own!.name, description: rule?.description, hours: rule?.duration_hours ?? own?.duration_hours, usersCount: rule?.users_count ?? null }
})

const cards = computed(() => [
  { kind: 'planning' as Kind, title: t('users.rules.planning'), icon: 'tabler-calendar-cog', rule: planningRule.value, can: auth.can('users.update') },
  { kind: 'validation' as Kind, title: t('users.rules.validation'), icon: 'tabler-clock-check', rule: validationRule.value, can: auth.can('users.update') },
])
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid items-start gap-4 lg:grid-cols-2">
      <section
        v-for="card in cards"
        :key="card.kind"
        class="flex flex-col gap-3 rounded-2xl border bg-dl-paper px-4 py-4"
        :class="editing === card.kind ? 'border-2 border-dl-fg' : 'border-dl-line'"
        :aria-label="card.title"
      >
        <header class="flex items-center gap-2.5">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-dl-line-soft text-dl-body">
            <DlIcon :icon="card.icon" :size="17" />
          </span>
          <h3 class="flex-1 text-[15px] font-semibold">{{ card.title }}</h3>
          <DlButton v-if="card.can && editing !== card.kind" variant="outline" size="sm" icon="tabler-arrows-exchange" @click="editing = card.kind">
            {{ card.rule ? t('users.rules.change') : t('users.rules.choose') }}
          </DlButton>
        </header>

        <!-- Change -->
        <form v-if="editing === card.kind" class="flex flex-col gap-3 pt-2" @submit.prevent="save">
          <RulePicker v-model="choice" :kind="card.kind" :label="card.title" hide-label />
          <div class="flex justify-end gap-2">
            <DlButton variant="outline" size="sm" @click="editing = null">{{ t('common.actions.cancel') }}</DlButton>
            <DlButton type="submit" variant="dark" size="sm" :loading="saving" :disabled="!choice">{{ t('common.actions.save') }}</DlButton>
          </div>
        </form>

        <!-- Reading -->
        <template v-else-if="card.rule">
          <div class="flex flex-col gap-0.5">
            <strong class="font-display text-lg font-extrabold leading-tight">{{ card.rule.name }}</strong>
            <span v-if="card.rule.description" class="text-[13px] text-dl-muted">{{ card.rule.description }}</span>
          </div>
          <RuleTimeline
            :kind="card.kind"
            :open="card.rule.open"
            :close="card.rule.close"
            :hours="card.rule.hours"
            :users-count="card.rule.usersCount"
          />
        </template>
        <p v-else class="rounded-xl bg-dl-mist px-3 py-3 text-[13px] text-dl-muted">{{ t('users.rules.noneYet') }}</p>
      </section>
    </div>

    <p class="text-xs text-dl-muted">
      {{ t('users.rules.hint') }}
      <RouterLink :to="{ name: 'tenant-planning-rules' }" class="font-semibold text-dl-cobalt">{{ t('users.rules.open') }}</RouterLink>
    </p>
  </div>
</template>
