<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { RouterLink } from 'vue-router'
import DlIcon from './DlIcon.vue'

type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  variant?: Variant
  size?: Size
  /** Renders a RouterLink. */
  to?: RouteLocationRaw
  /** Renders an anchor. */
  href?: string
  type?: 'button' | 'submit' | 'reset'
  icon?: string
  iconEnd?: string
  loading?: boolean
  disabled?: boolean
  block?: boolean
}>(), {
  variant: 'dark',
  size: 'md',
  type: 'button',
  loading: false,
  disabled: false,
  block: false,
})

const variants: Record<Variant, string> = {
  primary: 'bg-dl-signal text-dl-ink hover:brightness-95',
  dark: 'bg-dl-ink text-dl-on-ink hover:bg-dl-ink-2 dark:bg-dl-fg dark:text-dl-mist dark:hover:opacity-90',
  outline: 'border border-dl-line bg-dl-paper text-dl-fg hover:bg-dl-line-soft',
  ghost: 'text-dl-fg hover:bg-dl-line-soft',
  danger: 'bg-dl-rejected text-white hover:brightness-95',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] rounded-[10px]',
  md: 'h-11 px-4 text-sm rounded-xl',
  lg: 'h-[52px] px-5 text-[15px] rounded-[14px]',
}

const tag = computed(() => (props.to ? RouterLink : props.href ? 'a' : 'button'))
const isDisabled = computed(() => props.disabled || props.loading)
const iconSize = computed(() => (props.size === 'sm' ? 16 : 18))
</script>

<template>
  <component
    :is="tag"
    :to="to"
    :href="href"
    :type="tag === 'button' ? type : undefined"
    :disabled="tag === 'button' ? isDisabled : undefined"
    :aria-disabled="isDisabled || undefined"
    :aria-busy="loading || undefined"
    class="inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold no-underline transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt focus-visible:ring-offset-2 focus-visible:ring-offset-dl-mist"
    :class="[
      variants[variant],
      sizes[size],
      block && 'w-full',
      isDisabled && 'pointer-events-none opacity-50',
    ]"
  >
    <svg
      v-if="loading"
      class="animate-spin"
      :width="iconSize"
      :height="iconSize"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </svg>
    <DlIcon v-else-if="icon" :icon="icon" :size="iconSize" />
    <slot />
    <DlIcon v-if="iconEnd" :icon="iconEnd" :size="iconSize" class="rtl:-scale-x-100" />
  </component>
</template>
