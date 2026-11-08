<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@/api/errors'
import { labFeaturesApi, type FeatureChange, type Lab, type LabFeatures } from '@/api/central/labs'
import DlAlert from '@/components/DlAlert.vue'
import DlBadge from '@/components/DlBadge.vue'
import DlButton from '@/components/DlButton.vue'
import DlEmptyState from '@/components/DlEmptyState.vue'
import DlSortHeader from '@/components/DlSortHeader.vue'
import { sortRows } from '@/composables/sortRows'
import { useAuthStore } from '@/stores/auth'
import { usePlanTexts } from '../plans/usePlanTexts'
import FeatureChangePanel from './FeatureChangePanel.vue'
import { useFeatureValue } from './useFeatureValue'
import { useLabTexts } from './useLabTexts'

/** What the lab gets: its plan's values, changed for this lab between two dates. */
const props = defineProps<{ lab: Lab }>()

const { t, d } = useI18n()
const auth = useAuthStore()
const { featureName } = usePlanTexts()
const { shown } = useFeatureValue()
const { day } = useLabTexts()

const tab = ref<LabFeatures | null>(null)
const error = ref<string | null>(null)
const sort = ref('-starts_on')
/** `new` adds a change; a change opens it to edit or remove it. */
const panel = ref<'new' | FeatureChange | null>(null)
const panelOpen = computed({ get: () => panel.value !== null, set: (open) => { if (!open) panel.value = null } })
const canChange = computed(() => auth.can('labs.update-plan'))
const STATE_TONES = { planned: 'info', now: 'success', past: 'neutral' } as const

const groups = computed(() => (['limit', 'switch'] as const).map((type) => ({ type, rows: tab.value?.features.filter((f) => f.type === type) ?? [] })))
const typeOf = (key: string) => tab.value?.features.find((f) => f.key === key)?.type ?? 'limit'
const changes = computed(() => sortRows(tab.value?.changes ?? [], sort.value, {
  feature: (change) => featureName(change.feature),
  value: (change) => shown(typeOf(change.feature), change.value),
  starts_on: (change) => change.starts_on,
  ends_on: (change) => change.ends_on ?? '9999',
  note: (change) => change.note ?? '',
  state: (change) => change.state,
  created_by: (change) => change.created_by?.name ?? '',
}))
const dates = (from: string, to: string | null) => `${day(from)} → ${to ? day(to) : t('central.labs.features.noEnd')}`

onMounted(async () => {
  try {
    tab.value = await labFeaturesApi.get(props.lab.id)
  } catch (failure) {
    error.value = errorMessage(failure) ?? t('errors.network')
  }
})

function changed(updated: LabFeatures): void {
  tab.value = updated
  panel.value = null
}

const openChange = (change: FeatureChange) => { if (canChange.value && change.state !== 'past') panel.value = change }
</script>

