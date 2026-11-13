<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import type { CycleDetail, CycleGoalKey } from '@/api/tenant/cycles'
import DlIcon from '@/components/DlIcon.vue'
import { roleLabel } from '@/views/tenant/settings/shared/lookups'
import { useCycleText } from './cycleDisplay'

// "Goal for the period": numbers a day × field days, why there are that many field days, where the
// numbers come from, and whether following the list is enough (docs/DECISIONS.md).
const props = defineProps<{ cycle: CycleDetail }>()
const { t, n } = useI18n()
const text = useCycleText()

const ORDER: CycleGoalKey[] = ['doctor', 'pharmacy', 'wholesaler', 'orders', 'coaching']
const goals = computed(() => ORDER.filter(key => props.cycle.goal[key]).map(key => ({ key, ...props.cycle.goal[key]! })))
/** "21 working days − 2 Training − 1 Leave" */
const why = computed(() => [
  t('cycles.goal.workingDays', props.cycle.working_days),
  ...props.cycle.off.map(row => `${text.days(row.days)} ${row.name}`),
].join(' − '))
const objectiveName = computed(() => props.cycle.objective
  ? `${roleLabel(props.cycle.objective.role)} · ${props.cycle.objective.team ?? t('objectives.allTeams')}`
  : null)
</script>

<template>
  <section class="rounded-2xl border border-dl-line px-3.5 py-3" :aria-label="t('cycles.goal.title')">
    <h3 class="mb-1.5 text-sm font-semibold">{{ t('cycles.goal.title') }}</h3>
    <dl class="grid grid-cols-[120px_1fr] gap-x-2.5 gap-y-1.5 text-[13px]">
      <dt class="text-dl-muted">{{ t('cycles.goal.fieldDays') }}</dt>
      <dd><b>{{ text.days(cycle.field_days) }}</b> <span class="text-xs text-dl-muted">· {{ why }}</span></dd>
      <template v-for="goal in goals" :key="goal.key">
        <dt class="text-dl-muted">{{ t(`cycles.goal.kinds.${goal.key}`) }}</dt>
        <dd>{{ n(goal.total) }} <span class="text-xs text-dl-muted">· {{ t('cycles.goal.perDay', { n: n(goal.per_day) }) }}</span></dd>
      </template>
      <dt class="text-dl-muted">{{ t('cycles.goal.from') }}</dt>
      <dd>
        <RouterLink v-if="objectiveName" :to="{ name: 'tenant-objectives' }" class="text-dl-cobalt no-underline hover:underline">{{ objectiveName }}</RouterLink>
        <span v-else class="text-dl-pending">{{ t('cycles.goal.noObjective') }}</span>
      </dd>
    </dl>
    <p class="mt-2.5 flex items-start gap-1.5 rounded-xl px-3 py-2 text-[12.5px]" :class="cycle.list_short ? 'bg-dl-pending/10 text-dl-pending' : 'bg-dl-mist text-dl-body'">
      <DlIcon :icon="cycle.list_short ? 'tabler-alert-triangle' : 'tabler-check'" :size="15" class="mt-px shrink-0" />
      <span>{{ cycle.list_short ? t('cycles.goal.listShort', { list: n(cycle.to_do), goal: n(cycle.goal_visits) }) : t('cycles.goal.listOk', { list: n(cycle.to_do), goal: n(cycle.goal_visits) }) }}</span>
    </p>
  </section>
</template>
