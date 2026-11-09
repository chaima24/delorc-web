<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { RouterLink } from 'vue-router'
import DlIcon from './DlIcon.vue'

type Variant = 'outline' | 'ghost' | 'dark' | 'on-ink'

withDefaults(defineProps<{
  icon: string
  /** Required: icon-only buttons need an accessible name. */
  label: string
  variant?: Variant
  to?: RouteLocationRaw
  size?: number
}>(), {
  variant: 'outline',
  size: 44,
})

const variants: Record<Variant, string> = {
  'outline': 'border border-dl-line bg-dl-paper text-dl-fg hover:bg-dl-line-soft',
  'ghost': 'text-dl-fg hover:bg-dl-line-soft',
  'dark': 'bg-dl-ink text-dl-on-ink hover:bg-dl-ink-2',
  'on-ink': 'bg-dl-ink-2 text-dl-on-ink hover:brightness-110',
}
</script>

<template>
  <component
    :is="to ? RouterLink : 'button'"
    :to="to"
    :type="to ? undefined : 'button'"
    :aria-label="label"
    :title="label"
    class="inline-flex shrink-0 items-center justify-center rounded-xl transition disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt focus-visible:ring-offset-2 focus-visible:ring-offset-dl-mist"
    :class="variants[variant]"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <DlIcon :icon="icon" :size="Math.round(size * 0.42)" />
  </component>
</template>
