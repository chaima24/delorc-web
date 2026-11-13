<script setup lang="ts">
import { computed, ref } from 'vue'
import DlInput from '@/components/DlInput.vue'

/** Pick several items from a searchable list of checkboxes. */
const props = defineProps<{
  legend: string
  selectedLabel: string
  searchLabel: string
  items: { value: number; label: string; hint?: string }[]
  emptyText: string
  disabled?: boolean
  error?: string
}>()

const model = defineModel<number[]>({ required: true })
const search = ref('')

const visible = computed(() => {
  const term = search.value.trim().toLowerCase()
  return term ? props.items.filter(item => item.label.toLowerCase().includes(term)) : props.items
})

function toggle(value: number) {
  model.value = model.value.includes(value) ? model.value.filter(v => v !== value) : [...model.value, value]
}
</script>

<template>
  <fieldset class="flex flex-col gap-2.5">
    <legend class="mb-1 flex w-full items-baseline justify-between text-[13px] font-semibold">
      {{ legend }}
      <span class="font-normal text-dl-muted">{{ selectedLabel }}</span>
    </legend>
    <DlInput
      v-if="items.length > 8"
      v-model="search"
      type="search"
      icon="tabler-search"
      :label="searchLabel"
      :placeholder="searchLabel"
      hide-label
    />
    <ul class="flex max-h-72 flex-col overflow-y-auto rounded-2xl border border-dl-line">
      <li v-for="item in visible" :key="item.value" class="border-b border-dl-line-soft last:border-b-0">
        <label class="flex min-h-11 cursor-pointer items-center gap-3 px-3.5 py-2 text-sm hover:bg-dl-mist">
          <input
            type="checkbox"
            class="h-[18px] w-[18px] accent-dl-ink"
            :checked="model.includes(item.value)"
            :disabled="disabled"
            @change="toggle(item.value)"
          >
          <span class="flex-1">{{ item.label }}</span>
          <span v-if="item.hint" class="text-xs text-dl-pending">{{ item.hint }}</span>
        </label>
      </li>
      <li v-if="!visible.length" class="px-3.5 py-3 text-sm text-dl-muted">{{ emptyText }}</li>
    </ul>
    <p v-if="error" class="text-xs text-dl-rejected">{{ error }}</p>
  </fieldset>
</template>
