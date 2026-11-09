<script setup lang="ts">
import { computed } from 'vue'
import DlIcon from './DlIcon.vue'

/**
 * A table header you click to sort. The sort is written like the API's: `name`, or `-name` to reverse.
 * Clicking the sorted column reverses it. Extra classes go on the <th>.
 */
const props = defineProps<{
  label: string
  column: string
}>()

const sort = defineModel<string>({ required: true })

const direction = computed(() => {
  if (sort.value === props.column) return 'ascending'

  return sort.value === `-${props.column}` ? 'descending' : 'none'
})
const icon = computed(() => ({
  ascending: 'tabler-arrow-up',
  descending: 'tabler-arrow-down',
  none: 'tabler-arrows-sort',
})[direction.value])

function toggle(): void {
  sort.value = direction.value === 'ascending' ? `-${props.column}` : props.column
}
</script>

<template>
  <th class="p-3 font-semibold text-start" :aria-sort="direction">
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-md hover:text-dl-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt"
      :class="direction !== 'none' && 'text-dl-fg'"
      @click="toggle"
    >
      {{ label }}
      <DlIcon :icon="icon" :size="14" :class="direction === 'none' && 'opacity-50'" />
    </button>
  </th>
</template>
