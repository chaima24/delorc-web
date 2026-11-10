<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchRulePreview, type RuleKind, type RulePreview } from '@/api/tenant/rules'
import DlSegmented from '@/components/DlSegmented.vue'
import CheckList from '@/views/tenant/settings/shared/CheckList.vue'
import { whoPayload, type RuleWhoForm } from './useRulePage'

type Option = { value: number; label: string }

/**
 * Who follows a rule: roles and teams, or chosen people. Below, a live preview of how many
 * people get the rule and which of them leave another rule for it.
 */
const props = defineProps<{
  kind: RuleKind
  /** The rule being edited (its own people are not "moving"). */
  ruleId?: number
  roles: Option[]
  teams: Option[]
  users: Option[]
  errors: Record<string, string>
}>()

const form = defineModel<RuleWhoForm>({ required: true })
const { t } = useI18n()

const modeItems = computed(() => [
  { value: 'groups', label: t('rulesSetup.who.groups') },
  { value: 'people', label: t('rulesSetup.who.people') },
])
const mode = computed({
  get: () => form.value.mode as string,
  set: value => { form.value.mode = value as RuleWhoForm['mode'] },
})

const preview = ref<RulePreview | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => JSON.stringify(whoPayload(form.value)),
  () => {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      try {
        preview.value = await fetchRulePreview(props.kind, whoPayload(form.value), props.ruleId)
      }
      catch {
        preview.value = null
      }
    }, 300)
  },
  { immediate: true },
)
const moving = computed(() => preview.value?.moving.reduce((sum, rule) => sum + rule.people, 0) ?? 0)
const error = computed(() => props.errors.roles || props.errors.teams || props.errors.users)
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <DlSegmented v-model="mode" :label="t('rulesSetup.who.label')" :items="modeItems" block />

    <template v-if="form.mode === 'groups'">
      <CheckList
        v-model="form.roles"
        :legend="t('rulesSetup.who.roles')"
        :selected-label="form.roles.length ? t('geo.selected', { count: form.roles.length }) : t('fieldSetup.filter.allRoles')"
        :search-label="t('fieldSetup.search.roles')"
        :items="roles"
        :empty-text="t('geo.empty.search')"
      />
      <CheckList
        v-model="form.teams"
        :legend="t('rulesSetup.who.teams')"
        :selected-label="form.teams.length ? t('geo.selected', { count: form.teams.length }) : t('fieldSetup.filter.allTeams')"
        :search-label="t('rulesSetup.who.searchTeams')"
        :items="teams"
        :empty-text="t('geo.empty.search')"
      />
      <p class="-mt-1.5 text-xs text-dl-muted">{{ t('rulesSetup.who.groupsHint') }}</p>
    </template>
    <CheckList
      v-else
      v-model="form.users"
      :legend="t('rulesSetup.who.people')"
      :selected-label="t('geo.selected', { count: form.users.length })"
      :search-label="t('rulesSetup.who.searchPeople')"
      :items="users"
      :empty-text="t('geo.empty.search')"
    />
    <p v-if="error" class="-mt-1.5 text-xs text-dl-rejected">{{ error }}</p>

    <div
      v-if="preview"
      class="flex gap-2.5 rounded-2xl px-3.5 py-3 text-[13px]"
      :class="moving ? 'bg-dl-pending/10' : 'bg-dl-signal-soft'"
      aria-live="polite"
    >
      <span aria-hidden="true">{{ moving ? '⚠' : '✓' }}</span>
      <span>
        <strong>{{ t('rulesSetup.preview.people', preview.people) }}</strong>
        <span v-for="rule in preview.moving" :key="rule.id" class="block text-xs text-dl-muted">
          {{ t('rulesSetup.preview.moving', { count: rule.people, name: rule.name }, rule.people) }}
        </span>
        <span v-if="moving" class="block text-xs text-dl-muted">{{ t('rulesSetup.preview.oneRule') }}</span>
      </span>
    </div>
  </div>
</template>
