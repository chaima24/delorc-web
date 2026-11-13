<script setup lang="ts">
/** Progress through a short form in steps: done steps dark, the current one lime. */
defineProps<{
  steps: string[]
  /** 0-based */
  current: number
}>()
</script>

<template>
  <ol class="flex gap-1.5" :aria-label="steps.join(', ')">
    <li
      v-for="(step, index) in steps"
      :key="step"
      class="flex flex-1 flex-col gap-1.5 text-[11.5px] font-semibold"
      :class="index <= current ? 'text-dl-fg' : 'text-dl-muted'"
      :aria-current="index === current ? 'step' : undefined"
    >
      <span
        aria-hidden="true"
        class="h-1 rounded-full"
        :class="index < current ? 'bg-dl-fg' : index === current ? 'bg-dl-signal' : 'bg-dl-line-soft'"
      />
      {{ step }}
    </li>
  </ol>
</template>
