<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

export interface DlTabItem {
  value: string
  label: string
}

/** Underlined section tabs. Each panel is a named slot: `<template #overview>`. */
defineProps<{
  label: string
  items: DlTabItem[]
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <TabsRoot v-model="model" class="flex flex-col gap-5">
    <TabsList
      :aria-label="label"
      class="flex gap-6 overflow-x-auto border-b border-dl-line"
    >
      <TabsTrigger
        v-for="item in items"
        :key="item.value"
        :value="item.value"
        class="-mb-px h-11 shrink-0 border-b-[3px] border-transparent px-0.5 text-sm font-semibold text-dl-muted transition hover:text-dl-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-dl-cobalt data-[state=active]:border-dl-fg data-[state=active]:font-bold data-[state=active]:text-dl-fg"
      >
        {{ item.label }}
      </TabsTrigger>
    </TabsList>
    <TabsContent
      v-for="item in items"
      :key="item.value"
      :value="item.value"
      class="focus-visible:outline-hidden"
    >
      <slot :name="item.value" />
    </TabsContent>
  </TabsRoot>
</template>
