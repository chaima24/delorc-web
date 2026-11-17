<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

// Done / planned as a bar and « 9 / 12 · 75 % »; above 100 % the bar turns blue (more than asked is allowed).
const props = defineProps<{ done: number; planned: number }>()
const { n } = useI18n()
const rate = computed(() => (props.planned ? Math.round((props.done / props.planned) * 100) : 0))
</script>

<template>
  <span class="flex items-center gap-2">
    <span class="flex h-2 w-24 shrink-0 overflow-hidden rounded-full bg-dl-line-soft">
      <span class="h-full" :class="rate > 100 ? 'bg-dl-cobalt' : 'bg-dl-teal'" :style="{ width: `${Math.min(rate, 100)}%` }" />
    </span>
    <span class="whitespace-nowrap text-xs text-dl-muted">{{ n(done) }} / {{ n(planned) }} · <strong class="text-dl-fg">{{ rate }} %</strong></span>
  </span>
</template>
