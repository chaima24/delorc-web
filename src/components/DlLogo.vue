<script setup lang="ts">
/** Delorc mark: a "D" drawn as a round — the rep leaves from the dot and comes back. */
withDefaults(defineProps<{
  size?: number
  wordmark?: boolean
  /** Use on dark (ink) backgrounds: raised tile + light wordmark. */
  onDark?: boolean
}>(), {
  size: 40,
  wordmark: false,
  onDark: false,
})
</script>

<template>
  <span class="inline-flex items-center gap-2.5">
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 48 48"
      role="img"
      aria-label="Delorc"
    >
      <rect width="48" height="48" rx="14" :class="onDark ? 'fill-dl-ink-2' : 'fill-dl-ink'" />
      <path
        d="M15 28 V13 H23 A11 11 0 0 1 23 35 H21"
        fill="none"
        class="stroke-dl-signal"
        stroke-width="4.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle cx="15" cy="35" r="3.2" class="fill-dl-signal" />
    </svg>
    <span
      v-if="wordmark"
      class="font-display text-[22px] font-extrabold leading-none tracking-[-0.04em]"
      :class="onDark ? 'text-dl-on-ink' : 'text-dl-fg'"
    >delorc</span>
  </span>
</template>
