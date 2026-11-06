<script setup lang="ts">
/** A general message for a whole form, not tied to one field. */
withDefaults(defineProps<{ tone?: 'error' | 'success' }>(), { tone: 'error' })
</script>

<template>
  <p
    :role="tone === 'error' ? 'alert' : 'status'"
    class="rounded-2xl px-4 py-3 text-sm font-medium"
    :class="tone === 'error' ? 'bg-dl-rejected/10 text-dl-rejected' : 'bg-dl-signal-soft text-dl-fg'"
  >
    <slot />
  </p>
</template>
