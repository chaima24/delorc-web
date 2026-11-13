<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { labRuleTypesApi, type Lab, type LabRuleType } from '@/api/central/labs'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import { useAuthStore } from '@/stores/auth'
import LabRuleTypePanel from './LabRuleTypePanel.vue'

/** The building blocks of the lab's territories, in its own database (docs/api/rule-types.md). The lab only reads them. */
const props = defineProps<{ lab: Lab }>()

const { t, n } = useI18n()
const auth = useAuthStore()

const types = ref<LabRuleType[] | null>(null)
const error = ref<string | null>(null)
/** `new` adds a type; a type opens it to edit or delete it. */
const panel = ref<'new' | LabRuleType | null>(null)
const panelOpen = computed({ get: () => panel.value !== null, set: (open) => { if (!open) panel.value = null } })
const canChange = computed(() => auth.can('rule-types.update') || auth.can('rule-types.delete'))

const nameOf = (code: string | null) => types.value?.find((type) => type.code === code)?.name ?? code
/** "Top level" for a type with types inside it, "Inside Wilaya", or "On its own". */
function place(type: LabRuleType): string {
  if (type.parent_code) return t('central.labs.ruleTypes.inside', { name: nameOf(type.parent_code) })

  return types.value?.some((other) => other.parent_code === type.code) ? t('central.labs.ruleTypes.top') : t('central.labs.ruleTypes.alone')
}
function choices(type: LabRuleType): string {
  const parts = [n(type.choices_count)]
  if (type.sub_zones_count !== null) parts.push(t('central.labs.ruleTypes.subZonesCount', { n: n(type.sub_zones_count) }))
  if (type.supports_zone_type) parts.push(t('central.labs.ruleTypes.zoneType'))

  return parts.join(' · ')
}
const kinds = (type: LabRuleType) => (type.hcp_types?.length ? type.hcp_types.join(', ') : t('central.labs.ruleTypes.allKinds'))

async function load(): Promise<void> {
  try {
    types.value = await labRuleTypesApi.list(props.lab.id)
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
}
onMounted(load)

async function changed(): Promise<void> {
  panel.value = null
  await load()
}

const openType = (type: LabRuleType) => { if (canChange.value) panel.value = type }
</script>

<template>
  <div class="flex items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <DlAlert v-if="error">{{ error }}</DlAlert>
      <div v-if="types" class="overflow-x-auto rounded-3xl bg-dl-paper p-4">
        <div class="mb-2 flex items-center gap-2.5">
          <h2 class="flex-1 text-[15px] font-bold">{{ t('central.labs.ruleTypes.title', { name: lab.name }) }}</h2>
          <DlButton v-if="auth.can('rule-types.create')" variant="primary" size="sm" icon="tabler-plus" @click="panel = 'new'">{{ t('central.labs.ruleTypes.add') }}</DlButton>
        </div>
        <DlEmptyState v-if="!types.length" :title="t('central.labs.ruleTypes.empty')" icon="tabler-list-details" />
        <table v-else class="w-full border-collapse text-sm">
          <thead>
            <tr class="border-b border-dl-line text-left text-xs text-dl-muted">
              <th class="p-3 font-semibold">{{ t('central.labs.ruleTypes.name') }}</th>
              <th class="p-3 font-semibold">{{ t('central.labs.ruleTypes.code') }}</th>
              <th class="p-3 font-semibold">{{ t('central.labs.ruleTypes.place') }}</th>
              <th class="p-3 font-semibold">{{ t('central.labs.ruleTypes.choices') }}</th>
              <th class="hidden p-3 font-semibold lg:table-cell">{{ t('central.labs.ruleTypes.hcpLink') }}</th>
              <th class="hidden p-3 font-semibold xl:table-cell">{{ t('central.labs.ruleTypes.userLink') }}</th>
              <th class="p-3 font-semibold">{{ t('central.labs.ruleTypes.shown') }}</th>
              <th class="p-3 text-end font-semibold">{{ t('central.labs.ruleTypes.territories') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="type in types"
              :key="type.id"
              class="border-b border-dl-line-soft align-top"
              :class="[canChange && 'cursor-pointer hover:bg-dl-line-soft', panel !== 'new' && panel?.id === type.id && 'bg-dl-signal-soft']"
              :tabindex="canChange ? 0 : undefined"
              @click="openType(type)"
              @keydown.enter="openType(type)"
            >
              <td class="p-3 font-semibold text-dl-fg">{{ type.name }}</td>
              <td class="p-3 font-mono text-[12.5px] text-dl-body">{{ type.code }}</td>
              <td class="p-3 text-dl-muted">{{ place(type) }}</td>
              <td class="p-3 font-semibold tabular-nums">{{ choices(type) }}</td>
              <td class="hidden p-3 font-mono text-[12.5px] text-dl-body lg:table-cell">
                <template v-if="type.hcp_path">{{ type.hcp_path }} · {{ kinds(type) }}</template>
                <span v-else class="text-dl-muted">—</span>
              </td>
              <td class="hidden p-3 font-mono text-[12.5px] text-dl-body xl:table-cell">
                <template v-if="type.user_path">{{ type.user_path }}<template v-if="type.user_skip_empty"> · {{ t('central.labs.ruleTypes.skipsEmpty') }}</template></template>
                <span v-else class="text-dl-muted">—</span>
              </td>
              <td class="p-3"><DlBadge :tone="type.is_visible ? 'success' : 'neutral'" size="sm">{{ t(type.is_visible ? 'central.labs.ruleTypes.visible' : 'central.labs.ruleTypes.hidden') }}</DlBadge></td>
              <td class="p-3 text-end font-semibold tabular-nums">{{ type.territories_count ? n(type.territories_count) : '—' }}</td>
            </tr>
          </tbody>
        </table>
        <p class="pt-2.5 text-xs text-dl-muted">{{ t('central.labs.ruleTypes.rule') }}<template v-if="canChange"> {{ t('central.labs.ruleTypes.clickHint') }}</template></p>
      </div>
    </div>

    <LabRuleTypePanel
      v-if="panel && types"
      :key="panel === 'new' ? 'new' : panel.id"
      v-model:open="panelOpen"
      :lab="lab"
      :types="types"
      :rule-type="panel === 'new' ? undefined : panel"
      @changed="changed"
    />
  </div>
</template>
