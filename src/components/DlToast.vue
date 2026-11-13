<script setup lang="ts">
import { toasts } from '@/composables/useToast'
import DlIcon from './DlIcon.vue'

/** The messages of `useToast()`, bottom centre, above the phone bar. Mount once, in App.vue. */
</script>

<template>
  <div class="pointer-events-none fixed inset-x-4 bottom-24 z-2300 flex flex-col items-center gap-2 md:bottom-6" role="status" aria-live="polite">
    <p
      v-for="toast in toasts"
      :key="toast.id"
      class="pointer-events-auto flex max-w-[420px] items-center gap-2.5 rounded-2xl bg-dl-ink px-4 py-3 text-sm font-semibold text-dl-on-ink shadow-[0_12px_32px_-12px_rgba(15,31,28,0.45)]"
    >
      <DlIcon :icon="toast.tone === 'success' ? 'tabler-circle-check' : 'tabler-alert-triangle'" :size="18" :class="toast.tone === 'success' ? 'text-dl-signal' : 'text-dl-pending'" />
      {{ toast.text }}
    </p>
  </div>
</template>
