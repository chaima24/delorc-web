<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** 0–100 */
  value: number
  /** Optional goal marker, 0–100. */
  target?: number
  label: string
  size?: 'sm' | 'md'
  tone?: 'cobalt' | 'signal' | 'teal'
  onDark?: boolean
}>(), {
  size: 'sm',
  tone: 'cobalt',
  onDark: false,
})

const clamped = computed(() => Math.min(100, Math.max(0, props.value)))
const fills = { cobalt: 'bg-dl-cobalt', signal: 'bg-dl-signal', teal: 'bg-dl-teal' }
</script>

<template>
  <div
    role="progressbar"
    :aria-label="label"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="Math.round(clamped)"
    class="relative w-full rounded-full"
    :class="[size === 'sm' ? 'h-1.5' : 'h-2.5', onDark ? 'bg-dl-ink-2' : 'bg-dl-line-soft']"
  >
    <div
      class="h-full rounded-full transition-[width] duration-500"
      :class="fills[tone]"
      :style="{ width: `${clamped}%` }"
    />
    <span
      v-if="target != null"
      aria-hidden="true"
      class="absolute -top-1 h-[calc(100%+8px)] w-0.5"
      :class="onDark ? 'bg-dl-on-ink' : 'bg-dl-fg'"
      :style="{ insetInlineStart: `${target}%` }"
    />
  </div>
</template>
