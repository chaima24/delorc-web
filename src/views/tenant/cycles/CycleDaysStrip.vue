<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { CycleDay } from '@/api/tenant/cycles'
import { DAY_CLASS, useCycleText } from './cycleDisplay'

// One mark per working day: activity, half, past, not yet (the visit marks come with visits).
// Worked out live by the API. Mockup: docs/design/plan-mockups/Cycles.html
defineProps<{ days: CycleDay[]; small?: boolean; legend?: boolean }>()
const emit = defineEmits<{ pick: [day: CycleDay] }>()
const { t } = useI18n()
const text = useCycleText()

const LEGEND = ['activity', 'half', 'past'] as const
</script>

<template>
  <div class="flex flex-col gap-3">
    <ul class="flex flex-wrap gap-1" :aria-label="t('cycles.days.title')">
      <li v-for="day in days" :key="day.date">
        <button
          type="button"
          class="flex flex-col items-center justify-center gap-px rounded-[9px] border text-[11px] text-dl-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
          :class="[DAY_CLASS[day.kind], small ? 'h-8 w-[26px]' : 'h-[38px] w-[30px]', day.today && '!border-2 !border-solid !border-dl-fg !opacity-100']"
          :title="`${text.dayLong(day.date)} · ${t(`cycles.days.kind.${day.kind}`)}`"
          @click="emit('pick', day)"
        >
          <span v-if="!small">{{ text.weekday(day.date) }}</span>
          <b class="text-[13px] text-dl-fg">{{ Number(day.date.slice(8, 10)) }}</b>
        </button>
      </li>
    </ul>
    <ul v-if="legend" class="flex flex-wrap gap-3.5 text-xs text-dl-muted">
      <li v-for="kind in LEGEND" :key="kind" class="flex items-center gap-1.5">
        <i class="inline-block h-3 w-3 rounded border" :class="DAY_CLASS[kind]" />{{ t(`cycles.days.legend.${kind}`) }}
      </li>
      <li class="flex items-center gap-1.5"><i class="inline-block h-3 w-3 rounded border-2 border-dl-fg" />{{ t('cycles.days.legend.today') }}</li>
      <li>{{ t('cycles.laterVisits') }}</li>
    </ul>
  </div>
</template>
