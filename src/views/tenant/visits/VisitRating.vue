<script setup lang="ts">
// A 1 to 5 rating: five small buttons, one pressed. Clicking the pressed one clears it (the rating is optional).
defineProps<{ label: string }>()
const model = defineModel<number | null>({ default: null })
</script>

<template>
  <span role="radiogroup" :aria-label="label" class="inline-flex gap-1">
    <button
      v-for="value in 5"
      :key="value"
      type="button"
      role="radio"
      :aria-checked="model === value"
      class="flex h-8 w-8 items-center justify-center rounded-lg border text-[13px] font-bold transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
      :class="model === value ? 'border-dl-fg bg-dl-signal-soft text-dl-fg' : 'border-dl-line text-dl-muted hover:border-dl-body'"
      @click="model = model === value ? null : value"
    >{{ value }}</button>
  </span>
</template>
