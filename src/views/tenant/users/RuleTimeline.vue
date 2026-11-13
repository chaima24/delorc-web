<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

// A rule drawn on a small axis. Planning: the window before the cycle starts (opens D−x,
// closes D−y). Validation: from the visit to its deadline. Then the key numbers as facts.
const props = defineProps<{
  kind: 'planning' | 'validation'
  open?: number
  close?: number
  hours?: number
  usersCount?: number | null
  /** On a grey background: white fact tiles. */
  onTint?: boolean
}>()
const { t, n } = useI18n()

/** Position on the axis, in % from the start side (RTL mirrors with logical properties). */
const at = (value: number) => `${Math.min(96, Math.max(4, value)).toFixed(1)}%`

// The window is drawn to scale between opening and closing; the start of the cycle sits at the end.
const planning = computed(() => {
  const open = props.open ?? 0
  const close = Math.min(props.close ?? 0, open)
  const closeAt = open > 0 ? 4 + (72 * (open - close)) / open : 4
  return { open: 4, close: closeAt, start: 96, width: Math.max(closeAt - 4, 1.5), planDays: open - close }
})

const validation = computed(() => {
  const hours = props.hours ?? 0
  const range = Math.max(hours * 1.5, 1)
  const pos = (h: number) => 4 + (h / range) * 92
  return { deadline: pos(hours), half: pos(hours / 2), width: Math.max(pos(hours) - pos(0), 1.5), hours }
})
const hoursLabel = (h: number) => t('users.rules.axis.hours', { count: n(Math.round(h)) })
const validateFact = computed(() => {
  const h = validation.value.hours
  return h >= 24 && h % 24 === 0
    ? t('users.rules.facts.days', { count: n(h / 24) }, h / 24)
    : t('users.rules.facts.hours', { count: n(h) }, h)
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Axis -->
    <div class="relative mx-1 h-16" aria-hidden="true">
      <span class="absolute inset-x-0 top-[26px] h-1.5 rounded-full bg-dl-line-soft" />
      <template v-if="kind === 'planning'">
        <span class="absolute top-[22px] h-3.5 rounded-full bg-dl-cobalt" :style="{ insetInlineStart: at(planning.open), width: `${planning.width}%` }" />
        <span class="absolute top-[18px] h-[22px] w-[3px] -translate-x-1/2 rounded-sm bg-dl-fg rtl:translate-x-1/2" :style="{ insetInlineStart: at(planning.start) }" />
        <span class="absolute end-0 top-0 text-[11.5px] font-bold whitespace-nowrap">{{ t('users.rules.axis.cycleStarts') }}</span>
        <span class="absolute start-[4%] top-10 text-[11.5px] whitespace-nowrap">
          <strong>{{ t('users.rules.axis.opens') }}</strong> <span class="text-dl-muted">{{ t('users.rules.axis.day', { n: n(open ?? 0) }) }}</span>
        </span>
        <span
          v-if="(close ?? 0) !== (open ?? 0)"
          class="absolute top-10 -translate-x-1/2 text-[11.5px] whitespace-nowrap rtl:translate-x-1/2"
          :style="{ insetInlineStart: at(Math.max(planning.close, 30)) }"
        >
          <strong>{{ t('users.rules.axis.closes') }}</strong> <span class="text-dl-muted">{{ t('users.rules.axis.day', { n: n(close ?? 0) }) }}</span>
        </span>
      </template>
      <template v-else>
        <span class="absolute top-[22px] h-3.5 rounded-full bg-dl-teal" :style="{ insetInlineStart: at(4), width: `${validation.width}%` }" />
        <span class="absolute top-[18px] h-[22px] w-[3px] -translate-x-1/2 rounded-sm bg-dl-fg rtl:translate-x-1/2" :style="{ insetInlineStart: at(4) }" />
        <span class="absolute top-0 -translate-x-1/2 text-[11.5px] font-bold whitespace-nowrap rtl:translate-x-1/2" :style="{ insetInlineStart: at(4) }">{{ t('users.rules.axis.visit') }}</span>
        <span class="absolute top-0 -translate-x-1/2 text-[11.5px] font-bold whitespace-nowrap rtl:translate-x-1/2" :style="{ insetInlineStart: at(validation.deadline) }">{{ t('users.rules.axis.deadline') }}</span>
        <span class="absolute top-10 -translate-x-1/2 text-[11.5px] text-dl-muted whitespace-nowrap rtl:translate-x-1/2" :style="{ insetInlineStart: at(4) }">{{ hoursLabel(0) }}</span>
        <span v-if="validation.hours >= 4" class="absolute top-10 -translate-x-1/2 text-[11.5px] text-dl-muted whitespace-nowrap rtl:translate-x-1/2" :style="{ insetInlineStart: at(validation.half) }">{{ hoursLabel(validation.hours / 2) }}</span>
        <span class="absolute top-10 -translate-x-1/2 text-[11.5px] text-dl-muted whitespace-nowrap rtl:translate-x-1/2" :style="{ insetInlineStart: at(validation.deadline) }">{{ hoursLabel(validation.hours) }}</span>
      </template>
    </div>

    <!-- Facts -->
    <dl class="flex flex-wrap gap-2">
      <div class="flex flex-col rounded-xl px-3 py-2" :class="onTint ? 'bg-dl-paper' : 'bg-dl-mist'">
        <dt class="order-2 text-xs text-dl-muted">{{ t(kind === 'planning' ? 'users.rules.facts.toPlan' : 'users.rules.facts.toValidate') }}</dt>
        <dd class="font-display text-lg font-extrabold">
          {{ kind === 'planning' ? t('users.rules.facts.days', { count: n(planning.planDays) }, planning.planDays) : validateFact }}
        </dd>
      </div>
      <div v-if="usersCount != null" class="flex flex-col rounded-xl px-3 py-2" :class="onTint ? 'bg-dl-paper' : 'bg-dl-mist'">
        <dt class="order-2 text-xs text-dl-muted">{{ t('users.rules.facts.useIt', usersCount) }}</dt>
        <dd class="font-display text-lg font-extrabold">{{ n(usersCount) }}</dd>
      </div>
    </dl>
  </div>
</template>
