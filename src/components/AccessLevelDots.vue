<script setup lang="ts">
import { computed } from 'vue'

/** Four squares: more blue means more rights. */
const props = defineProps<{ level: 'none' | 'view' | 'some' | 'full' }>()

const filled = computed(() => ({ none: 0, view: 1, some: 3, full: 4 })[props.level])
</script>

<template>
  <span class="inline-flex gap-[3px]" aria-hidden="true">
    <i v-for="square in 4" :key="square" class="h-2.5 w-2.5 rounded-[3px]" :class="square <= filled ? 'bg-dl-cobalt' : 'bg-dl-line'" />
  </span>
</template>
