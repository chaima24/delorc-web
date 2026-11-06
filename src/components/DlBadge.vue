<script setup lang="ts">
import DlIcon from './DlIcon.vue'

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'signal' | 'ink'

/**
 * Status always reads as word + shape + color: pass an `icon` (or `dot`) with the text,
 * never rely on the color alone.
 */
withDefaults(defineProps<{
  tone?: Tone
  icon?: string
  dot?: boolean
  size?: 'sm' | 'md'
}>(), {
  tone: 'neutral',
  dot: false,
  size: 'md',
})

const tones: Record<Tone, string> = {
  neutral: 'bg-dl-line-soft text-dl-body',
  info: 'bg-dl-cobalt/10 text-dl-cobalt',
  success: 'bg-dl-signal-soft text-dl-fg',
  warning: 'bg-dl-pending/10 text-dl-pending',
  danger: 'bg-dl-rejected/10 text-dl-rejected',
  signal: 'bg-dl-signal text-[#0F1F1C]',
  ink: 'bg-dl-ink text-dl-on-ink',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold"
    :class="[tones[tone], size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs']"
  >
    <span v-if="dot" aria-hidden="true" class="h-2 w-2 rounded-full bg-current" />
    <DlIcon v-else-if="icon" :icon="icon" :size="size === 'sm' ? 12 : 14" />
    <slot />
  </span>
</template>
