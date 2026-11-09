<script setup lang="ts">
import DlIcon from './DlIcon.vue'

withDefaults(defineProps<{
  title: string
  description?: string
  icon?: string
}>(), {
  icon: 'tabler-inbox',
})
</script>

<template>
  <div class="flex flex-col items-center gap-3 px-6 py-14 text-center">
    <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-dl-ink text-dl-signal">
      <DlIcon :icon="icon" :size="26" />
    </span>
    <h3 class="font-display text-xl font-extrabold tracking-[-0.01em] text-dl-fg">
      {{ title }}
    </h3>
    <p v-if="description" class="max-w-md text-sm leading-relaxed text-dl-muted">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-2 flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>