<template>
  <div class="flex items-start gap-5">
    <div class="flex min-w-0 flex-1 flex-col gap-4">
      <DlAlert v-if="error">{{ error }}</DlAlert>
      <template v-if="tab">
        <div class="overflow-x-auto rounded-3xl bg-dl-paper p-4">
          <div class="mb-2 flex items-center gap-2.5">
            <h2 class="flex-1 text-[15px] font-bold">{{ t('central.labs.features.today', { name: lab.name }) }}</h2>
            <DlButton v-if="canChange" variant="primary" size="sm" icon="tabler-plus" @click="panel = 'new'">{{ t('central.labs.features.add') }}</DlButton>
          </div>
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="border-b border-dl-line text-left text-xs text-dl-muted">
                <th class="p-3 font-semibold">{{ t('central.labs.features.feature') }}</th>
                <th class="p-3 font-semibold">{{ tab.plan ? t('central.labs.features.planValue', { plan: tab.plan.name }) : t('central.labs.features.noPlan') }}</th>
                <th class="p-3 font-semibold">{{ t('central.labs.features.changeToday') }}</th>
                <th class="p-3 font-semibold">{{ t('central.labs.features.gets') }}</th>
              </tr>
            </thead>
            <tbody v-for="group in groups" :key="group.type">
              <tr><td colspan="4" class="px-3 pb-1.5 pt-3.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-dl-muted">{{ t(`central.labs.features.group.${group.type}`) }}</td></tr>
              <tr v-for="feature in group.rows" :key="feature.key" class="border-b border-dl-line-soft">
                <td class="p-3 font-semibold text-dl-fg">{{ featureName(feature.key) }}</td>
                <td class="p-3 tabular-nums text-dl-muted">{{ shown(feature.type, feature.plan_value) }}</td>
                <td class="p-3" :class="feature.change && 'bg-dl-signal-soft'">
                  <template v-if="feature.change"><strong>{{ shown(feature.type, feature.change.value) }}</strong> · {{ dates(feature.change.starts_on, feature.change.ends_on) }}</template>
                  <span v-else class="text-dl-muted">—</span>
                </td>
                <td class="p-3 font-bold tabular-nums text-dl-fg">{{ shown(feature.type, feature.value) }}</td>
              </tr>
            </tbody>
          </table>
          <p class="pt-2.5 text-xs text-dl-muted">{{ t('central.labs.features.rule') }}</p>
        </div>

        <div class="overflow-x-auto rounded-3xl bg-dl-paper p-4">
          <h2 class="mb-2 text-[15px] font-bold">{{ t('central.labs.features.changes') }}</h2>
          <DlEmptyState v-if="!tab.changes.length" :title="t('central.labs.features.noChange')" icon="tabler-adjustments" />
          <table v-else class="w-full border-collapse text-sm">
            <thead>
              <tr class="border-b border-dl-line text-xs text-dl-muted">
                <DlSortHeader v-model="sort" column="feature" :label="t('central.labs.features.feature')" />
                <DlSortHeader v-model="sort" column="value" :label="t('central.labs.features.value')" />
                <DlSortHeader v-model="sort" column="starts_on" :label="t('central.labs.features.from')" />
                <DlSortHeader v-model="sort" column="ends_on" :label="t('central.labs.features.to')" />
                <DlSortHeader v-model="sort" column="note" :label="t('central.labs.note')" class="hidden md:table-cell" />
                <DlSortHeader v-model="sort" column="state" :label="t('central.labs.features.when')" />
                <DlSortHeader v-model="sort" column="created_by" :label="t('central.labs.addedBy')" class="hidden lg:table-cell" />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="change in changes"
                :key="change.id"
                class="border-b border-dl-line-soft"
                :class="[canChange && change.state !== 'past' && 'cursor-pointer hover:bg-dl-line-soft', panel !== 'new' && panel?.id === change.id && 'bg-dl-signal-soft']"
                :tabindex="canChange && change.state !== 'past' ? 0 : undefined"
                @click="openChange(change)"
                @keydown.enter="openChange(change)"
              >
                <td class="p-3 font-semibold">{{ featureName(change.feature) }}</td>
                <td class="p-3 tabular-nums">{{ shown(typeOf(change.feature), change.value) }}</td>
                <td class="p-3 tabular-nums">{{ day(change.starts_on) }}</td>
                <td class="p-3 tabular-nums">{{ change.ends_on ? day(change.ends_on) : t('central.labs.features.noEnd') }}</td>
                <td class="hidden p-3 text-[13px] md:table-cell">{{ change.note ?? '—' }}</td>
                <td class="p-3"><DlBadge :tone="STATE_TONES[change.state]" size="sm">{{ t(`central.labs.features.state.${change.state}`) }}</DlBadge></td>
                <td class="hidden p-3 text-[13px] text-dl-muted lg:table-cell" :title="d(new Date(change.created_at))">{{ change.created_by?.name ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
          <p v-if="canChange && tab.changes.length" class="pt-2.5 text-xs text-dl-muted">{{ t('central.labs.features.clickHint') }}</p>
        </div>
      </template>
    </div>

    <FeatureChangePanel v-if="panel && tab" :key="panel === 'new' ? 'new' : panel.id" v-model:open="panelOpen" :lab-id="lab.id" :tab="tab" :change="panel === 'new' ? undefined : panel" @changed="changed" />
  </div>
</template>
