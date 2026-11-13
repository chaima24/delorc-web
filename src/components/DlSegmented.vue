<script setup lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'

export interface DlSegmentedItem {
  value: string
  label: string
}

/** One-of-many switch (period, customer type…). Always keeps one value selected. */
withDefaults(defineProps<{
  label: string
  items: DlSegmentedItem[]
  /** Fill the width, choices sharing it equally (forms, panels). */
  block?: boolean
}>(), {
  block: false,
})

const model = defineModel<string>({ required: true })

function onUpdate(value: unknown) {
  if (typeof value === 'string' && value) model.value = value
}
</script>

<template>
  <ToggleGroupRoot
    type="single"
    :model-value="model"
    :aria-label="label"
    class="gap-1 rounded-xl bg-dl-line-soft p-1"
    :class="block ? 'grid w-full grid-flow-col auto-cols-fr' : 'inline-flex'"
    @update:model-value="onUpdate"
  >
    <ToggleGroupItem
      v-for="item in items"
      :key="item.value"
      :value="item.value"
      class="h-9 whitespace-nowrap rounded-[9px] px-3.5 text-center text-[13px] font-semibold text-dl-body transition hover:text-dl-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt data-[state=on]:bg-dl-ink data-[state=on]:text-dl-on-ink dark:data-[state=on]:bg-dl-fg dark:data-[state=on]:text-dl-mist"
    >
      {{ item.label }}
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>
